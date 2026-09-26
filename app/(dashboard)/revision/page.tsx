import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/current-user";
import { getDueRevisions } from "@/lib/revision";
import { RevisionQueue } from "@/components/revision/revision-queue";
import { DueCard } from "@/components/revision/due-card";

export default async function RevisionPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/sign-in");

  const { due, upcoming, stats, note } = await getDueRevisions(userId, { limit: 20, page: 1 });

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="crt-micro text-[11px] text-(--crt-red)">[ 06 {"///"} SPACED-QUEUE ]</p>
        <h1 className="crt-macro mt-2 text-[clamp(2.2rem,7vw,5.5rem)] text-(--crt-ink)">
          REVISION<span className="text-(--crt-red)">.</span>
        </h1>
        <p className="crt-micro mt-3 text-[11px] text-(--crt-dim)">
          <output>DUE {stats.dueCount}</output> {" /// "}DONE TODAY {stats.doneToday} {" /// "}LAST 7D {stats.weekDone}
        </p>
      </header>

      <section aria-labelledby="due-heading" className="flex flex-col gap-4">
        <h2 id="due-heading" className="crt-micro text-[11px] text-(--crt-ink)">
          [ DUE TODAY{stats.dueCount > 0 ? ` · ${stats.dueCount}` : ""} ]
        </h2>
        {due.length === 0 ? (
          <div className="border border-(--crt-line) bg-(--crt-bg) p-8 text-center">
            <p className="crt-micro text-[11px] text-(--crt-dim)">
              {(note ?? "ALL CAUGHT UP.").toUpperCase()}
            </p>
            <Link href="/practice" className="crt-btn-red mt-4">
              PRACTICE &gt;&gt;&gt;
            </Link>
          </div>
        ) : (
          <RevisionQueue due={due} />
        )}
      </section>

      {upcoming.length > 0 ? (
        <section aria-labelledby="upcoming-heading" className="flex flex-col gap-4">
          <h2 id="upcoming-heading" className="crt-micro text-[11px] text-(--crt-dim)">
            [ UPCOMING ]
          </h2>
          <ul className="grid gap-px border border-(--crt-line) bg-(--crt-line)">
            {upcoming.slice(0, 10).map((d) => (
              <DueCard key={d.questionId} item={d} isUpcoming />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
