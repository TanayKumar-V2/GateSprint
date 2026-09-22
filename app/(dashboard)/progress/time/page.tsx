import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/current-user";
import { getTimeAnalytics } from "@/lib/time-analytics";
import { ProgressTabs } from "@/components/progress/tabs";
import { TimeScatter } from "@/components/progress/time-scatter";
import { TimeTable, formatSeconds } from "@/components/progress/time-table";

const THRESHOLDS =
  "RUSHED: WRONG UNDER 30S · OVERTIME: WRONG PAST MAX(180S, 3× PEER MEDIAN) · SLOW+CORRECT: RIGHT PAST MAX(180S, 2× MEDIAN)";

export default async function ProgressTimePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await currentUserId();
  if (!userId) redirect("/sign-in");

  const sp = await searchParams;
  const subject = typeof sp.subject === "string" && sp.subject ? sp.subject : undefined;
  const { bySubject, byTopic, flags } = await getTimeAnalytics(userId, { subject });
  const flagged = flags.filter((f) => f.flag !== "ok");
  const timed = flags.length;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="crt-micro text-[11px] text-(--crt-red)">[ 03 {"///"} TELEMETRY {"///"} PACE ]</p>
        <h1 className="crt-macro mt-2 text-[clamp(2.2rem,7vw,3.2rem)] text-(--crt-ink)">
          SPEED VS ACCURACY<span className="text-(--crt-red)">.</span>
        </h1>
        <p className="crt-micro mt-3 max-w-xl text-[10px] leading-relaxed text-(--crt-dim)" title={THRESHOLDS}>
          ACCURACY WITHOUT PACE FAILS IN GATE. THRESHOLDS: {THRESHOLDS}
        </p>
      </header>

      <ProgressTabs active="time" />

      {timed === 0 ? (
        <div className="border border-(--crt-line) bg-(--crt-bg) p-8 text-center sm:p-12">
          <p className="crt-macro text-[clamp(1.4rem,4vw,2.2rem)] text-(--crt-ink)">NO TIMED ATTEMPTS.</p>
          <p className="crt-micro mt-3 text-[11px] leading-relaxed text-(--crt-dim)">
            TIMES RECORD WHEN YOU SUBMIT FROM PRACTICE. UNTIL THEN — NO PACE DATA, NO GUESSES.
          </p>
          <Link href="/practice" className="crt-btn-red mt-6">
            PRACTICE &gt;&gt;&gt;
          </Link>
        </div>
      ) : (
        <>
          {bySubject.length > 1 ? (
            <nav aria-label="Filter by subject" className="flex flex-wrap gap-2">
              <Link
                href="/progress/time"
                aria-current={subject ? undefined : "page"}
                className={!subject ? "crt-btn-red !px-3 !py-1 !text-[10px]" : "crt-btn-line !px-3 !py-1 !text-[10px]"}
              >
                ALL
              </Link>
              {bySubject.map((s) => (
                <Link
                  key={s.subjectSlug}
                  href={`/progress/time?subject=${s.subjectSlug}`}
                  aria-current={subject === s.subjectSlug ? "page" : undefined}
                  className={subject === s.subjectSlug ? "crt-btn-red !px-3 !py-1 !text-[10px]" : "crt-btn-line !px-3 !py-1 !text-[10px]"}
                >
                  {s.subjectName.toUpperCase()}
                </Link>
              ))}
            </nav>
          ) : null}

          <section aria-labelledby="avg-heading" className="flex flex-col gap-4">
            <h2 id="avg-heading" className="crt-micro text-[11px] text-(--crt-ink)">
              [ AVG SECONDS PER QUESTION ]
            </h2>
            <ul className="grid gap-px border border-(--crt-line) bg-(--crt-line) sm:grid-cols-2">
              {bySubject.map((s) => (
                <li key={s.subjectSlug} className="flex items-baseline justify-between gap-3 bg-(--crt-bg) p-4">
                  <span className="text-sm font-bold uppercase tracking-tight text-(--crt-ink)">{s.subjectName}</span>
                  <span className="crt-micro text-[11px] tabular-nums text-(--crt-dim)">
                    AVG <span className="text-(--crt-ink)">{formatSeconds(s.avgSeconds)}</span>
                    {" /// "}MED <span className="text-(--crt-ink)">{formatSeconds(s.medianSeconds)}</span>
                    {" /// "}{s.attempts}N
                  </span>
                </li>
              ))}
            </ul>
            {byTopic.length > 0 ? (
              <details className="crt-micro border border-(--crt-line) p-4 text-[11px]">
                <summary className="w-fit cursor-pointer text-(--crt-dim) hover:text-(--crt-red)">
                  BY TOPIC [{byTopic.length}] [+]
                </summary>
                <ul className="mt-3 grid gap-x-6 gap-y-2 tabular-nums sm:grid-cols-2">
                  {byTopic.map((t) => (
                    <li key={`${t.subjectSlug}/${t.topicSlug}`} className="flex justify-between gap-3 border-t border-(--crt-line) py-2">
                      <span className="text-(--crt-dim)">{t.topicName.toUpperCase()}</span>
                      <span className="shrink-0 text-(--crt-ink)">
                        {formatSeconds(t.avgSeconds)} AVG · {t.attempts}N
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>

          <section aria-labelledby="scatter-heading" className="flex flex-col gap-4">
            <h2 id="scatter-heading" className="crt-micro text-[11px] text-(--crt-ink)">
              [ TIME VS CORRECTNESS · {timed} TIMED ]
            </h2>
            <TimeScatter
              points={flags.map((f) => ({ yourSeconds: f.yourSeconds, isCorrect: f.isCorrect, flag: f.flag }))}
            />
          </section>

          <section aria-labelledby="flags-heading" className="flex flex-col gap-4">
            <h2 id="flags-heading" className="crt-micro text-[11px] text-(--crt-red)">
              [ PACE FLAGS {"///"} {flagged.length} ]
            </h2>
            {flagged.length === 0 ? (
              <p className="crt-micro border border-(--crt-line) p-6 text-center text-[11px] text-(--crt-dim)">
                NO RUSHED OR OVERTIME MISSES IN THIS SET. STEADY HANDS.
              </p>
            ) : (
              <TimeTable rows={flagged} />
            )}
          </section>
        </>
      )}
    </div>
  );
}
