"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type FilterOptions = {
  subjects: { slug: string; name: string }[];
  topics: { slug: string; name: string; subjectId: string }[];
};

export function PoolCounter({
  query,
  count,
  onCount,
}: {
  query: string;
  count: number;
  onCount: (count: number) => void;
}) {
  const [live, setLive] = useState<number | null>(null);
  const [marks, setMarks] = useState<number | null>(null);
  const [suggested, setSuggested] = useState<number | null>(null);

  useEffect(() => {
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/test-builder/pool?${query}`);
        if (!res.ok) {
          setLive(null);
          return;
        }
        const data = (await res.json()) as {
          count: number;
          totalMarks: number;
          suggestedDurationSeconds: number;
        };
        setLive(data.count);
        setMarks(data.totalMarks);
        setSuggested(data.suggestedDurationSeconds);
        onCount(data.count);
      } catch {
        setLive(null);
      }
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const show = live ?? count;
  return (
    <p className="crt-micro text-[11px] tabular-nums text-(--crt-dim)" aria-live="polite">
      POOL <output className="text-(--crt-ink)">{show}</output> GRADED
      {marks !== null ? (
        <>
          {" /// "}≈<output className="text-(--crt-ink)">{marks}</output> MARKS
        </>
      ) : null}
      {suggested !== null ? (
        <>
          {" /// "}SUGGESTED <output className="text-(--crt-ink)">{Math.round(suggested / 60)} MIN</output>
        </>
      ) : null}
    </p>
  );
}

export function TestBuilderForm({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const [subjects, setSubjects] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState("");
  const [qtype, setQtype] = useState("");
  const [count, setCount] = useState(15);
  const [poolCount, setPoolCount] = useState(0);
  const [minutes, setMinutes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = new URLSearchParams();
  if (subjects.length) query.set("subjects", subjects.join(","));
  if (topics.length) query.set("topics", topics.join(","));
  if (difficulty) query.set("difficulty", difficulty);
  if (qtype) query.set("type", qtype);
  const queryString = query.toString();

  function toggle(list: string[], slug: string, set: (v: string[]) => void) {
    set(list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug]);
  }

  async function generate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { totalQuestions: count };
      if (subjects.length) body.subjectSlugs = subjects;
      if (topics.length) body.topicSlugs = topics;
      if (difficulty) body.difficulty = difficulty;
      if (qtype) body.type = qtype;
      if (minutes.trim() !== "") {
        const secs = Math.round(Number(minutes) * 60);
        if (!Number.isFinite(secs) || secs < 300 || secs > 10800) {
          setError("Time must be 5–180 minutes.");
          return;
        }
        body.durationSeconds = secs;
      }
      const res = await fetch("/api/test-builder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        practicePath?: string;
        error?: { message: string; available?: number };
      };
      if (!res.ok || !data.practicePath) {
        setError(
          data.error?.available !== undefined
            ? `${data.error.message} (available: ${data.error.available})`
            : (data.error?.message ?? "Couldn't build the test."),
        );
        return;
      }
      router.push(data.practicePath);
    } catch {
      setError("Network hiccup — try again.");
    } finally {
      setBusy(false);
    }
  }

  const topicOptions = options.topics.slice(0, 60);

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="bb-subject" className="border border-(--crt-line) bg-(--crt-bg) p-4 sm:p-5">
        <h2 id="bb-subject" className="crt-micro text-[11px] text-(--crt-ink)">[ SUBJECTS ]</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {options.subjects.map((s) => (
            <button
              key={s.slug}
              type="button"
              aria-pressed={subjects.includes(s.slug)}
              onClick={() => toggle(subjects, s.slug, setSubjects)}
              className={subjects.includes(s.slug) ? "crt-btn-red !px-3 !py-1.5 !text-[10px]" : "crt-btn-line !px-3 !py-1.5 !text-[10px]"}
            >
              {s.name.toUpperCase()}
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="bb-topic" className="border border-(--crt-line) bg-(--crt-bg) p-4 sm:p-5">
        <h2 id="bb-topic" className="crt-micro text-[11px] text-(--crt-ink)">[ TOPICS · FIRST 60 ]</h2>
        <div className="mt-3 flex max-h-48 flex-wrap gap-2 overflow-auto">
          {topicOptions.map((t) => (
            <button
              key={t.slug}
              type="button"
              aria-pressed={topics.includes(t.slug)}
              onClick={() => toggle(topics, t.slug, setTopics)}
              className={topics.includes(t.slug) ? "crt-btn-red !px-3 !py-1.5 !text-[10px]" : "crt-btn-line !px-3 !py-1.5 !text-[10px]"}
            >
              {t.name.toUpperCase()}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 border border-(--crt-line) bg-(--crt-bg) p-4">
          <span className="crt-micro text-[11px] text-(--crt-ink)">DIFFICULTY</span>
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="crt-field">
            <option value="">ANY</option>
            <option value="easy">EASY</option>
            <option value="medium">MEDIUM</option>
            <option value="hard">HARD</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 border border-(--crt-line) bg-(--crt-bg) p-4">
          <span className="crt-micro text-[11px] text-(--crt-ink)">TYPE</span>
          <select value={qtype} onChange={(e) => setQtype(e.target.value)} className="crt-field">
            <option value="">ANY</option>
            <option value="mcq">MCQ</option>
            <option value="msq">MSQ</option>
            <option value="nat">NAT</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 border border-(--crt-line) bg-(--crt-bg) p-4">
          <span className="crt-micro text-[11px] text-(--crt-ink)">QUESTIONS · {count}</span>
          <input
            type="range"
            min={5}
            max={50}
            value={Math.min(50, Math.max(5, count))}
            onChange={(e) => setCount(Number(e.target.value))}
            aria-label="Number of questions, 5 to 50"
          />
        </label>
        <label className="flex flex-col gap-2 border border-(--crt-line) bg-(--crt-bg) p-4">
          <span className="crt-micro text-[11px] text-(--crt-ink)">MINUTES (BLANK = SUGGESTED)</span>
          <input
            type="number"
            min={5}
            max={180}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            placeholder="e.g. 30"
            className="crt-field"
          />
        </label>
      </div>

      <PoolCounter query={queryString} count={poolCount} onCount={setPoolCount} />

      {error ? (
        <p role="alert" className="crt-micro border border-(--crt-red) p-3 text-[11px] leading-relaxed text-(--crt-red)">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={generate}
        disabled={busy || count < 5}
        className="crt-btn-red self-start disabled:opacity-40"
      >
        {busy ? "SETTING PAPER…" : "GENERATE TEST >>>"}
      </button>
    </div>
  );
}
