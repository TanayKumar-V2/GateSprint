"use client";

import Link from "next/link";
import { useState } from "react";

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
 *
 * On phones the form hides behind a FILTER toggle (checkbox + peer, so
 * it still works with JS disabled); on sm+ it is always visible.
 */
export function PracticeFilters({ options }: { options: FilterOptions }) {
  const { subjects, topics, years, current } = options;
  const [subject, setSubject] = useState(current.subject ?? "");
  const [topic, setTopic] = useState(current.topic ?? "");
  
  const activeCount = Object.entries(current).filter(
    ([key, value]) => key !== "page" && value !== "",
  ).length;

  const relevantTopics = subject ? topics.filter(t => t.subjectId === subject) : topics;
  const uniqueTopics = Array.from(new Map(relevantTopics.map((t) => [t.slug, t])).values());

  return (
    <div className="border border-(--crt-line) bg-(--crt-bg)">
      <input
        id="filter-array-toggle"
        type="checkbox"
        className="peer sr-only"
      />
      <div className="crt-micro flex items-center justify-between gap-3 border-b border-(--crt-line) px-4 py-2 text-[10px] text-(--crt-dim) sm:px-5">
        <span>[ FILTER-ARRAY {"///"} QUERY CONSOLE ]</span>
        <span className="flex items-center gap-4">
          <label
            htmlFor="filter-array-toggle"
            className="cursor-pointer text-(--crt-ink) underline decoration-(--crt-red) decoration-2 underline-offset-4 hover:text-(--crt-red) sm:hidden"
          >
            {activeCount > 0 ? `[ FILTERS · ${activeCount} ]` : "[ FILTERS ]"}
          </label>
          <span className="hidden sm:inline">
            {activeCount > 0 ? `[ FILTERS · ${activeCount} ACTIVE ]` : "[ FILTERS ]"}
          </span>
          <Link href="/practice" className="text-(--crt-ink) underline decoration-(--crt-red) decoration-2 underline-offset-4 hover:text-(--crt-red)">
            RESET
          </Link>
        </span>
      </div>
      <form
        method="get"
        action="/practice"
        className="hidden gap-4 p-4 peer-checked:grid sm:grid sm:grid-cols-3 sm:p-5 lg:grid-cols-5"
      >
        <label className="flex flex-col gap-1.5">
          <span className="crt-label">Subject</span>
          <select
            name="subject"
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setTopic("");
            }}
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
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
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
        <label className="flex flex-col gap-1.5">
          <span className="crt-label">Attempt Status</span>
          <select
            name="attempted"
            defaultValue={current.attempted ?? ""}
            className="crt-field"
          >
            <option value="">ALL STATUS</option>
            <option value="true">ATTEMPTED ONLY</option>
            <option value="false">UNATTEMPTED ONLY</option>
          </select>
        </label>
        <fieldset className="flex items-end gap-5 pb-3">
          <legend className="sr-only">Status</legend>
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
