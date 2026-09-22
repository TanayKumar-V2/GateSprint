import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/current-user";
import { getWeightage } from "@/lib/trends";
import { TrendTable } from "@/components/trends/trend-table";

export default async function TrendsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await currentUserId();
  if (!userId) redirect("/sign-in");

  const sp = await searchParams;
  const fromYear = typeof sp.fromYear === "string" ? Number(sp.fromYear) : undefined;
  const subject = typeof sp.subject === "string" && sp.subject ? sp.subject : undefined;
  const weightage = await getWeightage({
    ...(Number.isFinite(fromYear) ? { fromYear: fromYear as number } : {}),
    ...(subject ? { subject } : {}),
  });
  const { meta } = weightage;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="crt-micro text-[11px] text-(--crt-red)">[ 09 {"///"} WEIGHTAGE-RADAR ]</p>
        <h1 className="crt-macro mt-2 text-[clamp(2.2rem,7vw,5.5rem)] text-(--crt-ink)">
          TRENDS<span className="text-(--crt-red)">.</span>
        </h1>
        <p className="crt-micro mt-3 max-w-2xl text-[10px] leading-relaxed text-(--crt-dim)">
          {meta.fromYear}–{meta.toYear} · <output>{meta.grandTotalMarks}</output> MARKS IN BANK.
          PRIORITIZE THE LAST 60 DAYS BY MARKS, NOT VIBES.
        </p>
        {meta.missingYears.length > 0 ? (
          <p role="note" className="crt-micro mt-2 max-w-2xl border border-(--crt-red) p-3 text-[10px] leading-relaxed text-(--crt-ink)">
            <span className="font-bold text-(--crt-red)">[ COVERAGE GAP ]</span> {meta.note.toUpperCase()}
          </p>
        ) : null}
      </header>

      <nav aria-label="Trend filters" className="flex flex-wrap items-center gap-2">
        <Link
          href="/trends"
          aria-current={!subject ? "page" : undefined}
          className={!subject ? "crt-btn-red !px-3 !py-1 !text-[10px]" : "crt-btn-line !px-3 !py-1 !text-[10px]"}
        >
          ALL SUBJECTS
        </Link>
        {weightage.subjects.map((s) => (
          <Link
            key={s.slug}
            href={`/trends?subject=${s.slug}`}
            aria-current={subject === s.slug ? "page" : undefined}
            className={subject === s.slug ? "crt-btn-red !px-3 !py-1 !text-[10px]" : "crt-btn-line !px-3 !py-1 !text-[10px]"}
          >
            {s.name.toUpperCase()}
          </Link>
        ))}
      </nav>

      {weightage.subjects.length === 0 ? (
        <p className="crt-micro border border-(--crt-line) p-6 text-center text-[11px] text-(--crt-dim)">
          NO PUBLISHED QUESTIONS IN THIS WINDOW YET.
        </p>
      ) : (
        <TrendTable subjects={weightage.subjects} />
      )}

      {weightage.topics.length > 0 ? (
        <section aria-labelledby="topics-heading" className="flex flex-col gap-4">
          <h2 id="topics-heading" className="crt-micro text-[11px] text-(--crt-ink)">
            [ TOP TOPICS BY MARKS ]
          </h2>
          <ol className="grid gap-px border border-(--crt-line) bg-(--crt-line) sm:grid-cols-2">
            {weightage.topics.slice(0, 10).map((t, i) => (
              <li key={`${t.subjectSlug}/${t.slug}`} className="flex items-center justify-between gap-3 bg-(--crt-bg) p-4">
                <p className="text-sm text-(--crt-ink)">
                  <span className="crt-micro mr-2 text-(--crt-dim)">{String(i + 1).padStart(2, "0")}</span>
                  <Link href={t.practicePath} className="underline decoration-(--crt-red) decoration-2 underline-offset-4 hover:text-(--crt-red)">
                    {t.name}
                  </Link>
                  <span className="crt-micro ml-2 text-[9px] text-(--crt-dim)">{t.subjectName.toUpperCase()}</span>
                </p>
                <span className="crt-micro shrink-0 text-[10px] tabular-nums text-(--crt-dim)">
                  {t.totalMarks}M · {t.trend.toUpperCase()}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
