"use client";

import Link from "next/link";
import { useState } from "react";
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
 * as a full-width dropdown panel. Closes on navigation.
 */
export function MobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="landing-mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        className="crt-micro flex h-full items-center border-l border-(--crt-line) px-4 py-3 text-[13px] font-bold text-(--crt-ink) transition-colors hover:bg-(--crt-ink) hover:text-(--crt-bg)"
      >
        {open ? "[ X ]" : "[ = ]"}
      </button>
      <div
        id="landing-mobile-menu"
        className={cn(
          "absolute inset-x-0 top-full border-b-2 border-(--crt-ink) bg-(--crt-bg)",
          open ? "block" : "hidden",
        )}
      >
        <nav aria-label="Mobile">
          <ul className="crt-micro flex flex-col text-[12px]">
            {LINKS.map((link) => (
              <li key={link.href} className="border-t border-(--crt-line)">
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block px-5 py-3.5 text-(--crt-ink) transition-colors hover:bg-(--crt-red) hover:text-(--crt-bg)"
                >
                  [ {link.label} ]
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
