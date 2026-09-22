import Link from "next/link";
import type { SubjectWeight } from "@/lib/trends";
import { YearSparkline } from "./year-sparkline";
import { WeightageBar } from "./weightage-bar";

const TREND_STYLE: Record<string, string> = {
  rising: "border-(--brand-success) text-(--crt-ink)",
  stable: "border-(--crt-line) text-(--crt-dim)",
  falling: "border-(--crt-red) text-(--crt-red)",
};

export function TrendTable({ subjects }: { subjects: SubjectWeight[] }) {
  if (subjects.length === 0) return null;
  return (
    <ul className="grid gap-px border border-(--crt-line) bg-(--crt-line)">
      {subjects.map((s) => (
        <li key={s.slug} className="flex flex-col gap-4 bg-(--crt-bg) p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold uppercase tracking-tight text-(--crt-ink)">{s.name}</p>
              <p className="crt-micro mt-1 text-[10px] tabular-nums text-(--crt-dim)">
                <output className="text-(--crt-ink)">{s.totalMarks}</output> MARKS
              </p>
            </div>
            <WeightageBar share={s.share} label={s.name} />
          </div>
          <YearSparkline byYear={s.byYear} label={s.name} />
          {s.topTopics.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {s.topTopics.map((t) => (
                <li key={t.slug} className="flex flex-wrap items-center justify-between gap-2 border-t border-(--crt-line) pt-2">
                  <Link
                    href={t.practicePath}
                    className="text-sm text-(--crt-ink) underline decoration-(--crt-red) decoration-2 underline-offset-4 hover:text-(--crt-red)"
                  >
                    {t.name}
                  </Link>
                  <span className="flex items-center gap-2">
                    <span className="crt-micro text-[10px] tabular-nums text-(--crt-dim)">{t.totalMarks}M</span>
                    <span className={`crt-micro border px-1.5 py-0.5 text-[9px] ${TREND_STYLE[t.trend]}`}>
                      {t.trend.toUpperCase()}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
