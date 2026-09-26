import Link from "next/link";
import type { Recommendation } from "@/lib/progress";
import { MathText } from "@/components/markdown/math-text";

/**
 * Telemetry stat cell: hard-bordered compartment, dim micro label,
 * macro phosphor readout. No rounding, no shadows.
 */
export function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="border border-(--crt-line) bg-(--crt-bg) p-5">
      <p className="crt-micro text-[10px] text-(--crt-dim)">{label.toUpperCase()}</p>
      <p className="crt-macro mt-2 text-[clamp(2rem,4vw,3rem)] tabular-nums text-(--crt-ink)">
        {value}
        <span className="text-(--crt-red)">.</span>
      </p>
      {hint ? (
        <p className="crt-micro mt-2 text-[10px] leading-relaxed text-(--crt-dim)">{hint.toUpperCase()}</p>
      ) : null}
    </div>
  );
}

export function RecommendationCard({ rec }: { rec: Recommendation }) {
  return (
    <article className="group flex h-full flex-col border border-(--crt-line) bg-(--crt-bg) transition-colors duration-150 hover:border-(--crt-red)">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-(--crt-line) px-4 py-2.5">
        <span className="crt-tag crt-tag-solid">{rec.difficulty}</span>
        <span className="crt-tag">{rec.year}</span>
        <span className="crt-tag">
          {rec.marks} MARK{rec.marks === 1 ? "" : "S"}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 py-4">
        <h3 className="text-base font-bold uppercase leading-6 tracking-tight text-(--crt-ink)">
          {rec.subject.name} {"///"} {rec.topic.name}
        </h3>
        <p className="crt-micro text-[10px] leading-relaxed text-(--crt-red)">
          DIRECTIVE: {rec.reason.toUpperCase()}
        </p>
        <MathText
          text={rec.prompt}
          inline
          className="line-clamp-2 text-sm leading-6 text-(--crt-dim) [&_.katex-display]:hidden"
        />
          <Link
            href={rec.practicePath}
            className="crt-btn-red !px-5 !py-2.5 !text-[11px] w-full text-center"
          >
            PRACTICE THIS &gt;&gt;&gt;
          </Link>
          <Link
            href={rec.revisePath}
            className="crt-micro block mt-2 text-center text-[10px] text-(--crt-ink) underline decoration-(--crt-red) hover:text-(--crt-red)"
          >
            OR REVISE WITH MENTOR
          </Link>
      </div>
    </article>
  );
}

export function BreakdownTable({
  caption,
  rows,
}: {
  caption: string;
  rows: {
    slug: string;
    name: string;
    attempts: number;
    accuracy: number | null;
    detail: string;
    href: string;
    isWeak?: boolean;
  }[];
}) {
  // Sort rows: weak items first, then by accuracy ascending
  const sortedRows = [...rows].sort((a, b) => {
    if (a.isWeak && !b.isWeak) return -1;
    if (!a.isWeak && b.isWeak) return 1;
    const accA = a.accuracy ?? 1;
    const accB = b.accuracy ?? 1;
    return accA - accB;
  });

  return (
    <div className="overflow-x-auto border border-(--crt-line)">
      <table className="crt-micro w-full min-w-[640px] border-collapse text-left text-[11px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b-2 border-(--crt-ink) text-(--crt-dim)">
            <th scope="col" className="px-4 py-3 font-normal">NAME</th>
            <th scope="col" className="px-4 py-3 font-normal">ATTEMPTS</th>
            <th scope="col" className="px-4 py-3 font-normal">ACCURACY</th>
            <th scope="col" className="px-4 py-3 font-normal">COVERAGE</th>
            <th scope="col" className="px-4 py-3 text-right font-normal">FEED</th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((r) => (
            <tr key={r.slug} className="border-b border-(--crt-line) text-(--crt-ink) transition-colors last:border-b-0 hover:bg-(--crt-raised)">
              <td className="px-4 py-3 font-bold">
                <div className="flex items-center gap-2">
                  {r.name.toUpperCase()}
                  {r.isWeak ? <span className="crt-tag crt-tag-red">WEAK</span> : null}
                </div>
              </td>
              <td className="px-4 py-3 tabular-nums">{r.attempts}</td>
              <td className="px-4 py-3 tabular-nums">
                {r.accuracy === null ? (
                  <span className="text-(--crt-dim)">NO DATA</span>
                ) : (
                  `${Math.round(r.accuracy * 100)}%`
                )}
              </td>
              <td className="px-4 py-3 text-(--crt-dim)">{r.detail.toUpperCase()}</td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={r.href}
                  className="font-bold text-(--crt-ink) underline decoration-(--crt-red) decoration-2 underline-offset-4 hover:text-(--crt-red)"
                  aria-label={`Practice ${r.name}`}
                >
                  DRILL &gt;&gt;&gt;
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
