"use client";

import { MathText } from "@/components/markdown/math-text";
import { isFigurePlaceholder } from "@/components/questions/question-figures";
import type { SubmittedAnswer } from "@/lib/validation/answers";

export type DraftAnswer = SubmittedAnswer | null;

/**
 * Controlled answer inputs. The runner owns the draft (so palette jumps can
 * auto-save); this only renders controls and forwards changes.
 */
export function MockAnswer({
  type,
  options,
  draft,
  natText,
  saving,
  saveError,
  onDraftChange,
  onNatChange,
  onSave,
  onClear,
}: {
  type: "mcq" | "msq" | "nat";
  options: { id: string; text: string }[] | null;
  draft: DraftAnswer;
  natText: string;
  saving: boolean;
  saveError: string | null;
  onDraftChange: (answer: DraftAnswer) => void;
  onNatChange: (text: string) => void;
  onSave: () => void;
  onClear: () => void;
}) {
  const selected: string[] =
    draft && "optionId" in draft
      ? [draft.optionId]
      : draft && "optionIds" in draft
        ? draft.optionIds
        : [];

  function toggle(id: string) {
    if (type === "mcq") {
      onDraftChange({ optionId: id });
      return;
    }
    const next = selected.includes(id)
      ? selected.filter((x) => x !== id)
      : [...selected, id];
    onDraftChange({ optionIds: next });
  }

  return (
    <div className="flex flex-col gap-3">
      {type === "nat" ? (
        <label className="flex max-w-xs flex-col gap-1.5">
          <span className="crt-label">Your answer (number)</span>
          <input
            type="number"
            step="any"
            inputMode="decimal"
            value={natText}
            onChange={(e) => onNatChange(e.target.value)}
            disabled={saving}
            className="crt-field"
          />
        </label>
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className="crt-label mb-1">
            {type === "mcq" ? "Pick one option" : "Pick all options that apply"}
          </legend>
          {(options ?? []).map((option) => {
            const checked = selected.includes(option.id);
            return (
              <label
                key={option.id}
                className="flex cursor-pointer items-start gap-3 border border-(--crt-edge) bg-(--crt-bg) p-3 text-sm leading-6 text-(--crt-ink) transition-colors duration-150 has-checked:border-(--crt-red) has-checked:bg-(--crt-raised)"
              >
                <input
                  type={type === "mcq" ? "radio" : "checkbox"}
                  name="mock-answer"
                  value={option.id}
                  checked={checked}
                  onChange={() => toggle(option.id)}
                  disabled={saving}
                  className="crt-check mt-1"
                />
                <span className="min-w-0 flex-1 break-words">
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
      {saveError ? (
        <p role="alert" className="crt-micro text-[11px] text-(--crt-red)">
          !! {saveError}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onSave} disabled={saving} className="crt-btn-red !px-4 !py-2 !text-[11px]">
          {saving ? "SAVING…" : "SAVE ANSWER"}
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={saving}
          className="crt-btn-line !px-4 !py-2 !text-[11px]"
        >
          CLEAR
        </button>
      </div>
    </div>
  );
}
