/* Pure context formatters — no database, no I/O.
 * Tested in tests/blocks.test.ts, including hostile payloads.
 *
 * Source context is untrusted application data (question text, solutions,
 * student answers). It always travels inside BEGIN/END delimiters,
 * separate from the system instructions, so injected text inside a
 * question cannot rewrite the teaching rules.
 */

export const CONTEXT_BEGIN = "=== SOURCE CONTEXT (untrusted application data) ===";
export const CONTEXT_END = "=== END SOURCE CONTEXT ===";

export function optionsText(options: { id: string; text: string }[] | null): string {
  if (!options) return "(numerical answer — no options)";
  return options.map((o) => `${o.id}. ${o.text}`).join("\n");
}

export function answerText(answer: unknown): string {
  if (!answer || typeof answer !== "object") return "(none)";
  const a = answer as Record<string, unknown>;
  if (typeof a.optionId === "string") return a.optionId;
  if (Array.isArray(a.optionIds)) return (a.optionIds as string[]).join(", ");
  if (typeof a.value === "number") return String(a.value);
  return "(none)";
}

export function formatQuestionBlock(data: {
  subjectName: string;
  topicName: string;
  sourceLabel: string | null;
  marks: number;
  negativeMarks: number;
  type: string;
  prompt: string;
  options: { id: string; text: string }[] | null;
  correctAnswer: unknown;
  selectedAnswer: unknown;
  wasCorrect: boolean;
  attempted: boolean;
  solution: string | null;
}): string {
  return `${CONTEXT_BEGIN}
The student tapped "Ask Mentor" on this practice question. Use it as the shared background — they should never have to retype it.

Subject: ${data.subjectName}
Topic: ${data.topicName}
Source: ${data.sourceLabel ?? "practice bank"} · Marks: ${data.marks}${data.negativeMarks > 0 ? ` (negative ${data.negativeMarks})` : ""}
Question type: ${data.type}

Question:
${data.prompt}

Options:
${optionsText(data.options)}

Correct answer: ${answerText(data.correctAnswer)}
${data.attempted ? `Student's selected answer: ${answerText(data.selectedAnswer)} (${data.wasCorrect ? "correct" : "incorrect"})` : "The student has not attempted this question yet."}
${data.solution ? `Available solution:\n${data.solution}` : ""}
${CONTEXT_END}`;
}

export function formatTopicBlock(data: {
  subjectName: string;
  topicName: string;
  attempts: number;
  accuracyPct: number | null;
  missedIds: string[];
  availableCount: number;
}): string {
  return `${CONTEXT_BEGIN}
The student started a targeted revision session for a weak topic. Create a focused revision path: the concept order to cover, one worked example, then practice pointers. Keep it encouraging and concrete.

Subject: ${data.subjectName}
Topic: ${data.topicName}
Student's record in this topic: ${data.attempts} attempts${data.accuracyPct === null ? " (no attempts yet)" : `, ${data.accuracyPct}% accuracy`}
${data.missedIds.length > 0 ? `Questions they have missed here (ids, for your reference only — describe them, don't paste ids): ${data.missedIds.slice(0, 8).join(", ")}` : "No recorded misses in this topic yet."}
Available published questions in this topic: ${data.availableCount}
${CONTEXT_END}`;
}
