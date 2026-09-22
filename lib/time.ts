/** Shared time helpers for extension features (mistakes, revision, mocks). */

export function now(): Date {
  return new Date();
}

export function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  const floored = Math.floor(value);
  return Math.min(max, Math.max(min, floored));
}

export function toSeconds(ms: number): number {
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.floor(ms / 1000));
}

/** Whole days between two dates (UTC calendar days). */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a) / 86_400_000);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}
