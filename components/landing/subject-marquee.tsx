const SUBJECTS = [
  ["OPERATING SYSTEMS", "CS-01"],
  ["ALGORITHMS", "CS-02"],
  ["DATABASES", "CS-03"],
  ["COMPUTER NETWORKS", "CS-04"],
  ["THEORY OF COMPUTATION", "CS-05"],
  ["DIGITAL LOGIC", "CS-06"],
  ["COMPILER DESIGN", "CS-07"],
  ["ENGINEERING MATHEMATICS", "CS-08"],
] as const;

/**
 * Telemetry ticker: subject registry drift. Infinite linear loop,
 * mono micro-type, /// directional separators, red index ticks.
 */
export function SubjectMarquee() {
  const row = [...SUBJECTS, ...SUBJECTS];
  return (
    <div aria-hidden="true" className="overflow-hidden border-y-2 border-(--crt-ink) bg-(--crt-bg)">
      <div className="flex w-max animate-marquee items-stretch">
        {row.map(([subject, code], i) => (
          <span key={`${code}-${i}`} className="flex items-stretch">
            <span className="crt-micro flex items-center gap-3 px-6 py-3 text-[12px] text-(--crt-ink)">
              <span aria-hidden="true" className="inline-block h-2 w-2 bg-(--crt-red)" />
              {subject}
              <samp className="text-(--crt-dim)">[{code}]</samp>
            </span>
            <span aria-hidden="true" className="crt-micro flex items-center border-x border-(--crt-line) px-4 text-[12px] text-(--crt-red)">
              {"///"}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
