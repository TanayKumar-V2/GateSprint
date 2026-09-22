"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/practice", label: "PRACTICE" },
  { href: "/mentor", label: "MENTOR" },
  { href: "/progress", label: "PROGRESS" },
  { href: "/about", label: "ABOUT" },
] as const;

/**
 * Hamburger unit for small screens: the desktop command row hides its
 * center links below `sm`, so this toggle exposes the same destinations
 * as a slide-in side panel. Escape/backdrop closes; body scroll locks
 * while open.
 */
export function MobileMenu() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open ]);

  return (
    <div className="flex items-stretch sm:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="landing-side-panel"
        aria-label="Open menu"
        className="crt-micro flex items-center border-l border-(--crt-line) px-4 py-3 text-[13px] font-bold text-(--crt-ink) transition-colors hover:bg-(--crt-ink) hover:text-(--crt-bg)"
      >
        [ = ]
      </button>
      <div
        aria-hidden={!open}
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-[60] bg-black/70 transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <div
        id="landing-side-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={cn(
          "fixed inset-y-0 right-0 z-[70] flex w-72 max-w-[85vw] flex-col border-l-2 border-(--crt-ink) bg-(--crt-bg) text-(--crt-ink) transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="crt-micro flex items-center justify-between border-b border-(--crt-line) px-5 py-3 text-[10px] text-(--crt-dim)">
          <span>[ NAV {"///"} GATE-SPRINT ]</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="border border-(--crt-line) px-2 py-1 text-[11px] text-(--crt-ink) transition-colors hover:border-(--crt-red) hover:bg-(--crt-red) hover:text-(--crt-bg)"
          >
            X
          </button>
        </div>
        <nav aria-label="Mobile">
          <ul className="crt-micro flex flex-col text-[13px]">
            {LINKS.map((link) => (
              <li key={link.href} className="border-b border-(--crt-line)">
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block px-5 py-4 text-(--crt-ink) transition-colors hover:bg-(--crt-red) hover:text-(--crt-bg)"
                >
                  [ {link.label} ]
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <p className="crt-micro mt-auto border-t border-(--crt-line) px-5 py-4 text-[10px] text-(--crt-dim)">
          GATE-SPRINT® {"///"} FIELD MANUAL REV 2.6
        </p>
      </div>
    </div>
  );
}
