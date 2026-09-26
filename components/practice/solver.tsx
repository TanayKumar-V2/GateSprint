"use client";

import { useState, useEffect, useRef } from "react";
import { MathText } from "@/components/markdown/math-text";
import { isFigurePlaceholder } from "@/components/questions/question-figures";
import type { QuestionView } from "@/lib/questions";

type ResultState = {
  isCorrect: boolean;
  correctAnswer: unknown;
  solution: string | null;
  deduped: boolean;
  aiGraded: boolean;
  explanation: string | null;
};

function AnswerSummary({
  type,
  correctAnswer,
  options,
}: {
  type: QuestionView["type"];
  correctAnswer: unknown;
  options: { id: string; text: string }[] | null;
}) {
  if (!correctAnswer || typeof correctAnswer !== "object") return <>—</>;
  const a = correctAnswer as Record<string, unknown>;

  const formatOption = (id: string) => {
    const opt = options?.find((o) => o.id === id);
    if (!opt) return <>{id}</>;
    if (isFigurePlaceholder(opt.text)) return <>{id} (FIGURE)</>;
    return (
      <span className="inline-flex gap-2">
        <strong>{id}:</strong> <MathText text={opt.text} inline />
      </span>
    );
  };

  if (type === "mcq" && typeof a.optionId === "string") {
    return formatOption(a.optionId);
  }
  if (type === "msq" && Array.isArray(a.optionIds)) {
    return (
      <span className="flex flex-col gap-1">
        {(a.optionIds as string[]).map((id) => (
          <span key={id}>{formatOption(id)}</span>
        ))}
      </span>
    );
  }
  if (type === "nat" && typeof a.value === "number") {
    const val = a.value;
    const tol = typeof a.tolerance === "number" ? a.tolerance : 0;
    if (tol > 0) {
      return (
        <>{val} ±{tol} ({Number((val - tol).toFixed(4))}–{Number((val + tol).toFixed(4))})</>
      );
    }
    return <>{String(val)}</>;
  }
  return <>—</>;
}

