"use client";

import { useState } from "react";
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

function answerSummary(
  type: QuestionView["type"],
  correctAnswer: unknown,
): string {
  if (!correctAnswer || typeof correctAnswer !== "object") return "—";
  const a = correctAnswer as Record<string, unknown>;
  if (type === "mcq" && typeof a.optionId === "string") return a.optionId;
  if (type === "msq" && Array.isArray(a.optionIds))
    return (a.optionIds as string[]).join(", ");
  if (type === "nat" && typeof a.value === "number") return String(a.value);
  return "—";
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

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { bookmarked: boolean };
        setSaved(data.bookmarked);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      className="crt-micro border border-(--crt-edge) px-4 py-2 text-[11px] text-(--crt-ink) transition-colors hover:bg-(--crt-ink) hover:text-(--crt-bg) disabled:opacity-45"
    >
      {saved ? "SAVED ✓" : "SAVE FOR LATER"}
    </button>
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
      <p className="crt-micro border-b border-(--crt-line) px-4 py-2 text-[10px] text-(--crt-dim) sm:px-5">
        [ RESPONSE TERMINAL {"///"} {view.type.toUpperCase()} INPUT ]
      </p>
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
              disabled={result !== null}
              required
              className="crt-field"
            />
          </label>
        ) : (
          <fieldset disabled={result !== null} className="flex flex-col gap-2">
            <legend className="crt-label mb-1">
              {view.type === "mcq"
                ? "Pick one option"
                : "Pick all options that apply"}
            </legend>
            {(view.options ?? []).map((option) => {
              const checked = selected.includes(option.id);
              return (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-start gap-3 border border-(--crt-edge) bg-(--crt-bg) p-3 text-sm leading-6 text-(--crt-ink) transition-colors duration-150 has-checked:border-(--crt-red) has-checked:bg-(--crt-raised)"
                >
                  <input
                    type={view.type === "mcq" ? "radio" : "checkbox"}
                    name={`answer-${view.id}`}
                    value={option.id}
                    checked={checked}
                    onChange={() => toggleOption(option.id)}
                    className="crt-check mt-1"
                  />
                  <span>
                    <strong className="mr-2 font-mono text-(--crt-red)">{option.id}.</strong>
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
            <button type="submit" disabled={!canSubmit} className="crt-btn-red">
              {submitting ? "CHECKING…" : "SUBMIT ANSWER >>>"}
            </button>
          )}
          <BookmarkButton questionId={view.id} initial={view.bookmarked} />
        </div>
      </form>

      {result ? (
        <section
          aria-live="polite"
          aria-label="Result"
          className="flex flex-col gap-4 border-t-2 border-(--crt-ink) px-4 py-5 sm:px-5"
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
              <p className="crt-macro text-[clamp(1.6rem,5vw,2.4rem)] text-(--crt-ink)">
                {result.isCorrect ? (
                  <>TARGET HIT<span className="text-(--crt-red)">.</span></>
                ) : (
                  <span className="text-(--crt-red)">MISS — {view.type === "nat" ? "ANSWER" : view.type === "msq" ? "OPTIONS" : "OPTION"}: {answerSummary(view.type, result.correctAnswer)}</span>
                )}
              </p>
              {result.solution ? (
                <details className="border border-(--crt-line) bg-(--crt-bg)" open>
                  <summary className="crt-micro cursor-pointer border-b border-(--crt-line) px-4 py-2.5 text-[11px] text-(--crt-ink) hover:text-(--crt-red)">
                    [+] SOLUTION FILE
                  </summary>
                  <MathText
                    text={result.solution}
                    className="prose-study px-4 py-3 text-sm leading-7 text-(--crt-ink) [&_p]:my-2"
                  />
                </details>
              ) : null}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
