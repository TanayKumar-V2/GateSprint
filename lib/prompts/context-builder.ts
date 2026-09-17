import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  attempts,
  questions,
  subjects,
  topics,
} from "@/db/schema";
import { formatQuestionBlock, formatTopicBlock } from "./blocks";
import { readSolution } from "../solutions";

/** Full PYQ context for Ask-Mentor sessions. Loaded server-side only. */
export async function buildQuestionContext(
  userId: string,
  questionId: string,
): Promise<string | null> {
  const rows = await db
    .select({
      prompt: questions.prompt,
      type: questions.type,
      options: questions.options,
      correctAnswer: questions.correctAnswer,
      marks: questions.marks,
      negativeMarks: questions.negativeMarks,
      sourceLabel: questions.sourceLabel,
      subjectName: subjects.name,
      topicName: topics.name,
      isPublished: questions.isPublished,
    })
    .from(questions)
    .innerJoin(subjects, eq(questions.subjectId, subjects.id))
    .innerJoin(topics, eq(questions.topicId, topics.id))
    .where(eq(questions.id, questionId))
    .limit(1);
  const q = rows[0];
  if (!q || !q.isPublished) return null;

  const attemptRows = await db
    .select({
      selectedAnswer: attempts.selectedAnswer,
      isCorrect: attempts.isCorrect,
    })
    .from(attempts)
    .where(and(eq(attempts.questionId, questionId), eq(attempts.userId, userId)))
    .orderBy(desc(attempts.submittedAt))
    .limit(1);
  const latest = attemptRows[0] ?? null;

  const solution = await readSolution(questionId);

  return formatQuestionBlock({
    subjectName: q.subjectName,
    topicName: q.topicName,
    sourceLabel: q.sourceLabel,
    marks: q.marks,
    negativeMarks: q.negativeMarks,
    type: q.type,
    prompt: q.prompt,
    options: q.options,
    correctAnswer: q.correctAnswer,
    selectedAnswer: latest?.selectedAnswer ?? null,
    wasCorrect: latest?.isCorrect ?? false,
    attempted: latest !== null,
    solution,
  });
}

/** Focused revision context for weak-topic sessions. Statistics are computed
 * here from the student's real attempts — never accepted from the client. */
export async function buildTopicContext(
  userId: string,
  topicId: string,
): Promise<string | null> {
  const topicRows = await db
    .select({
      id: topics.id,
      topicName: topics.name,
      subjectId: topics.subjectId,
      subjectName: subjects.name,
    })
    .from(topics)
    .innerJoin(subjects, eq(topics.subjectId, subjects.id))
    .where(eq(topics.id, topicId))
    .limit(1);
  const t = topicRows[0];
  if (!t) return null;

  const questionRows = await db
    .select({ id: questions.id, prompt: questions.prompt })
    .from(questions)
    .where(and(eq(questions.topicId, topicId), eq(questions.isPublished, true)));
  if (questionRows.length === 0) return null;

  const attemptRows = await db
    .select({
      questionId: attempts.questionId,
      isCorrect: attempts.isCorrect,
    })
    .from(attempts)
    .where(eq(attempts.userId, userId));
  const byQuestion = new Map<string, { total: number; correct: number }>();
  for (const a of attemptRows) {
    const q = questionRows.find((x) => x.id === a.questionId);
    if (!q) continue;
    const e = byQuestion.get(q.id) ?? { total: 0, correct: 0 };
    e.total += 1;
    if (a.isCorrect) e.correct += 1;
    byQuestion.set(q.id, e);
  }

  const total = [...byQuestion.values()].reduce((n, e) => n + e.total, 0);
  const correct = [...byQuestion.values()].reduce((n, e) => n + e.correct, 0);
  const accuracy = total === 0 ? null : Math.round((correct / total) * 100);
  const missed = [...byQuestion.entries()]
    .filter(([, e]) => e.correct < e.total)
    .map(([id]) => id);

  return formatTopicBlock({
    subjectName: t.subjectName,
    topicName: t.topicName,
    attempts: total,
    accuracyPct: accuracy,
    missedIds: missed,
    availableCount: questionRows.length,
  });
}
