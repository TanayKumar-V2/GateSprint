import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/current-user";
import { getMistakeStats, listMistakes } from "@/lib/mistakes";
import { MistakeFilters } from "@/components/mistakes/mistake-filters";
import { MistakeTable } from "@/components/mistakes/mistake-table";
import type { MistakeTag } from "@/lib/validation/extension";

export default async function MistakesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await currentUserId();
  if (!userId) redirect("/sign-in");

  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const rawTag = get("tag") ?? "";
  const validTags = new Set(["", "concept_gap", "silly_mistake", "trap", "time_pressure", "unattempted"]);
  const tagValue = validTags.has(rawTag) ? rawTag : "";
  const resolvedParam = get("resolved");
  const resolved = resolvedParam === "true" ? true : resolvedParam === "false" ? false : undefined;
  const page = Math.max(1, Number(get("page") ?? 1) || 1);

  const { data, total, totalPages, page: current } = await listMistakes(userId, {
    tag: (tagValue || undefined) as MistakeTag | undefined,
    resolved,
    page,
    limit: 20,
  });
  const stats = await getMistakeStats(userId);

  const qs = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (tagValue) p.set("tag", tagValue);
    if (resolved !== undefined) p.set("resolved", String(resolved));
    for (const [k, v] of Object.entries(extra)) {
      if (k === "tag" && v === "") p.delete("tag");
      else if (k === "resolved" && !(v === "true" || v === "false")) p.delete("resolved");
      else p.set(k, v);
    }
    // When switching tag/resolved filters the caller passes page=1; when
    // paginating it passes the new page. Drop the redundant tag key.
    const s = p.toString();
    return s ? `/mistakes?${s}` : "/mistakes";
  };

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="crt-micro text-[11px] text-(--crt-red)">[ 05 {"///"} MISTAKE-BOOK ]</p>
        <h1 className="crt-macro mt-2 text-[clamp(2.2rem,7vw,5.5rem)] text-(--crt-ink)">
          MISTAKES<span className="text-(--crt-red)">.</span>
        </h1>
        <p className="crt-micro mt-3 text-[11px] text-(--crt-dim)">
          <output>{stats.open} OPEN</output> {" /// "}AUTO-FILED FROM WRONG ATTEMPTS — NOTHING HAND-MADE
        </p>
      </header>

      <MistakeFilters activeTag={tagValue} resolved={resolved} hrefFor={qs} />

      {data.length === 0 ? (
        <div className="border border-(--crt-line) bg-(--crt-bg) p-8 text-center sm:p-12">
          <p className="crt-macro text-[clamp(1.4rem,4vw,2.2rem)] text-(--crt-ink)">
            {total === 0 && stats.open === 0 ? "NO MISSES LOGGED." : "NOTHING HERE."}
          </p>
          <p className="crt-micro mt-3 text-[11px] leading-relaxed text-(--crt-dim)">
            {stats.open === 0
              ? "WRONG ANSWERS LAND HERE AUTOMATICALLY — KEEP PRACTICING."
              : "TRY A DIFFERENT FILTER."}
          </p>
          <Link href="/practice" className="crt-btn-red mt-6">
            PRACTICE &gt;&gt;&gt;
          </Link>
        </div>
      ) : (
        <>
          <MistakeTable rows={data} />
          <nav aria-label="Pagination" className="crt-micro flex items-center gap-3 text-[11px] text-(--crt-dim)">
            <span>
              PAGE {current} / {totalPages} · {total} TOTAL
            </span>
            {current > 1 ? (
              <Link href={qs({ page: String(current - 1) })} className="crt-btn-line !px-3 !py-1 !text-[10px]">
                ← PREV
              </Link>
            ) : null}
            {current < totalPages ? (
              <Link href={qs({ page: String(current + 1) })} className="crt-btn-line !px-3 !py-1 !text-[10px]">
                NEXT →
              </Link>
            ) : null}
          </nav>
        </>
      )}
    </div>
  );
}
