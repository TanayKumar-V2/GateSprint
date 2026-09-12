"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MathText } from "@/components/markdown/math-text";
import type { QuestionView } from "@/lib/questions";

type ResultState = {
  isCorrect: boolean;
  correctAnswer: unknown;
  solution: string | null;
  deduped: boolean;
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
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
    >
      {saved ? "Saved ✓" : "Save for later"}
    </Button>
  );
}

export function QuestionSolver({ view }: { view: QuestionView }) {
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
        };
        error?: { message: string };
      };
      if (!res.ok) {
        setSubmitError(data.error?.message ?? "Couldn't save that. Try again.");
        return;
      }
      setResult({
        isCorrect: data.result!.isCorrect,
        correctAnswer: data.result!.correctAnswer,
        solution: data.result!.solution,
        deduped: data.result!.deduped,
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
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} aria-label="Your answer">
        {view.type === "nat" ? (
          <label className="flex max-w-xs flex-col gap-2 text-sm font-medium">
            Your answer (number)
            <input
              type="number"
              step="any"
              inputMode="decimal"
              value={natValue}
              onChange={(e) => setNatValue(e.target.value)}
              disabled={result !== null}
              required
              className="h-10 rounded-md border border-input bg-background px-3"
            />
          </label>
        ) : (
          <fieldset disabled={result !== null} className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">
              {view.type === "mcq"
                ? "Pick one option"
                : "Pick all options that apply"}
            </legend>
            {(view.options ?? []).map((option) => {
              const checked = selected.includes(option.id);
              return (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm leading-6 has-checked:border-primary has-checked:bg-muted"
                >
                  <input
                    type={view.type === "mcq" ? "radio" : "checkbox"}
                    name={`answer-${view.id}`}
                    value={option.id}
                    checked={checked}
                    onChange={() => toggleOption(option.id)}
                    className="mt-1 size-4"
                  />
                  <span>
                    <strong className="mr-2">{option.id}.</strong>
                    <MathText text={option.text} inline />
                  </span>
                </label>
              );
            })}
          </fieldset>
        )}

        {submitError ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {submitError}
          </p>
        ) : null}

        <div className="mt-4 flex items-center gap-3">
          {result ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setResult(null);
                setSelected([]);
                setNatValue("");
              }}
            >
              Try again
            </Button>
          ) : (
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? "Checking…" : "Submit answer"}
            </Button>
          )}
          <BookmarkButton questionId={view.id} initial={view.bookmarked} />
        </div>
      </form>

      {result ? (
        <section
          aria-live="polite"
          aria-label="Result"
          className="flex flex-col gap-4 rounded-xl border p-4"
        >
          <p
            className={`text-base font-semibold ${result.isCorrect ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}
          >
            {result.isCorrect ? "✓ Correct" : "✗ Not quite"} — answer:{" "}
            {answerSummary(view.type, result.correctAnswer)}
          </p>
          <p className="text-sm text-muted-foreground">
            {view.marks} mark{view.marks === 1 ? "" : "s"}
            {view.negativeMarks > 0 && !result.isCorrect
              ? ` · −${view.negativeMarks} on a wrong attempt`
              : ""}
          </p>
          {result.solution ? (
            <details open className="rounded-lg bg-muted p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Solution
              </summary>
              <MathText
                text={result.solution}
                className="mt-2 text-sm leading-7 [&_p]:my-2"
              />
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
