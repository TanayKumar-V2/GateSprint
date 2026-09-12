import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { attempts, questions, solutions } from "@/db/schema";
import {
  gradeMcq,
  gradeMsq,
  gradeNat,
  type SubmittedAnswer,
} from "./validation/answers";

export type GradedAttempt = {
  attemptId: string;
  isCorrect: boolean;
  submittedAt: Date;
  deduped: boolean;
  correctAnswer: unknown;
  solution: string | null;
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
): Promise<GradedAttempt | { error: "not_found" } | { error: "bad_answer"; message: string }> {
  const rows = await db
    .select()
    .from(questions)
    .where(
      and(eq(questions.id, input.questionId), eq(questions.isPublished, true)),
    )
    .limit(1);
  const question = rows[0];
  if (!question) return { error: "not_found" };

  const correct = question.correctAnswer;
  if (!correct) return { error: "bad_answer", message: "Question has no answer key." };

  let isCorrect: boolean;
  const answer = input.answer;

  if (question.type === "mcq") {
    if (!("optionId" in answer) || correct.kind !== "mcq")
      return { error: "bad_answer", message: "This question needs one option." };
    if (!question.options?.some((o) => o.id === answer.optionId.trim()))
      return { error: "bad_answer", message: "Unknown option." };
    isCorrect = gradeMcq(answer.optionId, correct.optionId);
  } else if (question.type === "msq") {
    if (!("optionIds" in answer) || correct.kind !== "msq")
      return { error: "bad_answer", message: "This question needs a set of options." };
    const known = new Set((question.options ?? []).map((o) => o.id));
    const picked = answer.optionIds.map((s) => s.trim());
    if (picked.length === 0 || !picked.every((id) => known.has(id)))
      return { error: "bad_answer", message: "Unknown option selected." };
    isCorrect = gradeMsq(picked, correct.optionIds);
  } else {
    if (!("value" in answer) || correct.kind !== "nat")
      return { error: "bad_answer", message: "This question needs a number." };
    isCorrect = gradeNat(answer.value, correct.value, correct.tolerance);
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
      return toGraded(inserted[0]!, question.id, false);
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
  return toGraded(inserted[0]!, question.id, false);
}

async function toGraded(
  attempt: typeof attempts.$inferSelect,
  questionId: string,
  deduped: boolean,
): Promise<GradedAttempt> {
  const answerRows = await db
    .select({ correctAnswer: questions.correctAnswer })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);
  const solRows = await db
    .select({ content: solutions.content })
    .from(solutions)
    .where(eq(solutions.questionId, questionId))
    .orderBy(solutions.solutionType)
    .limit(1);
  return {
    attemptId: attempt.id,
    isCorrect: attempt.isCorrect,
    submittedAt: attempt.submittedAt,
    deduped,
    correctAnswer: answerRows[0]?.correctAnswer ?? null,
    solution: solRows[0]?.content ?? null,
  };
}
