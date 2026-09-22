import Link from "next/link";
import { MathText } from "@/components/markdown/math-text";
import { QuestionFigures } from "@/components/questions/question-figures";
import type { MockResultPayload } from "@/lib/mocks";

function pct(accuracy: number | null): string {
  return accuracy === null ? "—" : `${Math.round(accuracy * 100)}%`;
}

function formatSeconds(value: number): string {
  if (value < 60) return `${value}s`;
  return `${Math.floor(value / 60)}m ${String(value % 60).padStart(2, "0")}s`;
}

function answerText(type: string, answer: unknown): string {
  if (!answer || typeof answer !== "object") return "—";
  const a = answer as Record<string, unknown>;
  if (type === "mcq" && typeof a.optionId === "string") return a.optionId;
  if (type === "msq" && Array.isArray(a.optionIds)) return (a.optionIds as string[]).join(", ");
  if (type === "nat" && typeof a.value === "number") return String(a.value);
  return "—";
}

export function MockResult({ result }: { result: MockResultPayload }) {
  const { meta } = result;
  return (
    <div className="flex flex-col gap-8">
      <section aria-label="Score" className="border border-(--crt-line) bg-(--crt-bg)">
        <p className="crt-micro border-b border-(--crt-line) px-5 py-2 text-[10px] text-(--crt-dim)">
          [ RESULT {"///"} {meta.title.toUpperCase()}
          {meta.status === "expired" ? " /// AUTO-SUBMITTED ON TIMEOUT" : ""} ]
        </p>
        <div className="flex flex-col gap-4 p-5 sm:p-7">
          <p className="crt-macro text-[clamp(2.4rem,8vw,4.5rem)] tabular-nums text-(--crt-ink)">
            {meta.score}
            <span className="text-[0.45em] text-(--crt-dim)">/{meta.totalMarks}</span>
          </p>
          <dl className="grid grid-cols-2 gap-px border border-(--crt-line) bg-(--crt-line) sm:grid-cols-4">
            {[
              ["ACCURACY", pct(meta.accuracy)],
              ["CORRECT", String(meta.correct)],
              ["WRONG", String(meta.incorrect)],
              ["SKIPPED", String(meta.skipped)],
            ].map(([k, v]) => (
              <div key={k} className="bg-(--crt-bg) p-3">
                <dt className="crt-label">{k}</dt>
                <dd className="crt-macro mt-1 text-xl tabular-nums text-(--crt-ink)">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {result.subjectSplit.length > 0 ? (
        <section aria-labelledby="split-heading" className="flex flex-col gap-4">
          <h2 id="split-heading" className="crt-micro text-[11px] text-(--crt-ink)">
            [ SUBJECT SPLIT ]
          </h2>
          <ul className="grid gap-px border border-(--crt-line) bg-(--crt-line) sm:grid-cols-2">
            {result.subjectSplit.map((s) => (
              <li key={s.slug} className="flex items-baseline justify-between gap-3 bg-(--crt-bg) p-4">
                <span className="text-sm font-bold uppercase tracking-tight text-(--crt-ink)">{s.name}</span>
                <span className="crt-micro text-[11px] tabular-nums text-(--crt-dim)">
                  <span className="text-(--crt-ink)">{s.score}/{s.total}</span>
                  {" /// "}{s.correct}/{s.attempts} HIT
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="review-heading" className="flex flex-col gap-4">
        <h2 id="review-heading" className="crt-micro text-[11px] text-(--crt-ink)">
          [ FULL REVIEW {"///"} SOLUTIONS UNLOCKED ]
        </h2>
        <ol className="flex flex-col gap-5">
          {result.items.map((item, i) => (
            <li key={item.itemId} className="border border-(--crt-line) bg-(--crt-bg)">
              <div className="crt-micro flex flex-wrap items-center justify-between gap-2 border-b border-(--crt-line) px-4 py-2 text-[10px] text-(--crt-dim)">
                <span>
                  Q{i + 1} {"///"} {item.question.subject.name.toUpperCase()} {"///"} {item.question.topic.name.toUpperCase()}
                </span>
                <span>
                  {item.isCorrect === null ? "SKIPPED" : item.isCorrect ? "CORRECT" : "WRONG"}
                  {" /// "}{formatSeconds(item.timeTakenSeconds)}
                </span>
              </div>
              <div className="flex flex-col gap-3 px-4 py-4 sm:px-5">
                <div className="text-[15px] font-medium leading-7 break-words text-(--crt-ink)">
                  <MathText text={item.question.prompt} inline />
                </div>
                <QuestionFigures questionId={item.question.id} images={item.question.images} />
                <div className="crt-micro grid gap-2 border border-(--crt-line) p-3 text-[11px] sm:grid-cols-2">
                  <p className="text-(--crt-dim)">
                    YOURS: <span className="text-(--crt-ink)">{answerText(item.question.type, item.selectedAnswer)}</span>
                  </p>
                  <p className="text-(--crt-dim)">
                    KEY: <span className="text-(--crt-ink)">{answerText(item.question.type, item.correctAnswer)}</span>
                  </p>
                </div>
                {item.solution ? (
                  <details className="border border-(--crt-line)">
                    <summary className="crt-micro cursor-pointer px-4 py-2.5 text-[11px] text-(--crt-ink) hover:text-(--crt-red)">
                      [+] SOLUTION
                    </summary>
                    <MathText
                      text={item.solution}
                      className="prose-study px-4 py-3 text-sm leading-7 text-(--crt-ink) [&_p]:my-2"
                    />
                  </details>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Link href={item.practicePath} className="crt-btn-line !px-3 !py-1 !text-[10px]">
                    DRILL IN PRACTICE
                  </Link>
                  <Link
                    href={`/mentor?subject=${item.question.subject.slug}&topic=${item.question.topic.slug}`}
                    className="crt-btn-line !px-3 !py-1 !text-[10px]"
                  >
                    ASK MENTOR
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
