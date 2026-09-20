import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/current-user";
import {
  listPublishedYears,
  listQuestions,
  listSubjects,
  listTopics,
} from "@/lib/questions";
import { listQuerySchema } from "@/lib/validation/answers";
import { PracticeFilters } from "@/components/practice/filters";
import { QuestionCard } from "@/components/practice/question-card";
import { Reveal } from "@/components/motion/reveal";

export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await currentUserId();
  if (!userId) redirect("/sign-in");

  const raw = await searchParams;
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string" && v !== "") flat[k] = v;
  }
  const parsed = listQuerySchema.safeParse(flat);
  const filter = parsed.success
    ? parsed.data
    : { page: 1, limit: 20 as const };

  const [list, subjects, topics, years] = await Promise.all([
    listQuestions(userId, filter),
    listSubjects(),
    listTopics(flat.subject),
    listPublishedYears(),
  ]);

  const pageHref = (page: number) => {
    const params = new URLSearchParams({ ...flat, page: String(page) });
    return `/practice?${params.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="crt-micro text-[11px] text-(--crt-red)">[ 01 {"///"} QUESTION BANK ]</p>
        <h1 className="crt-macro mt-2 text-[clamp(2.2rem,7vw,5.5rem)] text-(--crt-ink)">
          PRACTICE<span className="text-(--crt-red)">.</span>
        </h1>
        <p className="crt-micro mt-3 text-[11px] text-(--crt-dim)">
          <output>
            {list.total} UNIT{list.total === 1 ? "" : "S"}
            {list.total > 0 ? ` · PAGE ${list.page} / ${list.totalPages}` : ""}
          </output>
          {" /// "}SERVER-VALIDATED ATTEMPTS
        </p>
      </header>

      <PracticeFilters
        options={{ subjects, topics, years, current: flat }}
      />

      {list.data.length === 0 ? (
        <div className="border border-(--crt-line) bg-(--crt-bg) p-8 text-center sm:p-12">
          <p className="crt-macro text-[clamp(1.4rem,4vw,2.2rem)] text-(--crt-ink)">
            ZERO HITS<span className="text-(--crt-red)">.</span>
          </p>
          <p className="crt-micro mt-3 text-[11px] leading-relaxed text-(--crt-dim)">
            NO QUESTIONS MATCH THOSE FILTERS — LOOSEN A FILTER OR TWO.
          </p>
          <Link href="/practice" className="crt-btn-line mt-6">
            CLEAR FILTERS
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {list.data.map((q, i) => (
            <Reveal as="li" key={q.id} delay={(i % 6) * 60}>
              <QuestionCard question={q} />
            </Reveal>
          ))}
        </ul>
      )}

      {list.totalPages > 1 ? (
        <nav aria-label="Pages" className="crt-micro flex flex-wrap items-center gap-3 text-[11px]">
          {list.page > 1 ? (
            <Link
              href={pageHref(list.page - 1)}
              className="border border-(--crt-edge) px-4 py-2.5 text-(--crt-ink) transition-colors hover:bg-(--crt-ink) hover:text-(--crt-bg)"
            >
              &lt;&lt;&lt; PREV
            </Link>
          ) : null}
          <span className="text-(--crt-dim)" aria-current="page">
            PAGE {list.page} / {list.totalPages}
          </span>
          {list.page < list.totalPages ? (
            <Link
              href={pageHref(list.page + 1)}
              className="border border-(--crt-edge) px-4 py-2.5 text-(--crt-ink) transition-colors hover:bg-(--crt-ink) hover:text-(--crt-bg)"
            >
              NEXT &gt;&gt;&gt;
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
