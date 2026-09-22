import Link from "next/link";
import type { SyllabusSubject } from "@/lib/syllabus";
import { TopicStatusPill } from "./topic-status-pill";
import { TopicOverrideToggle } from "./topic-override-toggle";

function pct(accuracy: number | null): string {
  return accuracy === null ? "—" : `${Math.round(accuracy * 100)}%`;
}

export function SyllabusGrid({ subjects }: { subjects: SyllabusSubject[] }) {
  return (
    <div className="flex flex-col gap-6">
      {subjects.map((s) => (
        <section
          key={s.slug}
          aria-labelledby={`syllabus-${s.slug}`}
          className="border border-(--crt-line) bg-(--crt-bg)"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--crt-line) px-4 py-3 sm:px-5">
            <div className="flex items-center gap-3">
              <h2 id={`syllabus-${s.slug}`} className="text-sm font-bold uppercase tracking-tight text-(--crt-ink)">
                {s.name}
              </h2>
              <TopicStatusPill status={s.status} />
            </div>
            <p className="crt-micro text-[10px] tabular-nums text-(--crt-dim)">
              {pct(s.accuracy)} · {s.attempts} ATTEMPTS · {s.attemptedQuestions}/{s.totalQuestions} COVERAGE
            </p>
          </div>
          <ul className="grid gap-px bg-(--crt-line) sm:grid-cols-2">
            {s.topics.map((t) => (
              <li key={t.slug} className="flex flex-col gap-2 bg-(--crt-bg) p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-(--crt-ink)">{t.name}</p>
                  <TopicStatusPill status={t.status} />
                </div>
                <p className="crt-micro text-[10px] tabular-nums text-(--crt-dim)">
                  {pct(t.accuracy)} · {t.attempts} ATTEMPTS · {t.attemptedQuestions}/{t.totalQuestions} QS
                  {t.override ? (
                    <span className="ml-2 border border-(--crt-line) px-1.5 py-0.5 text-[9px] text-(--crt-ink)">
                      {t.override.toUpperCase()}
                    </span>
                  ) : null}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={t.practicePath} className="crt-btn-line !px-2.5 !py-1 !text-[10px]">
                    PRACTICE
                  </Link>
                  <Link href={t.revisePath} className="crt-btn-line !px-2.5 !py-1 !text-[10px]">
                    REVISE
                  </Link>
                  <TopicOverrideToggle topicSlug={t.slug} subjectSlug={s.slug} override={t.override} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
