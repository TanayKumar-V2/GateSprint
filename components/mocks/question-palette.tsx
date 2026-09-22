"use client";

import type { PaletteStatus } from "@/lib/mocks-rules";

export type PaletteItem = {
  position: number;
  status: PaletteStatus;
};

const STYLES: Record<PaletteStatus, string> = {
  unvisited: "border-(--crt-line) text-(--crt-dim)",
  unanswered: "border-(--crt-red) text-(--crt-red)",
  answered: "border-(--brand-success) bg-(--brand-success) text-(--crt-bg)",
  marked: "border-(--brand-saffron) bg-(--brand-saffron) text-(--crt-bg)",
  answered_marked: "border-(--brand-saffron) bg-(--crt-red) text-(--crt-bg)",
};

const LABEL: Record<PaletteStatus, string> = {
  unvisited: "Not visited",
  unanswered: "Not answered",
  answered: "Answered",
  marked: "Marked for review",
  answered_marked: "Answered and marked",
};

export function QuestionPalette({
  items,
  current,
  onJump,
}: {
  items: PaletteItem[];
  current: number;
  onJump: (position: number) => void;
}) {
  const counts = items.reduce<Record<PaletteStatus, number>>(
    (acc, i) => {
      acc[i.status] += 1;
      return acc;
    },
    { unvisited: 0, unanswered: 0, answered: 0, marked: 0, answered_marked: 0 },
  );

  return (
    <div className="flex flex-col gap-3 border border-(--crt-line) bg-(--crt-bg) p-4">
      <p className="crt-micro text-[10px] text-(--crt-dim)">[ PALETTE ]</p>
      <div className="crt-micro grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] text-(--crt-dim)" aria-label="Palette summary">
        {(Object.keys(counts) as PaletteStatus[]).map((s) => (
          <span key={s}>
            {s.replace("_", "+").toUpperCase()}: <output>{counts[s]}</output>
          </span>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Jump to question">
        {items.map((item) => (
          <button
            key={item.position}
            type="button"
            onClick={() => onJump(item.position)}
            aria-label={`Question ${item.position + 1}: ${LABEL[item.status]}`}
            aria-current={item.position === current ? "true" : undefined}
            className={`crt-micro grid aspect-square place-items-center border text-[11px] tabular-nums transition-colors ${STYLES[item.status]} ${
              item.position === current ? "outline-2 outline-(--crt-ink) outline-offset-1" : ""
            }`}
          >
            {item.position + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
