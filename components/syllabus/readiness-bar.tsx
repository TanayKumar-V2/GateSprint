export function ReadinessBar({
  examReady,
  total,
}: {
  examReady: number;
  total: number;
}) {
  const pct = total === 0 ? 0 : Math.round((examReady / total) * 100);
  return (
    <div
      role="img"
      aria-label={`${examReady} of ${total} topics exam-ready (${pct} percent)`}
      className="border border-(--crt-line) bg-(--crt-bg) p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="crt-micro text-[11px] text-(--crt-ink)">
          READINESS <output className="text-(--crt-red)">{pct}%</output>
        </p>
        <p className="crt-micro text-[10px] tabular-nums text-(--crt-dim)">
          {examReady}/{total} TOPICS EXAM-READY
        </p>
      </div>
      <div className="mt-3 h-2.5 w-full bg-(--crt-line)" aria-hidden="true">
        <div className="h-full bg-(--crt-red)" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
