"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Substrate switcher: Tactical Telemetry (dark) ↔ Swiss Print (light).
 * Square mono unit — shows the mode you switch TO. Mount-guarded so the
 * server render never mismatches the stored theme.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const dark = mounted ? resolvedTheme === "dark" : true;
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={cn(
        "crt-micro inline-flex items-center justify-center px-3 py-3 text-[11px] font-bold text-(--crt-dim) transition-colors outline-none hover:bg-(--crt-red) hover:text-(--crt-bg) focus-visible:bg-(--crt-red) focus-visible:text-(--crt-bg)",
        className,
      )}
    >
      {dark ? "[ LIGHT ]" : "[ DARK ]"}
    </button>
  );
}
