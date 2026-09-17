"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

type GalleryImage = { src: string; alt: string; caption: string };

/**
 * Dossier array: three protocol cards. Source imagery is discarded in
 * favor of bleeding index numerals, halftone disruption, and <dl> spec
 * readouts. Scroll motion preserved (rise + settle, JS-only).
 */
export function ScaleGallery({ images }: { images: GalleryImage[] }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const cards = gsap.utils.toArray<HTMLElement>("[data-scale-card]", scope.current ?? undefined);
      for (const card of cards) {
        gsap.fromTo(
          card,
          { y: 48, opacity: 0.2 },
          {
            y: 0,
            opacity: 1,
            ease: "none",
            scrollTrigger: { trigger: card, start: "top 95%", end: "top 55%", scrub: 0.6 },
          },
        );
      }
    },
    { scope },
  );

  return (
    <div ref={scope} className="crt-grid-lines md:grid-cols-3">
      {images.map((image, i) => (
        <figure key={image.src} data-scale-card className="relative overflow-hidden bg-(--crt-bg)">
          {/* Bleeding index numeral + halftone disruption */}
          <div aria-hidden="true" className="crt-halftone relative overflow-hidden border-b border-(--crt-line)">
            <span className="crt-macro block select-none px-4 pt-2 text-[clamp(5rem,9vw,8.5rem)] leading-[0.85] text-(--crt-ink)">
              0{i + 1}
            </span>
            <span aria-hidden="true" className="crt-stripes block h-3 w-full border-t border-(--crt-line)" />
          </div>
          <div className="px-5 py-6">
            <p className="crt-micro text-[10px] text-(--crt-red)">PHASE / 0{i + 1} {"///"} ACTIVE</p>
            <figcaption className="crt-macro mt-2 text-[clamp(1.4rem,2.6vw,2.2rem)] text-(--crt-ink)">
              {image.caption}
            </figcaption>
            <dl className="crt-micro mt-5 grid grid-cols-2 gap-px border border-(--crt-line) bg-(--crt-line) text-[10px]">
              <dt className="bg-(--crt-bg) px-3 py-2 text-(--crt-dim)">INPUT</dt>
              <dd className="bg-(--crt-bg) px-3 py-2 text-(--crt-ink)">{image.alt}</dd>
              <dt className="bg-(--crt-bg) px-3 py-2 text-(--crt-dim)">OUTPUT</dt>
              <dd className="bg-(--crt-bg) px-3 py-2 text-(--crt-ink)">
                <output>SIGNAL LOCKED</output>
              </dd>
            </dl>
          </div>
          <span aria-hidden="true" className="crt-micro absolute right-3 top-3 text-[10px] text-(--crt-dim)">
            +
          </span>
        </figure>
      ))}
    </div>
  );
}
