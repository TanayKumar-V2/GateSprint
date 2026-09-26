import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/current-user";
import { getProgress, getRecommendations } from "@/lib/progress";
import {
  BreakdownTable,
  RecommendationCard,
} from "@/components/progress/cards";
import { ProgressTabs } from "@/components/progress/tabs";
import { Reveal } from "@/components/motion/reveal";
import { ProgressCharts } from "@/components/progress/charts";

function pct(accuracy: number | null): string {
  return accuracy === null ? "—" : `${Math.round(accuracy * 100)}%`;
}

/**
 * Static accuracy ring: one SVG circle, no animation, no library.
 * Phosphor readout, red sweep, dark track.
 */
function AccuracyRing({ accuracy }: { accuracy: number | null }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const fraction = accuracy ?? 0;
  return (
    <div
      role="img"
      aria-label={accuracy === null ? "No attempts yet" : `Accuracy ${pct(accuracy)}`}
      className="relative grid size-32 shrink-0 place-items-center"
    >
      <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          style={{ stroke: "var(--crt-line)" }}
          strokeWidth="10"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          style={{ stroke: "var(--crt-red)" }}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
        />
      </svg>
      <span className="crt-macro text-2xl tabular-nums text-(--crt-ink)">
        {pct(accuracy)}
      </span>
    </div>
  );
}

