export type TrendLabel = "rising" | "stable" | "falling";

/** Slope threshold in marks/year: smaller wiggles count as stable. */
export const TREND_EPS = 0.5;

/** Least-squares slope of marks over years (xs must be sorted ascending). */
export function regressionSlope(points: { year: number; marks: number }[]): number {
  const n = points.length;
  if (n < 2) return 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sx += p.year;
    sy += p.marks;
    sxx += p.year * p.year;
    sxy += p.year * p.marks;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return 0;
  return (n * sxy - sx * sy) / denom;
}

export function trendLabel(slope: number): TrendLabel {
  if (slope > TREND_EPS) return "rising";
  if (slope < -TREND_EPS) return "falling";
  return "stable";
}

/** Trend over the last 5 years of a year->marks series (zero-filled). */
export function topicTrend(byYear: { year: number; marks: number }[]): {
  slope: number;
  label: TrendLabel;
} {
  const tail = [...byYear].sort((a, b) => a.year - b.year).slice(-5);
  const slope = Math.round(regressionSlope(tail) * 100) / 100;
  return { slope, label: trendLabel(slope) };
}

/** Zero-fill every year in [fromYear..toYear] so gaps render honestly. */
export function zeroFillYears(
  rows: { year: number; marks: number; count: number }[],
  fromYear: number,
  toYear: number,
): { year: number; marks: number; count: number }[] {
  const byYear = new Map(rows.map((r) => [r.year, r]));
  const out: { year: number; marks: number; count: number }[] = [];
  for (let y = fromYear; y <= toYear; y++) {
    out.push(byYear.get(y) ?? { year: y, marks: 0, count: 0 });
  }
  return out;
}

/** Years in range with zero published questions — the honest gap notice. */
export function missingYears(
  rows: { year: number; count: number }[],
  fromYear: number,
  toYear: number,
): number[] {
  const present = new Set(rows.filter((r) => r.count > 0).map((r) => r.year));
  const out: number[] = [];
  for (let y = fromYear; y <= toYear; y++) if (!present.has(y)) out.push(y);
  return out;
}

export function shareOf(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 1000;
}
