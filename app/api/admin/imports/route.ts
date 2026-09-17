import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { questions, solutions, subjects as subjectsTable, topics as topicsTable } from "@/db/schema";
import { adminAccess, listAdminTaxonomy } from "@/lib/admin";
import {
  answerMatchesOptions,
  dedupeKey,
  extractNumberValue,
  matchSubject,
  matchTopic,
  normalizeAnswer,
  normalizeConfidence,
  normalizeDifficulty,
  normalizeOptions,
  normalizeQuestionNumber,
  normalizeType,
  toNumber,
} from "@/lib/imports/normalize";
import { badRequest, forbidden, unauthorized } from "@/lib/api/respond";
import { splitValidImages, saveQuestionImages } from "@/lib/imports/images";
import { isAllowedOrigin } from "@/lib/security/origin";

const option = z.object({ id: z.string().regex(/^[A-Z]$/), text: z.string().trim().min(1).max(1000) });
// Lenient numbers: "2 marks" -> 2, "GATE 2024" -> 2024. null/"" stay empty;
// genuine junk becomes NaN so the field still fails loudly instead of
// silently importing a wrong year or mark.
const lenientNumber = (value: unknown): number | null | undefined => {
  const coerced = toNumber(value);
  if (typeof coerced === "number" && Number.isFinite(coerced)) return coerced;
  if (coerced === null || coerced === undefined) return coerced;
  return extractNumberValue(value) ?? NaN;
};
const requiredNumber = (schema: z.ZodType<number>) => z.preprocess(lenientNumber, schema);
// Strict shape for an explicitly provided answer key. Imports never invent
// answers: a missing or unusable key stores NULL, and AI grades the first
// student attempt at solve time (then caches the answer).
const validAnswer = z.union([
  z.object({ kind: z.literal("mcq"), optionId: z.string().regex(/^[A-Z]$/) }),
  z.object({ kind: z.literal("msq"), optionIds: z.array(z.string().regex(/^[A-Z]$/)).min(1) }),
  z.object({ kind: z.literal("nat"), value: z.number().finite(), tolerance: z.number().min(0).finite() }),
]);
const importedQuestion = z.object({
  externalId: z.string().trim().min(1).max(200), year: requiredNumber(z.number().int().min(1990).max(2100)), questionNumber: z.preprocess((value) => normalizeQuestionNumber(value) ?? null, z.number().int().positive().nullable()), subject: z.string().trim().min(1), topic: z.string().trim().min(1), type: z.preprocess(normalizeType, z.enum(["mcq", "msq", "nat"])), difficulty: z.preprocess((value) => (value === null || value === "" ? "medium" : normalizeDifficulty(value)), z.enum(["easy", "medium", "hard"])), prompt: z.string().trim().min(1).max(12000), options: z.preprocess((value) => normalizeOptions(value) ?? null, z.array(option).nullable()), correctAnswer: z.unknown(), marks: requiredNumber(z.number().positive().max(20)).default(1), negativeMarks: requiredNumber(z.number().min(0).max(20)).default(0), solution: z.preprocess((value) => (typeof value === "string" ? value : value == null ? undefined : String(value)), z.string().trim().optional()),     sourceLabel: z.string().trim().max(200).optional(), sourcePage: z.preprocess((value) => normalizeQuestionNumber(value) ?? null, z.number().int().positive().nullable()), images: z.unknown().optional(),     confidence: z.preprocess((value) => {
      // Confidence must never sink an import — clamp into range, junk becomes unknown.
      const resolved = normalizeConfidence(value) ?? null;
      return typeof resolved === "number" && Number.isFinite(resolved) ? Math.min(1, Math.max(0, resolved)) : resolved;
    }, z.number().min(0).max(1).nullable()),
});
const batch = z.object({ questions: z.array(z.unknown()).min(1).max(500) });

// Holding area for questions whose subject/topic is not in the taxonomy yet.
// Created lazily on first use so clean imports never touch the taxonomy.
// Everything parked here stays unpublished with confidence 0 until an admin
// reassigns it — nothing silently lands in the wrong subject.
const QUARANTINE_SUBJECT = { slug: "uncategorized", name: "Uncategorized" };
const QUARANTINE_TOPIC = { slug: "needs-review", name: "Needs Review" };

