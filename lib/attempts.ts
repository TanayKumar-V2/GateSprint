import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { attempts, questions } from "@/db/schema";
import {
  gradeMcq,
  gradeMsq,
  gradeNat,
  type SubmittedAnswer,
} from "./validation/answers";
import { ensureQuestionSolution, readSolution } from "./solutions";

export type GradedAttempt = {
  attemptId: string;
  isCorrect: boolean;
  submittedAt: Date;
  deduped: boolean;
  correctAnswer: unknown;
  solution: string | null;
  /** True when this submission triggered AI grading (first attempt, no key). */
  aiGraded: boolean;
  explanation: string | null;
};

const RETRY_WINDOW_SECONDS = 60;

function normalizeAnswer(answer: SubmittedAnswer): unknown {
  if ("optionId" in answer) return { optionId: answer.optionId.trim() };
  if ("optionIds" in answer)
    return {
      optionIds: [...new Set(answer.optionIds.map((s) => s.trim()))].sort(),
    };
  return { value: answer.value };
}

/**
 * Grade and record an attempt. Correctness is always recomputed here —
 * a client-supplied verdict is never accepted.
 *
 * Questions imported without an answer key are graded by AI on the first
 * attempt: the model solves, we verify its answer shape deterministically,
 * recompute correctness from that answer (never trusting its verdict
 * blindly), cache the answer on the question, and record the attempt.
 * Every later attempt grades locally against the cache. Nothing is
 * recorded when the grader cannot judge or is unavailable.
 *
 * Retries are safe two ways: an explicit idempotency key reuses the first
 * attempt, and without one, an identical submission within the retry
 * window returns the recent attempt instead of recording a duplicate.
 */
export async function submitAttempt(
  userId: string,
  input: {
    questionId: string;
    answer: SubmittedAnswer;
    timeTakenSeconds?: number;
    startedAt?: string;
    idempotencyKey?: string;
  },
): Promise<
  | GradedAttempt
  | { error: "not_found" }
  | { error: "bad_answer"; message: string }
  | { error: "needs_review"; message: string }
  | { error: "ai_unavailable"; message: string }
