/* Pure recommendation rules — no database, no I/O.
 * Tested in tests/rules.test.ts. lib/progress.ts loads the data and
 * applies these. Thresholds live here so the rule is readable in one place:
 * a topic is weak with 3+ attempts under 60% accuracy, or 2 straight
 * misses on a smaller sample. */

export const WEAK_MIN_ATTEMPTS = 3;
export const WEAK_MAX_ACCURACY = 0.6;
export const SMALL_SAMPLE_MISS_STREAK = 2;

export function accuracyOf(correct: number, total: number): number | null {
  return total === 0 ? null : Math.round((correct / total) * 1000) / 1000;
}

export function pct(accuracy: number | null): string {
  return accuracy === null ? "—" : `${Math.round(accuracy * 100)}%`;
}

export type WeakVerdict =
  | { weak: false; reason: null }
  | { weak: true; reason: string };

export function evaluateWeakTopic(args: {
  attempts: number;
  correct: number;
  recentMissStreak: number;
}): WeakVerdict & { accuracy: number | null } {
  const accuracy = accuracyOf(args.correct, args.attempts);
  if (
    args.attempts >= WEAK_MIN_ATTEMPTS &&
    accuracy !== null &&
    accuracy < WEAK_MAX_ACCURACY
  ) {
    return {
      weak: true,
      accuracy,
      reason: `${pct(accuracy)} accuracy across ${args.attempts} attempts — needs work`,
    };
  }
  if (
    args.attempts > 0 &&
    args.attempts < WEAK_MIN_ATTEMPTS &&
    args.recentMissStreak >= SMALL_SAMPLE_MISS_STREAK
  ) {
    return {
      weak: true,
      accuracy,
      reason: `${args.recentMissStreak} recent misses in a row — early warning sign`,
    };
  }
  return { weak: false, accuracy, reason: null };
}

export type RankableQuestion = {
  id: string;
  difficulty: "easy" | "medium" | "hard";
  year: number;
  questionNumber: number | null;
};

const DIFFICULTY_RANK = { easy: 0, medium: 1, hard: 2 } as const;

/** Deterministic practice order: gentler first, newest first, stable. */
export function rankQuestions<T extends RankableQuestion>(list: T[]): T[] {
  return [...list].sort(
    (a, b) =>
      DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty] ||
      b.year - a.year ||
      (a.questionNumber ?? 0) - (b.questionNumber ?? 0) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}
