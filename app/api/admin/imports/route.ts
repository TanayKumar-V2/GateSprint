import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { questions, solutions } from "@/db/schema";
import { currentAdmin, listAdminTaxonomy } from "@/lib/admin";
import {
  answerMatchesOptions,
  dedupeKey,
  matchSubject,
  matchTopic,
  normalizeAnswer,
  normalizeEnum,
  normalizeOptions,
  toNumber,
} from "@/lib/imports/normalize";
import { badRequest, forbidden, unauthorized } from "@/lib/api/respond";
import { isAllowedOrigin } from "@/lib/security/origin";

const option = z.object({ id: z.string().regex(/^[A-Z]$/), text: z.string().trim().min(1).max(1000) });
const requiredNumber = (schema: z.ZodType<number>) => z.preprocess((value) => {
  const coerced = toNumber(value);
  return coerced === undefined ? undefined : coerced;
}, schema);
const answer = z.preprocess(
  (value) => normalizeAnswer(value),
  z.union([
    z.object({ kind: z.literal("mcq"), optionId: z.string().regex(/^[A-Z]$/) }),
    z.object({ kind: z.literal("msq"), optionIds: z.array(z.string().regex(/^[A-Z]$/)).min(1) }),
    z.object({ kind: z.literal("nat"), value: z.number().finite(), tolerance: z.number().min(0).finite() }),
  ]),
);
const importedQuestion = z.object({
  externalId: z.string().trim().min(1).max(200), year: requiredNumber(z.number().int().min(1990).max(2100)), questionNumber: z.preprocess((value) => toNumber(value) ?? null, z.number().int().positive().nullable()), subject: z.string().trim().min(1), topic: z.string().trim().min(1), type: z.preprocess(normalizeEnum, z.enum(["mcq", "msq", "nat"])), difficulty: z.preprocess((value) => (value === null || value === "" ? "medium" : normalizeEnum(value)), z.enum(["easy", "medium", "hard"])), prompt: z.string().trim().min(1).max(12000), options: z.preprocess((value) => normalizeOptions(value) ?? null, z.array(option).nullable()), correctAnswer: answer, marks: requiredNumber(z.number().positive().max(20)).default(1), negativeMarks: requiredNumber(z.number().min(0).max(20)).default(0), solution: z.string().trim().optional(), sourceLabel: z.string().trim().max(200).optional(), sourcePage: z.preprocess((value) => toNumber(value) ?? null, z.number().int().positive().nullable()), confidence: z.preprocess((value) => toNumber(value) ?? null, z.number().min(0).max(1).nullable()),
});
const batch = z.object({ questions: z.array(z.unknown()).min(1).max(500) });

export async function POST(request: Request) {
  if (!(await currentAdmin())) return unauthorized("Admin sign-in required.");
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
  for (const rawItem of parsed.data.questions) {
    const itemParsed = importedQuestion.safeParse(rawItem);
    const rawExternalId = rawItem && typeof rawItem === "object" && "externalId" in rawItem && typeof rawItem.externalId === "string" ? rawItem.externalId : "unknown-question";
    if (!itemParsed.success) {
      const issue = itemParsed.error.issues[0];
      const field = issue?.path.length ? issue.path.join(".") + ": " : "";
      skipped.push({ externalId: rawExternalId, reason: field + (issue?.message ?? "Question shape is invalid.") });
      continue;
    }
    const item = itemParsed.data;
    if (seen.has(item.externalId)) { skipped.push({ externalId: item.externalId, reason: "Already imported." }); continue; }
    const promptKey = dedupeKey(item.prompt);
    if (seenPrompts.has(promptKey)) { skipped.push({ externalId: item.externalId, reason: "Same question text already in the bank." }); continue; }
    const subject = matchSubject(subjects, item.subject);
    const topic = subject ? matchTopic(topics, subject.id, item.topic) : null;
    if (!subject || !topic) { skipped.push({ externalId: item.externalId, reason: "Subject or topic was not found." }); continue; }
    if (item.type === "nat" && item.options !== null) { skipped.push({ externalId: item.externalId, reason: "NAT questions cannot have options." }); continue; }
    if (item.type !== "nat" && (!item.options || item.options.length < 2)) { skipped.push({ externalId: item.externalId, reason: "MCQ and MSQ questions need options." }); continue; }
    if (!answerMatchesOptions(item.correctAnswer as { kind: string; optionId?: string; optionIds?: string[] }, item.options)) { skipped.push({ externalId: item.externalId, reason: "The answer points to an option that does not exist." }); continue; }
    const inserted = await db.insert(questions).values({ subjectId: subject.id, topicId: topic.id, year: item.year, questionNumber: item.questionNumber ?? null, type: item.type, difficulty: item.difficulty, prompt: item.prompt, options: item.options, correctAnswer: item.correctAnswer, marks: item.marks, negativeMarks: item.negativeMarks, sourceLabel: item.sourceLabel ?? `GATE ${item.year}`, externalId: item.externalId, sourcePage: item.sourcePage ?? null, extractionConfidence: item.confidence ?? null, isPublished: false, updatedAt: new Date() }).returning();
    const questionId = inserted[0]!.id;
    await db.insert(solutions).values({ questionId, content: item.solution?.trim() || "Solution pending admin review.", solutionType: "curated" });
    seen.add(item.externalId); seenPrompts.add(promptKey); imported.push(item.externalId);
  }
  return NextResponse.json({ imported, skipped, importedCount: imported.length, skippedCount: skipped.length }, { status: 201 });
}
