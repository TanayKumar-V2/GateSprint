/** Share-of-marks bar: one static div, text carries the value. */
export function WeightageBar({ share, label }: { share: number; label: string }) {
  const pct = Math.round(share * 100);
  return (
    <div role="img" aria-label={`${label}: ${pct} percent of marks`} className="min-w-24 flex-1">
      <div className="h-2 w-full bg-(--crt-line)" aria-hidden="true">
        <div className="h-full bg-(--crt-red)" style={{ width: `${pct}%` }} />
      </div>
      <p className="crt-micro mt-1 text-[10px] tabular-nums text-(--crt-dim)">{pct}%</p>
    </div>
  );
}