export function BookmarkButton({
  questionId,
  initial,
}: {
  questionId: string;
  initial: boolean;
}) {
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { bookmarked: boolean };
        setSaved(data.bookmarked);
      } else {
        setError("Failed to save.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={saved}
        className="crt-micro border border-(--crt-edge) px-4 py-2 text-[11px] text-(--crt-ink) transition-colors hover:bg-(--crt-ink) hover:text-(--crt-bg) disabled:opacity-45"
      >
        {saved ? "SAVED ✓" : "SAVE FOR LATER"}
      </button>
      {error ? (
        <span role="alert" className="crt-micro text-[10px] text-(--crt-red)">
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function QuestionSolver({
  view,
  figureNotice,
}: {
  view: QuestionView;
  /**
   * Set when options contain image-only placeholders: "below" means
   * unmapped diagrams are rendered with the figures, "missing" means the
   * import lost them entirely.
   */
  figureNotice?: "below" | "missing" | null;
}) {
  const [selected, setSelected] = useState<string[]>(() => {
    const last = view.lastAttempt?.selectedAnswer as
      | { optionId?: string; optionIds?: string[] }
      | undefined;
    if (view.type === "mcq" && last?.optionId) return [last.optionId];
    if (view.type === "msq" && last?.optionIds) return last.optionIds;
    return [];
  });
  const [natValue, setNatValue] = useState(() => {
    const last = view.lastAttempt?.selectedAnswer as
      | { value?: number }
      | undefined;
    return typeof last?.value === "number" ? String(last.value) : "";
  });
  const [startedAt] = useState(() => new Date().toISOString());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const resultRef = useRef<HTMLElement>(null);
  const [result, setResult] = useState<ResultState | null>(() =>
    view.reveal && view.lastAttempt
      ? {
          isCorrect: view.lastAttempt.isCorrect,
          correctAnswer: view.correctAnswer,
          solution: view.solution,
          deduped: false,
          aiGraded: false,
          explanation: null,
        }
      : null,
  );

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    if (result) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - Date.parse(startedAt)) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [result, startedAt]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const canSubmit =
    !submitting &&
    (view.type === "nat" ? natValue.trim() !== "" : selected.length > 0);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const answer =
        view.type === "mcq"
          ? { optionId: selected[0]! }
          : view.type === "msq"
            ? { optionIds: selected }
            : { value: Number(natValue) };
      if (view.type === "nat" && !Number.isFinite(answer.value)) {
        setSubmitError("Enter a valid number.");
        return;
      }
      const timeTakenSeconds = Math.max(
        0,
        Math.round((Date.now() - Date.parse(startedAt)) / 1000),
      );
      const res = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: view.id,
          answer,
          timeTakenSeconds,
          startedAt,
          idempotencyKey:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${view.id}-${Date.now()}`,
        }),
      });
      const data = (await res.json()) as {
        result?: {
          isCorrect: boolean;
          correctAnswer: unknown;
          solution: string | null;
          deduped: boolean;
          aiGraded: boolean;
          explanation: string | null;
        };
        error?: { code?: string; message: string };
      };
      if (!res.ok) {
        if (data.error?.code === "needs_review") {
          setSubmitError(null);
          setResult({
            isCorrect: false,
            correctAnswer: null,
            solution: null,
            deduped: false,
            aiGraded: false,
            explanation: data.error.message,
          });
          return;
        }
        setSubmitError(data.error?.message ?? "Couldn't save that. Try again.");
        return;
      }
      setResult({
        isCorrect: data.result!.isCorrect,
        correctAnswer: data.result!.correctAnswer,
        solution: data.result!.solution,
        deduped: data.result!.deduped,
        aiGraded: data.result!.aiGraded ?? false,
        explanation: data.result!.explanation ?? null,
      });
      // Move focus to result section to announce outcome
      setTimeout(() => resultRef.current?.focus(), 50);
    } catch {
      setSubmitError("Network hiccup — nothing was recorded twice. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleOption(id: string) {
    if (result) return;
    setSelected((prev) =>
      view.type === "mcq"
        ? [id]
        : prev.includes(id)
          ? prev.filter((x) => x !== id)
          : [...prev, id],
    );
  }

  return (
    <div className="flex flex-col gap-5 border border-(--crt-line) bg-(--crt-bg)">
      <div className="crt-micro flex items-center justify-between border-b border-(--crt-line) px-4 py-2 text-[10px] text-(--crt-dim) sm:px-5">
        <p>[ RESPONSE TERMINAL {"///"} {view.type.toUpperCase()} INPUT ]</p>
        <p suppressHydrationWarning>TIME: {result ? "—" : formatTime(elapsedSeconds)}</p>
      </div>
      {figureNotice ? (
        <p
          role="note"
          className="crt-micro mx-4 border border-(--crt-red) px-3 py-2.5 text-[10px] leading-relaxed text-(--crt-ink) sm:mx-5"
        >
          <span className="font-bold text-(--crt-red)">
            {figureNotice === "below" ? "[ OPTION DIAGRAMS ]" : "[ DIAGRAMS MISSING ]"}
          </span>{" "}
          {figureNotice === "below"
            ? "FIGURES BELOW INCLUDE THE OPTION DIAGRAMS — MATCH THEM TO A–D YOURSELF. ORDER IS UNVERIFIED."
            : "THIS IMPORT DID NOT CAPTURE THE OPTION DIAGRAMS. FLAGGED FOR REVIEW — GRADING MAY BE UNAVAILABLE."}
        </p>
      ) : null}
      <form onSubmit={onSubmit} aria-label="Your answer" className="flex flex-col gap-4 px-4 pb-5 sm:px-5">
        {view.type === "nat" ? (
          <label className="flex max-w-xs flex-col gap-1.5">
            <span className="crt-label">Your answer (number)</span>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              value={natValue}
              onChange={(e) => setNatValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "e" || e.key === "E") e.preventDefault();
              }}
              disabled={result !== null}
              required
              className="crt-field"
            />
          </label>
        ) : (
          <fieldset disabled={result !== null} className="flex flex-col gap-2">
            <legend className="crt-label mb-1 flex flex-col">
              <span>{view.type === "mcq" ? "Pick one option" : "Pick all options that apply"}</span>
              {view.type === "msq" ? (
                <span className="crt-micro mt-1 text-[10px] text-(--crt-dim)">
                  MSQ: SELECT ALL CORRECT. NO PARTIAL MARKS. NO NEGATIVE.
                </span>
              ) : null}
            </legend>
            {(view.options ?? []).map((option) => {
              const checked = selected.includes(option.id);
              let stateClass = "border-(--crt-edge) bg-(--crt-bg) text-(--crt-ink)";
              if (result) {
                const ca = result.correctAnswer as Record<string, unknown>;
                const isCorrectOption =
                  view.type === "mcq"
                    ? ca?.optionId === option.id
                    : view.type === "msq"
                      ? Array.isArray(ca?.optionIds) && ca.optionIds.includes(option.id)
                      : false;
                
                if (isCorrectOption) {
                  stateClass = "border-(--crt-ok) bg-(--crt-ok)/10 text-(--crt-ok)";
                } else if (checked && !isCorrectOption) {
                  stateClass = "border-(--crt-red) bg-(--crt-red)/10 text-(--crt-red)";
                } else {
                  stateClass = "border-(--crt-edge)/50 bg-(--crt-bg) text-(--crt-dim)";
                }
              } else if (checked) {
                stateClass = "border-(--crt-red) bg-(--crt-raised) text-(--crt-ink)";
              }

              return (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-start gap-3 border p-3 text-sm leading-6 transition-colors duration-150 ${stateClass} ${result ? "cursor-default" : ""}`}
                >
                  <input
                    type={view.type === "mcq" ? "radio" : "checkbox"}
                    name={`answer-${view.id}`}
                    value={option.id}
                    checked={checked}
                    onChange={() => toggleOption(option.id)}
                    className="crt-check mt-1"
                  />
                  <span className="min-w-0 flex-1 break-words">
                    <strong className={`mr-2 font-mono ${result ? "inherit" : "text-(--crt-red)"}`}>{option.id}.</strong>
                    {isFigurePlaceholder(option.text) ? (
                      <span className="crt-tag crt-tag-red">FIGURE</span>
                    ) : (
                      <MathText text={option.text} inline />
                    )}
                  </span>
                </label>
              );
            })}
          </fieldset>
        )}

        {submitError ? (
          <p role="alert" className="crt-micro text-[11px] text-(--crt-red)">
            !! {submitError}
          </p>
        ) : null}
        
        {!canSubmit && !result && view.type === "mcq" ? (
          <p id="submit-hint" className="sr-only">Please select an option to submit.</p>
        ) : null}
        {!canSubmit && !result && view.type === "nat" ? (
          <p id="submit-hint" className="sr-only">Please enter a number to submit.</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {result ? (
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setSelected([]);
                setNatValue("");
              }}
              className="crt-btn-line"
            >
              TRY AGAIN
            </button>
          ) : (
            <button 
              type="submit" 
              disabled={!canSubmit} 
              aria-describedby={!canSubmit ? "submit-hint" : undefined}
              className="crt-btn-red"
            >
              {submitting ? "CHECKING…" : "SUBMIT ANSWER >>>"}
            </button>
          )}
          <BookmarkButton questionId={view.id} initial={view.bookmarked} />
        </div>
      </form>

      {result ? (
        <section
          ref={resultRef}
          tabIndex={-1}
          aria-live="polite"
          aria-label="Result"
          className="flex flex-col gap-4 border-t-2 border-(--crt-ink) px-4 py-5 outline-none sm:px-5"
        >
          {result.explanation ? (
            <div className="border border-(--crt-red) p-4">
              <p className="crt-micro text-[11px] font-bold text-(--crt-red)">NEEDS REVIEW</p>
              <p className="mt-2 text-sm leading-6 text-(--crt-ink)">
                {result.explanation}
              </p>
              <p className="crt-micro mt-2 text-[10px] leading-relaxed text-(--crt-dim)">
                THIS QUESTION IS MISSING PART OF ITS TEXT — AN ADMIN CAN COMPLETE
                IT. NOTHING WAS RECORDED FOR THIS ATTEMPT.
              </p>
            </div>
          ) : (
            <>
              {result.deduped ? (
                <span className="crt-tag w-fit crt-tag-solid">ALREADY RECORDED</span>
              ) : null}
              <p className="crt-macro text-[clamp(1.6rem,5vw,2.4rem)] text-(--crt-ink)">
                {result.isCorrect ? (
                  <>TARGET HIT<span className="text-(--crt-red)">.</span></>
                ) : (
                  <span className="text-(--crt-red) flex flex-col gap-2">
                    <span className="flex items-center gap-2">
                      MISS — {view.type === "nat" ? "ANSWER" : view.type === "msq" ? "OPTIONS" : "OPTION"}:
                    </span>
                    <AnswerSummary type={view.type} correctAnswer={result.correctAnswer} options={view.options} />
                  </span>
                )}
              </p>
              
              <div className="crt-micro flex flex-wrap gap-4 text-[11px] text-(--crt-dim)">
                <span>
                  {result.isCorrect ? (
                    <span className="text-(--crt-ok)">+{view.marks} MARKS</span>
                  ) : (
                    <span className="text-(--crt-red)">{view.negativeMarks > 0 ? `-${view.negativeMarks} NEGATIVE` : "0 MARKS"}</span>
                  )}
                </span>
                {result.aiGraded ? <span>AI GRADED</span> : null}
              </div>

              {result.solution ? (
                <details className="group border border-(--crt-line) bg-(--crt-bg)">
                  <summary className="crt-micro cursor-pointer border-b border-(--crt-line) px-4 py-2.5 text-[11px] text-(--crt-ink) transition-colors hover:bg-(--crt-ink) hover:text-(--crt-bg)">
                    [+] SOLUTION FILE
                  </summary>
                  <MathText
                    text={result.solution}
                    className="prose-study px-4 py-3 text-sm leading-7 text-(--crt-ink) [&_p]:my-2"
                  />
                </details>
              ) : (
                <div className="border border-(--crt-edge) p-4 text-sm text-(--crt-dim)">
                  <p>No official solution yet — Ask Mentor for an explanation.</p>
                </div>
              )}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
