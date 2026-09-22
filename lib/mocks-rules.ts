export type PaletteStatus =
  | "unvisited"
  | "unanswered"
  | "answered"
  | "marked"
  | "answered_marked";

export type ScoredItem = {
  marks: number;
  negativeMarks: number;
  /** null = skipped or ungraded. */
  isCorrect: boolean | null;
};

/**
 * GATE scoring: +marks when right, −negativeMarks when wrong, 0 skipped.
 * Pure so double-finish and result rendering always agree.
 */
export function computeMockScore(items: ScoredItem[]): {
  score: number;
  correct: number;
  incorrect: number;
  skipped: number;
} {
  let score = 0;
  let correct = 0;
  let incorrect = 0;
  let skipped = 0;
  for (const item of items) {
    if (item.isCorrect === null) {
      skipped += 1;
    } else if (item.isCorrect) {
      correct += 1;
      score += item.marks;
    } else {
      incorrect += 1;
      score -= item.negativeMarks;
    }
  }
  return { score: Math.round(score * 100) / 100, correct, incorrect, skipped };
}

/** True once the server clock has passed the paper's end. */
export function isSessionExpired(endsAt: Date, reference: Date): boolean {
  return reference.getTime() > endsAt.getTime();
}

/**
 * Strip everything a student must not see mid-paper. The runner payload is
 * built through this — a shape test asserts the keys stay absent.
 */
export function stripQuestionForRunner<T extends Record<string, unknown>>(
  question: T,
): Omit<T, "correctAnswer" | "solution"> {
  const rest: Record<string, unknown> = { ...question };
  delete rest.correctAnswer;
  delete rest.solution;
  return rest as Omit<T, "correctAnswer" | "solution">;
}

/** Server-side palette status from stored item state. */
export function paletteStatus(args: {
  hasAnswer: boolean;
  markedForReview: boolean;
}): Exclude<PaletteStatus, "unvisited"> {
  if (args.hasAnswer && args.markedForReview) return "answered_marked";
  if (args.hasAnswer) return "answered";
  if (args.markedForReview) return "marked";
  return "unanswered";
}
