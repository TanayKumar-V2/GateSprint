import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  chatSessions,
  generatedQuestions,
  questions,
  subjects,
  topics,
  type CorrectAnswer,
} from "@/db/schema";
import { buildQuestionContext, buildTopicContext } from "./prompts/context-builder";
import { VARIANT_SYSTEM, variantUserPrompt } from "./prompts/variant-prompt";
import { generateVariantText } from "./ai/variant-router";
import { saveAssistantMessage } from "./chat";
import {
  extractJsonArray,
  toListItem,
  validateRawVariant,
} from "./variants-rules";
import {
  gradeMcq,
  gradeMsq,
  gradeNat,
  type SubmittedAnswer,
} from "./validation/answers";
import { logSecurityEvent } from "./security/events";

export type VariantListItem = {
  id: string;
  prompt: string;
  type: "mcq" | "msq" | "nat";
  options: { id: string; text: string }[] | null;
  difficulty: "easy" | "medium" | "hard";
  verified: boolean;
  createdAt: Date;
};

async function ownedSession(userId: string, sessionId: string) {
  const rows = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Generate 1-3 variant questions off the session's source. Loads source
 * context server-side, calls Groq with chat's fallback policy, validates
 * every variant BEFORE persisting, and stores an assistant summary so the
 * set counts against the daily chat budget.
 */
export async function requestVariants(
  userId: string,
  sessionId: string,
  opts: { count?: number; difficulty?: "easy" | "medium" | "hard" } = {},
): Promise<
  | { variants: VariantListItem[]; modelUsed: string; fallbackUsed: boolean }
  | { error: "not_found" | "no_source" | "ai_unavailable" | "bad_variants"; message: string }
> {
  const count = Math.min(Math.max(opts.count ?? 3, 1), 3);
  const session = await ownedSession(userId, sessionId);
  if (!session) return { error: "not_found", message: "Not found." };

  let sourceContext: string | null = null;
  let topicId: string | null = session.sourceTopicId;
  let difficulty = opts.difficulty;
  if (session.sourceQuestionId) {
    sourceContext = await buildQuestionContext(userId, session.sourceQuestionId);
    if (!sourceContext) return { error: "not_found", message: "Not found." };
    if (!topicId || !difficulty) {
      const q = await db
        .select({ topicId: questions.topicId, difficulty: questions.difficulty })
        .from(questions)
        .where(eq(questions.id, session.sourceQuestionId))
        .limit(1);
      topicId = topicId ?? q[0]?.topicId ?? null;
      difficulty = difficulty ?? q[0]?.difficulty ?? "medium";
    }
  } else if (session.sourceTopicId) {
    sourceContext = await buildTopicContext(userId, session.sourceTopicId);
    if (!sourceContext) return { error: "not_found", message: "Not found." };
    difficulty = difficulty ?? "medium";
  } else {
    return { error: "no_source", message: "Generate practice from a question or topic session." };
  }

  const outcome = await generateVariantText({
    system: VARIANT_SYSTEM,
    prompt: variantUserPrompt({ sourceContext, count, difficulty: difficulty ?? "medium" }),
  });
  if (!outcome.ok) {
    logSecurityEvent({ category: "provider-failure", detail: `variants kind=${outcome.kind}`, userId });
    return { error: "ai_unavailable", message: "Mentor is temporarily unavailable. Try again in a bit." };
  }

  const raw = extractJsonArray(outcome.text);
  if (!Array.isArray(raw)) {
    return { error: "bad_variants", message: "The generated set didn't parse — nothing was saved. Try again." };
  }
  const valid = raw.slice(0, count).map(validateRawVariant).filter((v) => v !== null);
  if (valid.length === 0) {
    return { error: "bad_variants", message: "The generated set failed checks — nothing was saved. Try again." };
  }

  const inserted = await db
    .insert(generatedQuestions)
    .values(
      valid.map((v) => ({
        sessionId,
        userId,
        prompt: v.prompt,
        type: v.type,
        options: v.options,
        correctAnswer: v.correctAnswer,
        difficulty: v.difficulty,
        topicId,
      })),
    )
    .returning();

  await saveAssistantMessage({
    sessionId,
    content: `Generated ${inserted.length} practice ${inserted.length === 1 ? "question" : "questions"} on this ${session.sourceQuestionId ? "question" : "topic"} — AI-generated and unreviewed. Try them below; answers stay hidden until you check.`,
    modelUsed: outcome.modelUsed,
    fallbackUsed: outcome.fallbackUsed,
    status: "completed",
  });

  return {
    variants: inserted.map((r) =>
      toListItem({
        id: r.id,
        prompt: r.prompt,
        type: r.type,
        options: r.options,
        difficulty: r.difficulty,
        verified: r.verified,
        createdAt: r.createdAt,
      }),
    ),
    modelUsed: outcome.modelUsed,
    fallbackUsed: outcome.fallbackUsed,
  };
}

export async function listVariants(
  userId: string,
  sessionId: string,
): Promise<VariantListItem[] | { error: "not_found" }> {
  const session = await ownedSession(userId, sessionId);
  if (!session) return { error: "not_found" };
  const rows = await db
    .select()
    .from(generatedQuestions)
    .where(and(eq(generatedQuestions.sessionId, sessionId), eq(generatedQuestions.userId, userId)))
    .orderBy(desc(generatedQuestions.createdAt));
  return rows.map((r) =>
    toListItem({
      id: r.id,
      prompt: r.prompt,
      type: r.type,
      options: r.options,
      difficulty: r.difficulty,
      verified: r.verified,
      createdAt: r.createdAt,
    }),
  );
}

/**
 * Grade one variant answer. The key is revealed WITH the verdict here —
 * unlike mocks, variants are instant retests, not exams. A correct grading
 * path marks the row verified.
 */
export async function answerVariant(
  userId: string,
  variantId: string,
  answer: SubmittedAnswer,
): Promise<
  | { isCorrect: boolean; correctAnswer: CorrectAnswer }
  | { error: "not_found" }
  | { error: "bad_answer"; message: string }
> {
  const rows = await db
    .select()
    .from(generatedQuestions)
    .where(and(eq(generatedQuestions.id, variantId), eq(generatedQuestions.userId, userId)))
    .limit(1);
  const variant = rows[0];
  if (!variant) return { error: "not_found" };

  const key = variant.correctAnswer;
  if (variant.type === "mcq") {
    if (!("optionId" in answer)) return { error: "bad_answer", message: "This question needs one option." };
    if (!variant.options?.some((o) => o.id === answer.optionId.trim()))
      return { error: "bad_answer", message: "Unknown option." };
    if (key.kind !== "mcq") return { error: "bad_answer", message: "This question needs one option." };
    const isCorrect = gradeMcq(answer.optionId, key.optionId);
    if (isCorrect && !variant.verified) {
      await db.update(generatedQuestions).set({ verified: true }).where(eq(generatedQuestions.id, variant.id));
    }
    return { isCorrect, correctAnswer: key };
  }
  if (variant.type === "msq") {
    if (!("optionIds" in answer)) return { error: "bad_answer", message: "This question needs a set of options." };
    const known = new Set((variant.options ?? []).map((o) => o.id));
    if (answer.optionIds.length === 0 || !answer.optionIds.every((id) => known.has(id.trim())))
      return { error: "bad_answer", message: "Unknown option selected." };
    if (key.kind !== "msq") return { error: "bad_answer", message: "This question needs a set of options." };
    const isCorrect = gradeMsq(answer.optionIds, key.optionIds);
    if (isCorrect && !variant.verified) {
      await db.update(generatedQuestions).set({ verified: true }).where(eq(generatedQuestions.id, variant.id));
    }
    return { isCorrect, correctAnswer: key };
  }
  if (!("value" in answer) || !Number.isFinite(answer.value))
    return { error: "bad_answer", message: "This question needs a number." };
  if (key.kind !== "nat") return { error: "bad_answer", message: "This question needs a number." };
  const isCorrect = gradeNat(answer.value, key.value, key.tolerance);
  if (isCorrect && !variant.verified) {
    await db.update(generatedQuestions).set({ verified: true }).where(eq(generatedQuestions.id, variant.id));
  }
  return { isCorrect, correctAnswer: key };
}

/**
 * Admin-only: copy a vetted variant into the bank as UNPUBLISHED for review.
 * Never publishes directly — review happens on the admin question page.
 */
export async function promoteVariant(
  variantId: string,
  target: { subjectId: string; topicId: string; year?: number; marks?: number },
): Promise<{ questionId: string } | { error: "not_found" | "bad_taxonomy" }> {
  const rows = await db.select().from(generatedQuestions).where(eq(generatedQuestions.id, variantId)).limit(1);
  const variant = rows[0];
  if (!variant) return { error: "not_found" };

  const subject = await db.select({ id: subjects.id }).from(subjects).where(eq(subjects.id, target.subjectId)).limit(1);
  const topic = await db
    .select({ id: topics.id, subjectId: topics.subjectId })
    .from(topics)
    .where(eq(topics.id, target.topicId))
    .limit(1);
  if (!subject[0] || !topic[0] || topic[0].subjectId !== subject[0].id) return { error: "bad_taxonomy" };

  const inserted = await db
    .insert(questions)
    .values({
      subjectId: target.subjectId,
      topicId: target.topicId,
      year: target.year ?? new Date().getUTCFullYear(),
      questionNumber: null,
      type: variant.type,
      difficulty: variant.difficulty,
      prompt: variant.prompt,
      options: variant.options,
      correctAnswer: variant.correctAnswer,
      marks: target.marks ?? 1,
      negativeMarks: variant.type === "mcq" ? 0.33 : 0,
      sourceLabel: "AI variant (unreviewed)",
      isPublished: false,
    })
    .returning();
  return { questionId: inserted[0]!.id };
}