export default async function ProgressPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/sign-in");

  const progress = await getProgress(userId);
  const recs = await getRecommendations(userId, { limit: 6 });
  const { overall } = progress;

  if (overall.attempts === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <header>
          <p className="crt-micro text-[11px] text-(--crt-red)">[ 03 {"///"} TELEMETRY ]</p>
          <h1 className="crt-macro mt-2 text-[clamp(2.2rem,7vw,5rem)] text-(--crt-ink)">
            PROGRESS<span className="text-(--crt-red)">.</span>
          </h1>
          <p className="crt-micro mt-3 text-[11px] text-(--crt-dim)">
            NOTHING ATTEMPTED YET — STATS BUILD AS YOU PRACTICE.
          </p>
        </header>
        {recs.data.length > 0 ? (
          <section aria-labelledby="starter-heading" className="flex flex-col gap-4">
            <h2 id="starter-heading" className="crt-micro text-[11px] text-(--crt-ink)">
              [ WHERE TO BEGIN ]
            </h2>
            <ul className="grid gap-4 md:grid-cols-2">
              {recs.data.map((r, i) => (
                <Reveal as="li" key={r.questionId} delay={(i % 4) * 70}>
                  <RecommendationCard rec={r} />
                </Reveal>
              ))}
            </ul>
          </section>
        ) : (
          <Link
            href="/practice"
            className="crt-btn-red self-start"
          >
            BROWSE QUESTIONS &gt;&gt;&gt;
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <ProgressTabs active="overview" />
      <section
        aria-label="Overall"
        className="border border-(--crt-line) bg-(--crt-bg)"
      >
        <p className="crt-micro border-b border-(--crt-line) px-5 py-2 text-[10px] text-(--crt-dim) sm:px-7">
          [ 03 {"///"} TELEMETRY {"///"} OPERATOR OVERALL ]
        </p>
        <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:gap-8 sm:p-7">
          <div className="flex shrink-0 items-center gap-5">
            <AccuracyRing accuracy={overall.accuracy} />
            <div>
              <h1 className="crt-macro text-[clamp(2rem,5vw,3.2rem)] text-(--crt-ink)">PROGRESS<span className="text-(--crt-red)">.</span></h1>
              <p className="crt-micro mt-2 max-w-xs text-[10px] leading-relaxed text-(--crt-dim)">
                BUILT ONLY FROM YOUR OWN ATTEMPTS — NOTHING ESTIMATED.
              </p>
            </div>
          </div>
          <dl className="grid flex-1 grid-cols-3 gap-px border border-(--crt-line) bg-(--crt-line)">
            <div className="min-w-0 bg-(--crt-bg) p-3 sm:p-4">
              <dt className="crt-label">Attempts</dt>
              <dd className="crt-macro mt-1 text-2xl tabular-nums text-(--crt-ink) sm:text-3xl">
                {overall.attempts}
              </dd>
            </div>
            <div className="min-w-0 bg-(--crt-bg) p-3 sm:p-4">
              <dt className="crt-label">Tried</dt>
              <dd className="crt-macro mt-1 text-2xl tabular-nums text-(--crt-ink) sm:text-3xl">
                {overall.attemptedQuestions}
                <span className="text-sm text-(--crt-dim) sm:text-lg">
                  /{overall.totalQuestions}
                </span>
              </dd>
            </div>
            <div className="min-w-0 bg-(--crt-bg) p-3 sm:p-4">
              <dt className="crt-label">Weak</dt>
              <dd className="crt-macro mt-1 text-2xl tabular-nums text-(--crt-red) sm:text-3xl">
                {progress.weakTopics.length}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {recs.data.length > 0 && recs.data[0] ? (
        <section aria-labelledby="priority-heading" className="flex flex-col gap-4">
          <h2 id="priority-heading" className="crt-micro text-[11px] text-(--crt-ink)">
            [ PRIORITY ACTION ]
          </h2>
          <div className="border border-(--crt-red) bg-(--crt-red)/5 p-5 sm:p-7">
            <h3 className="text-xl font-bold uppercase text-(--crt-ink)">
              START NEXT SESSION &gt;&gt;&gt;
            </h3>
            <p className="crt-micro mt-2 text-[11px] text-(--crt-dim)">
              {recs.data[0]!.subject.name.toUpperCase()} /// {recs.data[0]!.topic.name.toUpperCase()}
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Link href={recs.data[0]!.practicePath} className="crt-btn-red !px-8 !py-3">
                PRACTICE NOW
              </Link>
              <Link href={recs.data[0]!.revisePath} className="crt-btn-line !px-8 !py-3">
                MENTOR REVIEW
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <ProgressCharts activity={progress.activity} subjects={progress.subjects} />

      <section aria-labelledby="next-heading" className="flex flex-col gap-4">
        <h2 id="next-heading" className="crt-micro text-[11px] text-(--crt-ink)">
          [ RECOMMENDED NEXT ]
        </h2>
        {recs.data.length <= 1 ? (
          <p className="crt-micro text-[11px] text-(--crt-dim)">
            {(recs.note ?? "ALL CAUGHT UP.").toUpperCase()}
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {recs.data.slice(1).map((r, i) => (
              <Reveal as="li" key={r.questionId} delay={(i % 4) * 70}>
                <RecommendationCard rec={r} />
              </Reveal>
            ))}
          </ul>
        )}
      </section>

      {progress.weakTopics.length > 0 ? (
        <section aria-labelledby="weak-heading" className="flex flex-col gap-4">
          <h2 id="weak-heading" className="crt-micro text-[11px] text-(--crt-red)">
            [ WEAK TOPICS {"///"} PATCH QUEUE ]
          </h2>
          <ul className="grid gap-px border border-(--crt-line) bg-(--crt-line)">
            {progress.weakTopics.map((t) => (
              <li
                key={`${t.subjectSlug}/${t.topicSlug}`}
                className="flex flex-wrap items-center justify-between gap-3 bg-(--crt-bg) p-4"
              >
                <div>
                  <p className="text-sm font-bold uppercase tracking-tight text-(--crt-ink)">
                    {t.subjectName} {"///"} {t.topicName}
                  </p>
                  <p className="crt-micro mt-1 text-[10px] text-(--crt-dim)">
                    {(t.weakReason ?? "Needs work").toUpperCase()}
                  </p>
                </div>
                <Link
                  href={`/practice?subject=${t.subjectSlug}&topic=${t.topicSlug}`}
                  className="crt-btn-line !px-4 !py-2 !text-[11px]"
                >
                  DRILL &gt;&gt;&gt;
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="boc-subject" className="flex flex-col gap-4">
        <h2 id="boc-subject" className="crt-micro text-[11px] text-(--crt-ink)">
          [ BY SUBJECT ]
        </h2>
        <BreakdownTable
          caption="Accuracy by subject"
          rows={progress.subjects.map((s) => ({
            slug: s.slug,
            name: s.name,
            attempts: s.attempts,
            accuracy: s.accuracy,
            detail: `${s.attemptedQuestions} / ${s.totalQuestions} questions`,
            href: `/practice?subject=${s.slug}`,
            isWeak: progress.weakTopics.some(w => w.subjectSlug === s.slug)
          }))}
        />
      </section>

      <section aria-labelledby="boc-topic" className="flex flex-col gap-4">
        <h2 id="boc-topic" className="crt-micro text-[11px] text-(--crt-ink)">
          [ BY TOPIC ]
        </h2>
        <BreakdownTable
          caption="Accuracy by topic"
          rows={progress.topics.map((t) => ({
            slug: `${t.subjectSlug}/${t.topicSlug}`,
            name: `${t.subjectName} · ${t.topicName}`,
            attempts: t.attempts,
            accuracy: t.accuracy,
            detail: `${t.attempts} attempts · ${t.totalQuestions} questions`,
            href: `/practice?subject=${t.subjectSlug}&topic=${t.topicSlug}`,
            isWeak: progress.weakTopics.some(w => w.topicSlug === t.topicSlug && w.subjectSlug === t.subjectSlug)
          }))}
        />
      </section>
    </div>
  );
}
