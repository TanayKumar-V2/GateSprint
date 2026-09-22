"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "/practice", label: "PRACTICE", code: "D-01" },
  { href: "/mentor", label: "MENTOR", code: "D-02" },
  { href: "/progress", label: "PROGRESS", code: "D-03" },
  { href: "/bookmarks", label: "SAVED", code: "D-04" },
  { href: "/mistakes", label: "MISTAKES", code: "D-05" },
  { href: "/revision", label: "REVISION", code: "D-06" },
  { href: "/syllabus", label: "SYLLABUS", code: "D-07" },
  { href: "/mocks", label: "MOCKS", code: "D-08" },
  { href: "/trends", label: "TRENDS", code: "D-09" },
  { href: "/sheets", label: "SHEETS", code: "D-10" },
] as const;

const PAGES = [
  { href: "/about", label: "ABOUT US" },
  { href: "/contact", label: "CONTACT US" },
  { href: "/privacy", label: "PRIVACY POLICY" },
  { href: "/cookies", label: "COOKIE POLICY" },
  { href: "/terms", label: "TERMS" },
] as const;

/**
 * Phone navigation: the desktop section bar hides below `sm` and this
 * hamburger opens it as a slide-in side panel instead. Escape/backdrop
 * closes; body scroll locks while open.
 */
export function MobileNav({
  onSignOut,
}: {
  onSignOut: () => Promise<void>;
}) {
  const pathname = usePathname();
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
    <div className="flex min-w-0 flex-1 items-stretch sm:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="dashboard-side-panel"
        aria-label="Open navigation"
        className="crt-micro flex items-center px-4 py-3 text-[13px] font-bold text-(--crt-ink) transition-colors hover:bg-(--crt-ink) hover:text-(--crt-bg)"
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
        id="dashboard-side-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Study sections"
        className={cn(
          "fixed inset-y-0 left-0 z-[70] flex w-72 max-w-[85vw] flex-col border-r-2 border-(--crt-ink) bg-(--crt-bg) text-(--crt-ink) transition-transform duration-300",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="crt-micro flex items-center justify-between border-b border-(--crt-line) px-5 py-3 text-[10px] text-(--crt-dim)">
          <span>[ NAV {"///"} STUDY DECK ]</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            className="border border-(--crt-line) px-2 py-1 text-[11px] text-(--crt-ink) transition-colors hover:border-(--crt-red) hover:bg-(--crt-red) hover:text-(--crt-bg)"
          >
            X
          </button>
        </div>
        <nav aria-label="Study sections" className="overflow-y-auto">
          <ul className="crt-micro flex flex-col text-[13px]">
            {SECTIONS.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href} className="border-b border-(--crt-line)">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center justify-between px-5 py-4 transition-colors",
                      active
                        ? "bg-(--crt-raised) font-bold text-(--crt-ink)"
                        : "text-(--crt-dim) hover:bg-(--crt-ink) hover:text-(--crt-bg)",
                    )}
                  >
                    <span>[ {item.label} ]</span>
                    <span className="text-[9px] opacity-60">{item.code}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="crt-micro px-5 pb-1 pt-4 text-[10px] text-(--crt-dim)">
            [ DOSSIER ]
          </p>
          <ul className="crt-micro flex flex-col text-[11px]">
            {PAGES.map((page) => (
              <li key={page.href}>
                <Link
                  href={page.href}
                  onClick={() => setOpen(false)}
                  className="block px-5 py-2.5 text-(--crt-dim) transition-colors hover:bg-(--crt-ink) hover:text-(--crt-bg)"
                >
                  {">>>"} {page.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <form
          action={onSignOut}
          className="mt-auto border-t border-(--crt-line) p-3"
        >
          <button
            type="submit"
            className="crt-micro w-full border border-(--crt-edge) px-4 py-3 text-[11px] font-bold text-(--crt-ink) transition-colors hover:bg-(--crt-red) hover:text-(--crt-bg)"
          >
            SIGN OUT
          </button>
        </form>
      </div>
    </div>
  );
}
