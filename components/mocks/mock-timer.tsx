"use client";

import { useEffect, useRef, useState } from "react";

function format(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Countdown from the server-owned endsAt. Fires onExpire once at zero. */
export function MockTimer({ endsAt, onExpire }: { endsAt: string; onExpire: () => void }) {
  const [left, setLeft] = useState(() => Date.parse(endsAt) - Date.now());
  const fired = useRef(false);
  const cb = useRef(onExpire);
  cb.current = onExpire;

  useEffect(() => {
    const tick = () => {
      const ms = Date.parse(endsAt) - Date.now();
      setLeft(ms);
      if (ms <= 0 && !fired.current) {
        fired.current = true;
        cb.current();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  const urgent = left < 5 * 60 * 1000;
  return (
    <span
      role="timer"
      aria-label={`Time left: ${format(left)}`}
      className={`crt-macro tabular-nums ${urgent ? "text-(--crt-red)" : "text-(--crt-ink)"}`}
    >
      {format(left)}
    </span>
  );
}
