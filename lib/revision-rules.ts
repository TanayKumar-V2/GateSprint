import { addDays, daysBetween, now } from "./time";

export const MISS_INTERVALS = [1, 3, 7, 14] as const;
export const BOOKMARK_WEAK_DAYS = 2;
export const CORRECT_REFRESH_DAYS = 28;

/**
 * Pure interval math (unit-tested). Misses follow 1/3/7/14d; a bookmarked
 * question refreshes in 2d; a clean correct answer refreshes in 28d.
 */
export function nextDueAt(args: {
  lastActivityAt: Date;
  isCorrect: boolean | null;
  missCount: number;
  bookmarked: boolean;
  mistakeOpen: boolean;
}): Date {
  const { lastActivityAt, isCorrect, missCount, bookmarked, mistakeOpen } = args;
  if (mistakeOpen) {
    const idx = Math.min(Math.max(missCount - 1, 0), MISS_INTERVALS.length - 1);
    return addDays(lastActivityAt, MISS_INTERVALS[idx]!);
  }
  if (bookmarked) return addDays(lastActivityAt, BOOKMARK_WEAK_DAYS);
  if (isCorrect === true) return addDays(lastActivityAt, CORRECT_REFRESH_DAYS);
  if (isCorrect === false) return addDays(lastActivityAt, MISS_INTERVALS[0]!);
  return addDays(lastActivityAt, BOOKMARK_WEAK_DAYS);
}

export function dueReason(args: {
  missCount: number;
  mistakeOpen: boolean;
  bookmarked: boolean;
  isCorrect: boolean | null;
  lastActivityAt: Date;
  reference?: Date;
}): string {
  const ref = args.reference ?? now();
  const days = Math.max(0, daysBetween(args.lastActivityAt, ref));
  if (args.mistakeOpen) {
    const misses = args.missCount <= 1 ? "1 miss" : `${args.missCount} misses`;
    return `Missed ${days}d ago · ${misses}`;
  }
  if (args.bookmarked) return "Saved · needs a revisit";
  if (args.isCorrect === true) return `Correct ${days}d ago · fading`;
  return "Attempted · check again";
}
