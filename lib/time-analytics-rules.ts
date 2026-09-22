import {
  TIME_OVERTIME_MEDIAN_MULTIPLE,
  TIME_OVERTIME_MIN_SECONDS,
  TIME_RUSHED_SECONDS,
  TIME_SLOW_CORRECT_MEDIAN_MULTIPLE,
} from "./constants";

export type TimeFlag = "rushed" | "overtime" | "slow_correct" | "ok";

/** Median of a sample; null when empty (never a fake zero). */
export function median(values: number[]): number | null {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 === 1 ? xs[mid]! : (xs[mid - 1]! + xs[mid]!) / 2;
}

/** Nearest-rank percentile (p in 0..1); null when empty. */
export function percentile(values: number[], p: number): number | null {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const rank = Math.min(xs.length - 1, Math.max(0, Math.ceil(p * xs.length) - 1));
  return xs[rank]!;
}

export function average(values: number[]): number | null {
  const xs = values.filter((v) => Number.isFinite(v));
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export type Aggregate = { avg: number | null; median: number | null; p90: number | null; n: number };

/** Aggregate-only summary: no per-user rows ever leave this shape. */
export function summarize(times: (number | null | undefined)[]): Aggregate {
  const xs = times.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return { avg: average(xs), median: median(xs), p90: percentile(xs, 0.9), n: xs.length };
}

/**
 * Flag one attempt. Thresholds come from lib/constants (env-tunable):
 * - rushed: wrong in under TIME_RUSHED_SECONDS;
 * - overtime: wrong slower than max(180s, 3× question median);
 * - slow_correct: right but slower than max(180s, 2× median) — revise candidate.
 */
export function classifyAttempt(args: {
  yourSeconds: number;
  medianSeconds: number | null;
  isCorrect: boolean;
}): TimeFlag {
  const { yourSeconds, medianSeconds, isCorrect } = args;
  if (!isCorrect && yourSeconds < TIME_RUSHED_SECONDS) return "rushed";
  const overtimeAt = Math.max(
    TIME_OVERTIME_MIN_SECONDS,
    (medianSeconds ?? 0) * TIME_OVERTIME_MEDIAN_MULTIPLE,
  );
  if (!isCorrect && yourSeconds > overtimeAt) return "overtime";
  if (isCorrect && medianSeconds !== null) {
    const slowAt = Math.max(
      TIME_OVERTIME_MIN_SECONDS,
      medianSeconds * TIME_SLOW_CORRECT_MEDIAN_MULTIPLE,
    );
    if (yourSeconds > slowAt) return "slow_correct";
  }
  return "ok";
}

export const FLAG_LABEL: Record<TimeFlag, string> = {
  rushed: "Too fast + wrong",
  overtime: "Overtime + wrong",
  slow_correct: "Slow + correct",
  ok: "On pace",
};
