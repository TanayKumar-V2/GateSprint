"use client";

import { useState } from "react";
import { MathText } from "@/components/markdown/math-text";
import type { VariantListItem } from "@/lib/variants";
import { askMentorToExplain } from "./variant-client";

type Grade = { isCorrect: boolean; correctAnswer: unknown };

function keyText(type: string, key: unknown): string {
  if (!key || typeof key !== "object") return "—";
  const k = key as Record<string, unknown>;
  if (type === "mcq" && typeof k.optionId === "string") return k.optionId;
  if (type === "msq" && Array.isArray(k.optionIds)) return (k.optionIds as string[]).join(", ");
  if (type === "nat" && typeof k.value === "number") return String(k.value);
  return "—";
}

/** One variant card: prompt, Try widget, instant grade, Explain. */
export function VariantCard({ variant }: { variant: VariantListItem }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [nat, setNat] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [verified, setVerified] = useState(variant.verified);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) =>
      variant.type === "mcq" ? [id] : prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function check() {
    if (checking) return;
    setChecking(true);
    setError(null);
    try {
      const answer =
        variant.type === "nat"
          ? { value: Number(nat) }
          : variant.type === "mcq"
            ? { optionId: selected[0] }
            : { optionIds: selected };
      if (variant.type === "nat" && !Number.isFinite((answer as { value: number }).value)) {
        setError("Enter a valid number.");
        return;
      }
      if (variant.type !== "nat" && selected.length === 0) {
        setError("Pick an option first.");
        return;
      }
      const res = await fetch(`/api/variants/${variant.id}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answer }),
      });
      const data = (await res.json()) as Grade & { error?: { message: string } };
      if (!res.ok) {
        setError(data.error?.message ?? "Couldn't grade that.");
        return;
      }
      setGrade({ isCorrect: data.isCorrect, correctAnswer: data.correctAnswer });
      if (data.isCorrect) setVerified(true);
    } catch {
      setError("Network hiccup — try again.");
    } finally {
      setChecking(false);
    }
  }

  function explain() {
    const mine =
      variant.type === "nat"
        ? nat.trim() || "—"
        : selected.length > 0
          ? selected.join(", ")
          : "—";
    const key = grade ? ` The key is ${keyText(variant.type, grade.correctAnswer)} and I answered ${mine}.` : "";
    askMentorToExplain(
      `Explain this practice question: ${variant.prompt}${key} Where does the reasoning fail, and what concept should I revise?`,
    );
  }

  return (
    <li className="border border-(--crt-line) bg-(--crt-bg)">
      <div className="crt-micro flex flex-wrap items-center justify-between gap-2 border-b border-(--crt-line) px-4 py-2 text-[10px]">
        <span className="text-(--crt-dim)">
          VARIANT {"///"} {variant.type.toUpperCase()} {"///"} {variant.difficulty.toUpperCase()}
        </span>
        {verified ? (
          <span className="border border-(--brand-success) px-1.5 py-0.5 text-[9px] text-(--crt-ink)">VERIFIED ✓</span>
        ) : (
          <span className="border border-(--crt-red) px-1.5 py-0.5 text-[9px] text-(--crt-red)">
            AI-GENERATED · UNREVIEWED
          </span>
        )}
      </div>
      <div className="flex flex-col gap-3 px-4 py-4">
        <div className="text-[15px] font-medium leading-7 break-words text-(--crt-ink)">
          <MathText text={variant.prompt} inline />
        </div>

        {variant.type === "nat" ? (
          <label className="flex max-w-xs flex-col gap-1.5">
            <span className="crt-label">Your answer (number)</span>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              value={nat}
              onChange={(e) => setNat(e.target.value)}
              disabled={checking}
              className="crt-field"
            />
          </label>
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="crt-label mb-1">
              {variant.type === "mcq" ? "Pick one option" : "Pick all options that apply"}
            </legend>
            {(variant.options ?? []).map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-start gap-3 border border-(--crt-edge) bg-(--crt-bg) p-3 text-sm leading-6 text-(--crt-ink) transition-colors has-checked:border-(--crt-red) has-checked:bg-(--crt-raised)"
              >
                <input
                  type={variant.type === "mcq" ? "radio" : "checkbox"}
                  name={`variant-${variant.id}`}
                  value={option.id}
                  checked={selected.includes(option.id)}
                  onChange={() => toggle(option.id)}
                  disabled={checking}
                  className="crt-check mt-1"
                />
                <span className="min-w-0 flex-1 break-words">
                  <strong className="mr-2 font-mono text-(--crt-red)">{option.id}.</strong>
                  <MathText text={option.text} inline />
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {grade ? (
          <p aria-live="polite" className={`crt-micro text-[11px] ${grade.isCorrect ? "text-(--crt-ink)" : "text-(--crt-red)"}`}>
            {grade.isCorrect
              ? "TARGET HIT — VARIANT VERIFIED ✓"
              : `MISS — KEY: ${keyText(variant.type, grade.correctAnswer)}`}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="crt-micro text-[11px] text-(--crt-red)">
            !! {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={check}
            disabled={checking}
            className="crt-btn-red !px-4 !py-2 !text-[11px]"
          >
            {checking ? "GRADING…" : grade ? "RE-CHECK" : "CHECK >>>"}
          </button>
          <button
            type="button"
            onClick={explain}
            className="crt-btn-line !px-4 !py-2 !text-[11px]"
          >
            EXPLAIN
          </button>
        </div>
      </div>
    </li>
  );
}