> {
  const rows = await db
    .select()
    .from(questions)
    .where(
      and(eq(questions.id, input.questionId), eq(questions.isPublished, true)),
    )
    .limit(1);
  const question = rows[0];
  if (!question) return { error: "not_found" };

  const answer = input.answer;

  // Shape checks need no answer key: reject malformed submissions first so
  // a bad request never spends a model call.
  if (question.type === "mcq") {
    if (!("optionId" in answer))
      return { error: "bad_answer", message: "This question needs one option." };
    const picked = answer.optionId.trim();
    if (!question.options?.some((o) => o.id === picked))
      return { error: "bad_answer", message: "Unknown option." };
  } else if (question.type === "msq") {
    if (!("optionIds" in answer))
      return { error: "bad_answer", message: "This question needs a set of options." };
    const known = new Set((question.options ?? []).map((o) => o.id));
    const picked = answer.optionIds.map((s) => s.trim());
    if (picked.length === 0 || !picked.every((id) => known.has(id)))
      return { error: "bad_answer", message: "Unknown option selected." };
  } else {
    if (!("value" in answer) || !Number.isFinite(answer.value))
      return { error: "bad_answer", message: "This question needs a number." };
  }

  let resolved = question.correctAnswer;
  let aiGraded = false;
  const explanation = null;
  if (!resolved || !(await readSolution(question.id))) {
    let cached;
    try {
      cached = await ensureQuestionSolution(question.id);
    } catch (error) {
      console.error(
        "solution cache failed:",
        error instanceof Error ? error.message : error,
      );
      if (!question.correctAnswer) {
        return { error: "ai_unavailable", message: "Grading is temporarily unavailable — nothing was recorded. Try again." };
      }
    }
    if (cached?.error && !resolved) {
      return { error: cached.error, message: cached.message ?? "The question needs review." };
    }
    resolved = cached?.correctAnswer ?? resolved;
    aiGraded = !question.correctAnswer && (cached?.generated ?? false);
  }
  if (!resolved) return { error: "needs_review", message: "An answer is not available for this question." };

  let isCorrect: boolean;
  if (question.type === "mcq") {
    if (!("optionId" in answer) || resolved.kind !== "mcq")
      return { error: "bad_answer", message: "This question needs one option." };
    isCorrect = gradeMcq(answer.optionId, resolved.optionId);
  } else if (question.type === "msq") {
    if (!("optionIds" in answer) || resolved.kind !== "msq")
      return { error: "bad_answer", message: "This question needs a set of options." };
    isCorrect = gradeMsq(answer.optionIds, resolved.optionIds);
  } else {
    if (!("value" in answer) || resolved.kind !== "nat")
      return { error: "bad_answer", message: "This question needs a number." };
    isCorrect = gradeNat(answer.value, resolved.value, resolved.tolerance);
  }

  // Explicit idempotency key: the unique index guarantees one attempt.
  if (input.idempotencyKey) {
    const existing = await db
      .select()
      .from(attempts)
      .where(
        and(
          eq(attempts.userId, userId),
          eq(attempts.clientKey, input.idempotencyKey),
        ),
      )
      .limit(1);
    if (existing[0]) return toGraded(existing[0], question.id, true);
    try {
      const inserted = await db
        .insert(attempts)
        .values({
          userId,
          questionId: question.id,
          selectedAnswer: normalizeAnswer(answer),
          isCorrect,
          clientKey: input.idempotencyKey,
          timeTakenSeconds: input.timeTakenSeconds,
          startedAt: input.startedAt ? new Date(input.startedAt) : null,
        })
        .returning();
      return toGraded(inserted[0]!, question.id, false, { aiGraded, explanation });
    } catch {
      // Lost a race with an identical retry: return the winner.
      const winner = await db
        .select()
        .from(attempts)
        .where(
          and(
            eq(attempts.userId, userId),
            eq(attempts.clientKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      if (winner[0]) return toGraded(winner[0], question.id, true);
      throw new Error("Attempt could not be recorded.");
    }
  }

  // No key: same answer to the same question within the retry window
  // reuses the recent attempt (double-clicks, network retries).
  const normalized = normalizeAnswer(answer);
  const recent = await db
    .select()
    .from(attempts)
    .where(
      and(
        eq(attempts.userId, userId),
        eq(attempts.questionId, question.id),
        gte(
          attempts.createdAt,
          sql`now() - make_interval(secs => ${RETRY_WINDOW_SECONDS})`,
        ),
      ),
    )
    .orderBy(desc(attempts.createdAt))
    .limit(5);
  const same = recent.find(
    (r) => JSON.stringify(r.selectedAnswer) === JSON.stringify(normalized),
  );
  if (same) return toGraded(same, question.id, true);

  const inserted = await db
    .insert(attempts)
    .values({
      userId,
      questionId: question.id,
      selectedAnswer: normalized,
      isCorrect,
      timeTakenSeconds: input.timeTakenSeconds,
      startedAt: input.startedAt ? new Date(input.startedAt) : null,
    })
    .returning();
  return toGraded(inserted[0]!, question.id, false, { aiGraded, explanation });
}

async function toGraded(
  attempt: typeof attempts.$inferSelect,
  questionId: string,
  deduped: boolean,
  ai: { aiGraded: boolean; explanation: string | null } = { aiGraded: false, explanation: null },
): Promise<GradedAttempt> {
  const answerRows = await db
    .select({ correctAnswer: questions.correctAnswer })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);
  const solution = await readSolution(questionId);
  return {
    attemptId: attempt.id,
    isCorrect: attempt.isCorrect,
    submittedAt: attempt.submittedAt,
    deduped,
    correctAnswer: answerRows[0]?.correctAnswer ?? null,
    solution,
    aiGraded: ai.aiGraded,
    explanation: ai.explanation,
  };
}
