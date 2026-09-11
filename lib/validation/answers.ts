import { z } from "zod";

/* ---------- Stored shapes ---------- */

export const optionSchema = z.object({
  id: z.string().min(1).max(8),
  text: z.string().min(1).max(4000),
});

export const mcqAnswerSchema = z.object({ optionId: z.string().min(1) });

export const msqAnswerSchema = z.object({
  optionIds: z.array(z.string().min(1)).min(1).max(16),
});

export const natAnswerSchema = z.object({
  value: z.number().finite(),
});

/** What the student submits for each question type. */
export const submittedAnswerSchema = z.union([
  mcqAnswerSchema,
  msqAnswerSchema,
  natAnswerSchema,
]);

export type SubmittedAnswer = z.infer<typeof submittedAnswerSchema>;

/* ---------- Grading (server-side only) ---------- */

export function gradeMcq(selected: string, correctOptionId: string): boolean {
  return selected.trim() === correctOptionId.trim();
}

export function gradeMsq(selected: string[], correct: string[]): boolean {
  const a = new Set(selected.map((s) => s.trim()));
  const b = new Set(correct.map((s) => s.trim()));
  if (a.size !== b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

/**
 * NAT comparison. Tolerance is absolute and comes from the question
 * (seeded per question, default 0.01). Exact-match callers pass 0.
 */
export function gradeNat(
  selected: number,
  correct: number,
  tolerance: number,
): boolean {
  if (!Number.isFinite(selected) || !Number.isFinite(correct)) return false;
  const tol = Math.max(0, tolerance);
  return Math.abs(selected - correct) <= tol;
}

/* ---------- Question list filters (safe defaults + caps) ---------- */

const slug = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/);

export const questionFilterSchema = z.object({
  subject: slug.optional(),
  topic: slug.optional(),
  year: z.coerce.number().int().min(1990).max(2100).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  type: z.enum(["mcq", "msq", "nat"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type QuestionFilter = z.infer<typeof questionFilterSchema>;
