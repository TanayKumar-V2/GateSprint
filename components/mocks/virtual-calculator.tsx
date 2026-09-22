"use client";

import { useState } from "react";

/** Client-only virtual calculator: no server, no exam answers, just math. */
export function VirtualCalculator() {
  const [open, setOpen] = useState(false);
  const [expr, setExpr] = useState("");
  const [out, setOut] = useState<string | null>(null);

  function press(key: string) {
    setOut(null);
    if (key === "C") return setExpr("");
    if (key === "⌫") return setExpr((e) => e.slice(0, -1));
    if (key === "=") {
      if (!/^[0-9+\-*/.() ]+$/.test(expr) || expr.trim() === "") return;
      try {
        // eslint-disable-next-line no-new-func
        const value = new Function(`return (${expr})`)() as unknown;
        setOut(typeof value === "number" && Number.isFinite(value) ? String(Math.round(value * 1e10) / 1e10) : "ERR");
      } catch {
        setOut("ERR");
      }
      return;
    }
    setExpr((e) => (e.length >= 40 ? e : e + key));
  }

  const keys = ["7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "C", "+", "(", ")", "⌫", "="];

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="crt-btn-line !px-3 !py-1.5 !text-[10px]"
      >
        {open ? "HIDE CALC" : "CALCULATOR"}
      </button>
      {open ? (
        <div className="border border-(--crt-line) bg-(--crt-bg) p-3" role="group" aria-label="Virtual calculator">
          <output className="crt-macro block min-h-9 border border-(--crt-line) bg-(--crt-raised) px-2 py-1 text-right text-lg tabular-nums text-(--crt-ink)">
            {out ?? expr ?? ""}
          </output>
          <div className="mt-2 grid grid-cols-4 gap-1">
            {keys.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => press(k)}
                className="crt-micro border border-(--crt-line) py-2 text-[12px] text-(--crt-ink) transition-colors hover:bg-(--crt-ink) hover:text-(--crt-bg)"
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
