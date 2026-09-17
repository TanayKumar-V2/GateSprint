import Link from "next/link";

export type FilterOptions = {
  subjects: { slug: string; name: string }[];
  topics: { slug: string; name: string; subjectId: string }[];
  years: number[];
  current: Record<string, string>;
};

/**
 * Plain GET form: filters live in the URL, so results are shareable and
 * work without JavaScript. Rendered as a filter-array console: bordered
 * compartment, mono labels, square fields, red APPLY block.
 */
export function PracticeFilters({ options }: { options: FilterOptions }) {
  const { subjects, topics, years, current } = options;
  const uniqueTopics = Array.from(new Map(topics.map((t) => [t.slug, t])).values());
  return (
    <div className="border border-(--crt-line) bg-(--crt-bg)">
      <div className="crt-micro flex items-center justify-between border-b border-(--crt-line) px-4 py-2 text-[10px] text-(--crt-dim) sm:px-5">
        <span>[ FILTER-ARRAY {"///"} QUERY CONSOLE ]</span>
        <Link href="/practice" className="text-(--crt-ink) underline decoration-(--crt-red) decoration-2 underline-offset-4 hover:text-(--crt-red)">
          RESET
        </Link>
      </div>
      <form
        method="get"
        action="/practice"
        className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5 lg:grid-cols-4"
      >
        <label className="flex flex-col gap-1.5">
          <span className="crt-label">Subject</span>
          <select
            name="subject"
            defaultValue={current.subject ?? ""}
            className="crt-field"
          >
            <option value="">ALL SUBJECTS</option>
            {subjects.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="crt-label">Topic</span>
          <select
            name="topic"
            defaultValue={current.topic ?? ""}
            className="crt-field"
          >
            <option value="">ALL TOPICS</option>
            {uniqueTopics.map((t) => (
              <option key={t.slug} value={t.slug}>
                {t.name.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="crt-label">Year</span>
          <select
            name="year"
            defaultValue={current.year ?? ""}
            className="crt-field"
          >
            <option value="">ALL YEARS</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="crt-label">Type</span>
          <select
            name="type"
            defaultValue={current.type ?? ""}
            className="crt-field"
          >
            <option value="">ALL TYPES</option>
            <option value="mcq">MCQ</option>
            <option value="msq">MSQ</option>
            <option value="nat">NAT</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="crt-label">Difficulty</span>
          <select
            name="difficulty"
            defaultValue={current.difficulty ?? ""}
            className="crt-field"
          >
            <option value="">ANY DIFFICULTY</option>
            <option value="easy">EASY</option>
            <option value="medium">MEDIUM</option>
            <option value="hard">HARD</option>
          </select>
        </label>
        <fieldset className="flex items-end gap-5 pb-3">
          <legend className="sr-only">Status</legend>
          <label className="crt-micro flex cursor-pointer items-center gap-2 text-[11px] text-(--crt-ink)">
            <input
              type="checkbox"
              name="attempted"
              value="true"
              defaultChecked={current.attempted === "true"}
              className="crt-check"
            />
            ATTEMPTED
          </label>
          <label className="crt-micro flex cursor-pointer items-center gap-2 text-[11px] text-(--crt-ink)">
            <input
              type="checkbox"
              name="bookmarked"
              value="true"
              defaultChecked={current.bookmarked === "true"}
              className="crt-check"
            />
            SAVED
          </label>
        </fieldset>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
          <button type="submit" className="crt-btn-red flex-1">
            APPLY &gt;&gt;&gt;
          </button>
        </div>
        <input type="hidden" name="page" value="1" readOnly className="hidden" />
      </form>
    </div>
  );
}
