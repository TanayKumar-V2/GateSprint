import { z } from "zod";
import { optionSchema } from "./validation/answers";
import type { CorrectAnswer, QuestionOption } from "@/db/schema";

const rawVariantSchema = z.object({
  prompt: z.string().trim().min(10).max(6000),
  type: z.enum(["mcq", "msq", "nat"]),
  options: z.array(optionSchema).min(2).max(4).nullable(),
  correctAnswer: z.unknown(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
});

export type ValidVariant = {
  prompt: string;
  type: "mcq" | "msq" | "nat";
  options: QuestionOption[] | null;
  correctAnswer: CorrectAnswer;
  difficulty: "easy" | "medium" | "hard";
};

/** Pull a JSON array out of model output (tolerates fences/prose). */
export function extractJsonArray(text: string): unknown | null {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

/**
 * Shape-validate one raw variant BEFORE persisting. Wrong-typed answers,
 * dangling option ids, and bad NAT tolerances are rejected here — never
 * stored, never shown.
 */
export function validateRawVariant(raw: unknown): ValidVariant | null {
  const parsed = rawVariantSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { prompt, type, options, correctAnswer, difficulty } = parsed.data;

  if (type === "nat") {
    if (options !== null) return null;
    const a = correctAnswer as Record<string, unknown>;
    if (
      !a ||
      a.kind !== "nat" ||
      typeof a.value !== "number" ||
      !Number.isFinite(a.value) ||
      typeof a.tolerance !== "number" ||
      !Number.isFinite(a.tolerance) ||
      (a.tolerance as number) < 0
    ) {
      return null;
    }
    return {
      prompt,
      type,
      options: null,
      correctAnswer: { kind: "nat", value: a.value as number, tolerance: a.tolerance as number },
      difficulty: difficulty ?? "medium",
    };
  }

  if (!options || options.length < 2) return null;
  const ids = options.map((o) => o.id);
  if (new Set(ids).size !== ids.length) return null;
  const a = correctAnswer as Record<string, unknown>;
  if (type === "mcq") {
    if (!a || a.kind !== "mcq" || typeof a.optionId !== "string" || !ids.includes(a.optionId)) {
      return null;
    }
    return {
      prompt,
      type,
      options,
      correctAnswer: { kind: "mcq", optionId: a.optionId },
      difficulty: difficulty ?? "medium",
    };
  }
  if (
    !a ||
    a.kind !== "msq" ||
    !Array.isArray(a.optionIds) ||
    a.optionIds.length === 0 ||
    !(a.optionIds as unknown[]).every((id) => typeof id === "string" && ids.includes(id as string))
  ) {
    return null;
  }
  return {
    prompt,
    type,
    options,
    correctAnswer: { kind: "msq", optionIds: [...new Set(a.optionIds as string[])] },
    difficulty: difficulty ?? "medium",
  };
}

/** List projection: everything the cards need, never the answer. */
export function toListItem(row: {
  id: string;
  prompt: string;
  type: "mcq" | "msq" | "nat";
  options: QuestionOption[] | null;
  difficulty: "easy" | "medium" | "hard";
  verified: boolean;
  createdAt: Date;
  correctAnswer?: unknown;
}): {
  id: string;
  prompt: string;
  type: "mcq" | "msq" | "nat";
  options: QuestionOption[] | null;
  difficulty: "easy" | "medium" | "hard";
  verified: boolean;
  createdAt: Date;
} {
  const rest: Record<string, unknown> = { ...row };
  delete rest.correctAnswer;
  return rest as {
    id: string;
    prompt: string;
    type: "mcq" | "msq" | "nat";
    options: QuestionOption[] | null;
    difficulty: "easy" | "medium" | "hard";
    verified: boolean;
    createdAt: Date;
  };
}
