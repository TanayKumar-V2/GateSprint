/** Static year sparkline: one polyline, no library, no animation. */
export function YearSparkline({
  byYear,
  label,
}: {
  byYear: { year: number; marks: number }[];
  label: string;
}) {
  const W = 220;
  const H = 56;
  const PAD = 6;
  const max = Math.max(1, ...byYear.map((y) => y.marks));
  const step = byYear.length > 1 ? (W - PAD * 2) / (byYear.length - 1) : 0;
  const points = byYear
    .map((y, i) => `${(PAD + i * step).toFixed(1)},${(H - PAD - (y.marks / max) * (H - PAD * 2)).toFixed(1)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`${label}: marks by year, peak ${max}`}
      className="h-14 w-56"
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--crt-red)"
        strokeWidth="2"
      />
      {byYear.map((y, i) => (
        <circle
          key={y.year}
          cx={PAD + i * step}
          cy={H - PAD - (y.marks / max) * (H - PAD * 2)}
          r="2.5"
          fill="var(--crt-red)"
        >
          <title>{`${y.year}: ${y.marks} marks`}</title>
        </circle>
      ))}
    </svg>
  );
}
