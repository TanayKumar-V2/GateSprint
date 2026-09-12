import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  attempts,
  questions,
  solutions,
  subjects,
  topics,
} from "@/db/schema";

/**
 * Source context is untrusted content (question text, solutions, student
 * answers) even when it comes from our own database. It always travels
 * inside a clearly delimited block, separate from the system instructions,
 * so injected text inside a question can't rewrite the teaching rules.
 */

const BEGIN = "=== SOURCE CONTEXT (untrusted application data) ===";
const END = "=== END SOURCE CONTEXT ===";

function optionsText(options: { id: string; text: string }[] | null): string {
  if (!options) return "(numerical answer — no options)";
  return options.map((o) => `${o.id}. ${o.text}`).join("\n");
}

function answerText(answer: unknown): string {
  if (!answer || typeof answer !== "object") return "(none)";
  const a = answer as Record<string, unknown>;
  if (typeof a.optionId === "string") return a.optionId;
  if (Array.isArray(a.optionIds)) return (a.optionIds as string[]).join(", ");
  if (typeof a.value === "number") return String(a.value);
  return "(none)";
}

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

  const solRows = await db
    .select({ content: solutions.content })
    .from(solutions)
    .where(eq(solutions.questionId, questionId))
    .orderBy(solutions.solutionType)
    .limit(1);

  return `${BEGIN}
The student tapped "Ask Mentor" on this practice question. Use it as the shared background — they should never have to retype it.

Subject: ${q.subjectName}
Topic: ${q.topicName}
Source: ${q.sourceLabel ?? "practice bank"} · Marks: ${q.marks}${q.negativeMarks > 0 ? ` (negative ${q.negativeMarks})` : ""}
Question type: ${q.type}

Question:
${q.prompt}

Options:
${optionsText(q.options)}

Correct answer: ${answerText(q.correctAnswer)}
${latest ? `Student's selected answer: ${answerText(latest.selectedAnswer)} (${latest.isCorrect ? "correct" : "incorrect"})` : "The student has not attempted this question yet."}
${solRows[0] ? `Available solution:\n${solRows[0].content}` : ""}
${END}`;
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

  return `${BEGIN}
The student started a targeted revision session for a weak topic. Create a focused revision path: the concept order to cover, one worked example, then practice pointers. Keep it encouraging and concrete.

Subject: ${t.subjectName}
Topic: ${t.topicName}
Student's record in this topic: ${total} attempts${accuracy === null ? " (no attempts yet)" : `, ${accuracy}% accuracy`}
${missed.length > 0 ? `Questions they have missed here (ids, for your reference only — describe them, don't paste ids): ${missed.slice(0, 8).join(", ")}` : "No recorded misses in this topic yet."}
Available published questions in this topic: ${questionRows.length}
${END}`;
}