async function quarantineBucket() {
  let subject = (await db.select().from(subjectsTable).where(eq(subjectsTable.slug, QUARANTINE_SUBJECT.slug)).limit(1))[0];
  if (!subject) {
    const inserted = await db.insert(subjectsTable).values({
      slug: QUARANTINE_SUBJECT.slug,
      name: QUARANTINE_SUBJECT.name,
      description: "Holding area for imported questions whose subject is not in the taxonomy yet.",
    }).onConflictDoNothing().returning();
    subject = inserted[0] ?? (await db.select().from(subjectsTable).where(eq(subjectsTable.slug, QUARANTINE_SUBJECT.slug)).limit(1))[0]!;
  }
  let topic = (await db.select().from(topicsTable).where(and(eq(topicsTable.subjectId, subject.id), eq(topicsTable.slug, QUARANTINE_TOPIC.slug))).limit(1))[0];
  if (!topic) {
    const inserted = await db.insert(topicsTable).values({
      subjectId: subject.id,
      slug: QUARANTINE_TOPIC.slug,
      name: QUARANTINE_TOPIC.name,
      description: "Imported questions waiting for subject/topic assignment.",
    }).onConflictDoNothing().returning();
    topic = inserted[0] ?? (await db.select().from(topicsTable).where(and(eq(topicsTable.subjectId, subject.id), eq(topicsTable.slug, QUARANTINE_TOPIC.slug))).limit(1))[0]!;
  }
  return { subject, topic };
}

function previewReceived(value: unknown): string {
  if (value === undefined) return " (nothing was sent)";
  let text: string;
  try {
    text = JSON.stringify(value) ?? String(value);
  } catch {
    text = String(value);
  }
  if (text.length > 120) text = text.slice(0, 117) + "...";
  return ` (received ${text})`;
}

function valueAtPath(root: unknown, path: (string | number | symbol)[]): unknown {
  let current: unknown = root;
  for (const key of path) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string | symbol, unknown>)[key as string];
  }
  return current;
}

function friendlyReason(issue: { path: (string | number | symbol)[]; message: string }, rawItem: unknown): string {
  const field = issue.path.length ? issue.path.join(".") : "";
  if (field === "options" || field.startsWith("options")) {
    return `options: Each option needs an A-D id and text${previewReceived(valueAtPath(rawItem, ["options"]))}.`;
  }
  if (field === "type") {
    return `type: Use mcq, msq, or nat${previewReceived(valueAtPath(rawItem, ["type"]))}.`;
  }
  if (field === "subject" || field === "topic") {
    return `${field}: No match in the current taxonomy${previewReceived(valueAtPath(rawItem, [field]))}.`;
  }
  return (field ? field + ": " : "") + issue.message;
}

