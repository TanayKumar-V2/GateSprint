"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

/**
 * Doctrine scrub: manifesto words ignite dim-to-phosphor on scroll.
 * JS-only initial state — no-JS / reduced-motion readers get final copy.
 */
export function ScrubReveal({ text }: { text: string }) {
  const scope = useRef<HTMLElement>(null);
  const words = text.split(" ");

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const targets = gsap.utils.toArray<HTMLElement>("[data-scrub-word]", scope.current ?? undefined);
      if (targets.length === 0) return;
      gsap.fromTo(
        targets,
        { opacity: 0.12 },
        {
          opacity: 1,
          stagger: 0.06,
          ease: "none",
          scrollTrigger: {
            trigger: scope.current,
            start: "top 78%",
            end: "bottom 45%",
            scrub: 0.6,
          },
        },
      );
    },
    { scope },
  );

  return (
    <section ref={scope} aria-label="Doctrine" className="border-y-2 border-(--crt-ink) bg-(--crt-panel) px-4 py-16 sm:px-8 sm:py-24">
      <p className="crt-micro mb-8 text-[11px] text-(--crt-red)">
        [ FIELD-DOCTRINE {"///"} DOC-77 ] ++++++++++++++++++++++++++++++++++++++
      </p>
      <p className="crt-macro crt-phosphor max-w-6xl text-[clamp(1.8rem,4.6vw,4rem)] text-(--crt-ink)">
        {words.map((word, i) => (
          <span key={`${word}-${i}`}>
            <span data-scrub-word>{word}</span>
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </p>
      <p className="crt-micro mt-8 text-[11px] text-(--crt-dim)">
        END-OF-TRANSMISSION <span className="crt-blink inline-block h-3 w-2 bg-(--crt-ink) align-middle" />
      </p>
    </section>
  );
}
