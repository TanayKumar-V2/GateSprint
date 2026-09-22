"use client";

import type { TimeFlag } from "@/lib/time-analytics-rules";

export type ScatterPoint = {
  yourSeconds: number;
  isCorrect: boolean;
  flag: TimeFlag;
};

const FLAG_COLOR: Record<TimeFlag, string> = {
  rushed: "var(--crt-red)",
  overtime: "var(--brand-saffron)",
  slow_correct: "var(--crt-ink)",
  ok: "var(--crt-dim)",
};

/**
 * Static SVG scatter: x = seconds per attempt, lanes split correct (top)
 * vs incorrect (bottom). No animation, no library — the data table below
 * carries exact values for screen readers.
 */
export function TimeScatter({ points }: { points: ScatterPoint[] }) {
  if (points.length === 0) return null;
  const W = 640;
  const H = 220;
  const PAD = { l: 44, r: 12, t: 14, b: 30 };
  const maxX = Math.max(60, ...points.map((p) => p.yourSeconds)) * 1.05;
  const x = (s: number) => PAD.l + (Math.min(s, maxX) / maxX) * (W - PAD.l - PAD.r);
  const laneY = (correct: boolean, i: number) =>
    correct
      ? PAD.t + 24 + ((i * 37) % 56)
      : H - PAD.b - 24 - ((i * 53) % 56);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round((maxX * f) / 5) * 5);

  return (
    <div
      role="img"
      aria-label={`Scatter of ${points.length} timed attempts: time across, correct on top lane, incorrect on bottom lane.`}
      className="overflow-x-auto border border-(--crt-line) bg-(--crt-bg) p-4"
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="min-w-lg" aria-hidden="true">
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={PAD.l + f * (W - PAD.l - PAD.r)}
            x2={PAD.l + f * (W - PAD.l - PAD.r)}
            y1={PAD.t}
            y2={H - PAD.b}
            style={{ stroke: "var(--crt-line)" }}
            strokeDasharray="3,5"
          />
        ))}
        <line
          x1={PAD.l}
          x2={W - PAD.r}
          y1={H - PAD.b}
          y2={H - PAD.b}
          style={{ stroke: "var(--crt-dim)" }}
        />
        <line
          x1={PAD.l}
          x2={PAD.l}
          y1={PAD.t}
          y2={H - PAD.b}
          style={{ stroke: "var(--crt-dim)" }}
        />
        {ticks.map((t) => (
          <text
            key={t}
            x={x(t)}
            y={H - PAD.b + 16}
            textAnchor="middle"
            fontSize="10"
            style={{ fill: "var(--crt-dim)" }}
          >
            {t}s
          </text>
        ))}
        <text x={PAD.l} y={PAD.t + 8} fontSize="10" style={{ fill: "var(--crt-dim)" }}>
          CORRECT
        </text>
        <text x={PAD.l} y={H - PAD.b - 66} fontSize="10" style={{ fill: "var(--crt-dim)" }}>
          WRONG
        </text>
        {points.map((p, i) => (
          <circle
            key={i}
            cx={x(p.yourSeconds)}
            cy={laneY(p.isCorrect, i)}
            r={p.flag === "ok" ? 3.5 : 5}
            style={{ fill: FLAG_COLOR[p.flag] }}
            opacity={p.flag === "ok" ? 0.55 : 0.95}
          >
            <title>{`${p.yourSeconds}s · ${p.isCorrect ? "correct" : "wrong"} · ${p.flag}`}</title>
          </circle>
        ))}
      </svg>
      <div className="crt-micro mt-2 flex flex-wrap gap-4 text-[10px] text-(--crt-dim)">
        <span className="flex items-center gap-1.5"><span className="inline-block size-2 rounded-full" style={{ background: "var(--crt-red)" }} />RUSHED</span>
        <span className="flex items-center gap-1.5"><span className="inline-block size-2 rounded-full" style={{ background: "var(--brand-saffron)" }} />OVERTIME</span>
        <span className="flex items-center gap-1.5"><span className="inline-block size-2 rounded-full bg-(--crt-ink)" />SLOW+CORRECT</span>
        <span className="flex items-center gap-1.5"><span className="inline-block size-2 rounded-full bg-(--crt-dim)" />ON PACE</span>
      </div>
    </div>
  );
}