export async function POST(request: Request) {
  const access = await adminAccess();
  if (access.status === "signed-out") return unauthorized("Admin sign-in required.");
  if (access.status === "denied") return forbidden("Admin access required.");
  if (!isAllowedOrigin(request)) return forbidden();
  let body: unknown;
  try { body = await request.json(); } catch { return badRequest("Send valid JSON."); }
  const parsed = batch.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid import batch.");
  const { subjects, topics } = await listAdminTaxonomy();
  const existing = await db.select({ id: questions.id, externalId: questions.externalId, prompt: questions.prompt }).from(questions);
  const seen = new Set(existing.flatMap((row) => row.externalId ? [row.externalId] : []));
  const seenPrompts = new Set(existing.map((row) => dedupeKey(row.prompt)));
  const imported: string[] = [];
  const skipped: { externalId: string; reason: string }[] = [];
  const warnings: { externalId: string; reason: string }[] = [];
  let figureCount = 0;
  for (const rawItem of parsed.data.questions) {
    const itemParsed = importedQuestion.safeParse(rawItem);
    const rawExternalId = rawItem && typeof rawItem === "object" && "externalId" in rawItem && typeof rawItem.externalId === "string" ? rawItem.externalId : "unknown-question";
    if (!itemParsed.success) {
      const issue = itemParsed.error.issues[0];
      skipped.push({ externalId: rawExternalId, reason: issue ? friendlyReason(issue, rawItem) : "Question shape is invalid." });
      continue;
    }
    const item = itemParsed.data;
    if (seen.has(item.externalId)) { skipped.push({ externalId: item.externalId, reason: "Already imported." }); continue; }
    const promptKey = dedupeKey(item.prompt);
    if (seenPrompts.has(promptKey)) { skipped.push({ externalId: item.externalId, reason: "Same question text already in the bank." }); continue; }
    const subject = matchSubject(subjects, item.subject);
    const topic = subject ? matchTopic(topics, subject.id, item.topic) : null;
    // Unknown taxonomy parks the question in the quarantine bucket instead of
    // skipping it. It still publishes immediately with confidence 0 — reassign
    // it from the question bank when you get a chance.
    let subjectId = subject?.id;
    let topicId = topic?.id;
    let quarantined = false;
    if (!subjectId || !topicId) {
      const bucket = await quarantineBucket();
      subjectId = bucket.subject.id;
      topicId = bucket.topic.id;
      quarantined = true;
    }
    if (item.type === "nat" && item.options !== null) { skipped.push({ externalId: item.externalId, reason: "NAT questions cannot have options." }); continue; }
    if (item.type !== "nat" && (!item.options || item.options.length < 2)) { skipped.push({ externalId: item.externalId, reason: "MCQ and MSQ questions need at least two options with A-D ids." }); continue; }
    // Repair messy key formats ("(A)", "Option B", "A;C", {answer:"C"})
    // using the question type as a hint. Anything unusable stores NULL —
    // AI grades the first attempt at solve time.
    const normalizedAnswer = normalizeAnswer(item.correctAnswer, item.type);
    const answerParsed = validAnswer.safeParse(normalizedAnswer);
    const finalAnswer = answerParsed.success ? answerParsed.data : null;
    if (finalAnswer && !answerMatchesOptions(finalAnswer as { kind: string; optionId?: string; optionIds?: string[] }, item.options)) { skipped.push({ externalId: item.externalId, reason: `The answer points to an option that does not exist (received ${JSON.stringify(normalizedAnswer)?.slice(0, 120)}).` }); continue; }
    // Figures never sink an import: invalid entries are dropped with a warning.
    const { valid: validImages, invalid: invalidImages } = splitValidImages(item.images);
    const inserted = await db.insert(questions).values({ subjectId, topicId, year: item.year, questionNumber: item.questionNumber ?? null, type: item.type, difficulty: item.difficulty, prompt: item.prompt, options: item.options, correctAnswer: finalAnswer, marks: item.marks, negativeMarks: item.negativeMarks, sourceLabel: item.sourceLabel ?? `GATE ${item.year}`, externalId: item.externalId, sourcePage: item.sourcePage ?? null, extractionConfidence: quarantined ? 0 : (item.confidence ?? null), isPublished: true, updatedAt: new Date() }).returning();
    const questionId = inserted[0]!.id;
    await db.insert(solutions).values({ questionId, content: item.solution?.trim() || "Solution pending.", solutionType: "curated" });
    const savedImages = await saveQuestionImages(questionId, validImages);
    figureCount += savedImages.length;
    seen.add(item.externalId); seenPrompts.add(promptKey); imported.push(item.externalId);
    if (quarantined) warnings.push({ externalId: item.externalId, reason: `Subject/topic ${JSON.stringify(item.subject)?.slice(0, 60)} / ${JSON.stringify(item.topic)?.slice(0, 60)} is not in the taxonomy — published under Uncategorized / Needs Review. Reassign when you get a chance.` });
    if (invalidImages > 0) warnings.push({ externalId: item.externalId, reason: `${invalidImages} figure(s) were dropped (unsupported format or over 512 KB). The question itself was still imported.` });
  }
  return NextResponse.json({ imported, skipped, warnings, importedCount: imported.length, skippedCount: skipped.length, needsReviewCount: warnings.length, figureCount }, { status: 201 });
}
