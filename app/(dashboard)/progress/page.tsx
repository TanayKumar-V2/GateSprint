import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/current-user";
import { getProgress, getRecommendations } from "@/lib/progress";
import {
  BreakdownTable,
  MetricCard,
  RecommendationCard,
} from "@/components/progress/cards";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function pct(accuracy: number | null): string {
  return accuracy === null ? "—" : `${Math.round(accuracy * 100)}%`;
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
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Nothing attempted yet — your stats will build as you practice.
          </p>
        </div>
        {recs.data.length > 0 ? (
          <section aria-labelledby="starter-heading" className="flex flex-col gap-4">
            <h2 id="starter-heading" className="text-lg font-semibold">
              Where to begin
            </h2>
            <ul className="grid gap-4 md:grid-cols-2">
              {recs.data.map((r) => (
                <li key={r.questionId}>
                  <RecommendationCard rec={r} />
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <Link
            href="/practice"
            className={cn(buttonVariants(), "self-start")}
          >
            Browse questions
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Built only from your own attempts — nothing here is estimated.
        </p>
      </div>

      <section
        aria-label="Overall"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <MetricCard label="Attempts" value={String(overall.attempts)} />
        <MetricCard label="Accuracy" value={pct(overall.accuracy)} />
        <MetricCard
          label="Questions tried"
          value={`${overall.attemptedQuestions} / ${overall.totalQuestions}`}
        />
        <MetricCard
          label="Weak topics"
          value={String(progress.weakTopics.length)}
          hint={
            progress.weakTopics.length > 0
              ? "Under 60% across 3+ attempts, or repeated early misses."
              : "Nothing weak right now. Nice."
          }
        />
      </section>

      <section aria-labelledby="next-heading" className="flex flex-col gap-4">
        <h2 id="next-heading" className="text-lg font-semibold">
          Recommended next
        </h2>
        {recs.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {recs.note ?? "All caught up."}
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {recs.data.map((r) => (
              <li key={r.questionId}>
                <RecommendationCard rec={r} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {progress.weakTopics.length > 0 ? (
        <section aria-labelledby="weak-heading" className="flex flex-col gap-4">
          <h2 id="weak-heading" className="text-lg font-semibold">
            Weak topics
          </h2>
          <ul className="flex flex-col gap-2">
            {progress.weakTopics.map((t) => (
              <li
                key={`${t.subjectSlug}/${t.topicSlug}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-4"
              >
                <div>
                  <p className="font-medium">
                    {t.subjectName} · {t.topicName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t.weakReason}
                  </p>
                </div>
                <Link
                  href={`/practice?subject=${t.subjectSlug}&topic=${t.topicSlug}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Practice →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="boc-subject" className="flex flex-col gap-4">
        <h2 id="boc-subject" className="text-lg font-semibold">
          By subject
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
          }))}
        />
      </section>

      <section aria-labelledby="boc-topic" className="flex flex-col gap-4">
        <h2 id="boc-topic" className="text-lg font-semibold">
          By topic
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
          }))}
        />
      </section>
    </div>
  );
}
