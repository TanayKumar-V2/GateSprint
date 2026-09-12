"use client";

import {
  createElement,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Scroll reveal driven by IntersectionObserver (never scroll listeners).
 * Content renders visible without JS; the hidden pre-state is applied
 * only on mount, so nothing is ever stuck invisible.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "li" | "span";
}) {
  const [el, setEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!el) return;
    el.classList.add("reveal");
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("is-in");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [el]);

  return createElement(
    as,
    {
      ref: setEl,
      className: cn(className),
      style: { "--reveal-delay": `${delay}ms` } as CSSProperties,
    },
    children,
  );
}
