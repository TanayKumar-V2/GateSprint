import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/current-user";
import { listPublishedYears, listQuestions, listSubjects, listTopics } from "@/lib/questions";
import { listQuerySchema } from "@/lib/validation/answers";
import { PracticeFilters } from "@/components/practice/filters";
import { QuestionCard } from "@/components/practice/question-card";
import { Reveal } from "@/components/motion/reveal";

function getPages(current: number, total: number) {
  const pages: (number | "...")[] = [];
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push("...");
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push("...");
    pages.push(total);
  }
  return pages;
}

export default async function BookmarksPage({
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
    listQuestions(userId, { ...filter, bookmarked: true }),
    listSubjects(),
    listTopics(flat.subject),
    listPublishedYears(),
  ]);

  const pageHref = (page: number) => {
    const params = new URLSearchParams({ ...flat, page: String(page) });
    return `/bookmarks?${params.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="crt-micro text-[11px] text-(--crt-red)">[ 04 {"///"} SAVED-BUFFER ]</p>
        <h1 className="crt-macro mt-2 text-[clamp(2.2rem,7vw,5.5rem)] text-(--crt-ink)">
          SAVED<span className="text-(--crt-red)">.</span>
        </h1>
        <p className="crt-micro mt-3 text-[11px] text-(--crt-dim)">
          <output>
            {list.total} UNIT{list.total === 1 ? "" : "S"} IN BUFFER
            {list.total > 0 ? ` · PAGE ${list.page} / ${list.totalPages}` : ""}
          </output>
          {" /// "}KILL-LIST FOR REVISION
        </p>
      </header>

      <PracticeFilters
        options={{ subjects, topics, years, current: flat }}
      />

      {list.data.length === 0 ? (
        <div className="border border-(--crt-line) bg-(--crt-bg) p-8 text-center sm:p-12">
          <p className="crt-macro text-[clamp(1.4rem,4vw,2.2rem)] text-(--crt-ink)">
            BUFFER EMPTY<span className="text-(--crt-red)">.</span>
          </p>
          {Object.keys(flat).length > 0 ? (
            <>
              <div className="crt-micro mt-4 flex flex-wrap justify-center gap-2 text-[11px] text-(--crt-dim)">
                {Object.entries(flat).map(([k, v]) => k !== "page" ? (
                  <span key={k} className="border border-(--crt-edge) px-2 py-1 uppercase">
                    {k}: {v}
                  </span>
                ) : null)}
              </div>
              <p className="crt-micro mt-4 text-[11px] leading-relaxed text-(--crt-dim)">
                NO BOOKMARKS MATCH THESE FILTERS.
              </p>
              <Link href="/bookmarks" className="crt-btn-line mt-6">
                CLEAR FILTERS
              </Link>
            </>
          ) : (
            <>
              <p className="crt-micro mt-3 text-[11px] leading-relaxed text-(--crt-dim)">
                SAVE TRICKY QUESTIONS WHILE SOLVING TO REVISIT THEM HERE.
              </p>
              <Link href="/practice" className="crt-btn-red mt-6">
                FIND QUESTIONS &gt;&gt;&gt;
              </Link>
            </>
          )}
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {list.data.map((q, i) => (
            <Reveal as="li" key={q.id} delay={(i % 6) * 60}>
              <QuestionCard question={q} href={`/practice/${q.id}?${new URLSearchParams(flat).toString()}`} />
            </Reveal>
          ))}
        </ul>
      )}

      {list.totalPages > 1 ? (
        <nav aria-label="Pagination" className="crt-micro flex flex-wrap items-center gap-2 text-[11px]">
          {list.page > 1 ? (
            <Link href={pageHref(list.page - 1)} rel="prev" scroll={true} className="border border-(--crt-edge) px-3 py-2 transition-colors hover:border-(--crt-red) hover:text-(--crt-red)">&lt; PREV</Link>
          ) : <span className="border border-transparent px-3 py-2 opacity-50 text-(--crt-dim)">&lt; PREV</span>}
          {getPages(list.page, list.totalPages).map((p, i) => (
            p === "..." ? <span key={`dots-${i}`} className="px-2 py-2 text-(--crt-dim)">...</span> :
            <Link
              key={p}
              href={pageHref(p as number)}
              scroll={true}
              aria-current={p === list.page ? "page" : undefined}
              className={`border px-3 py-2 transition-colors ${p === list.page ? "border-(--crt-red) bg-(--crt-red) text-(--crt-bg)" : "border-(--crt-edge) text-(--crt-ink) hover:border-(--crt-red) hover:text-(--crt-red)"}`}
            >
              {p}
            </Link>
          ))}
          {list.page < list.totalPages ? (
            <Link href={pageHref(list.page + 1)} rel="next" scroll={true} className="border border-(--crt-edge) px-3 py-2 transition-colors hover:border-(--crt-red) hover:text-(--crt-red)">NEXT &gt;</Link>
          ) : <span className="border border-transparent px-3 py-2 opacity-50 text-(--crt-dim)">NEXT &gt;</span>}
        </nav>
      ) : null}
    </div>
  );
}
