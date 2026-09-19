import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "What GATE Mentor is, who operates it, and why it exists: focused GATE CS/IT preparation through previous-year questions and an AI tutor.",
};

export default function AboutPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <nav aria-label="Back">
        <Link
          href="/"
          className="crt-micro inline-block text-[11px] text-(--crt-dim) transition-colors hover:text-(--crt-red)"
        >
          &lt;&lt;&lt; HOME
        </Link>
      </nav>
      <header>
        <p className="crt-micro text-[11px] text-(--crt-red)">
          [ 00 {"///"} DOSSIER ]
        </p>
        <h1 className="crt-macro mt-2 text-[clamp(2.6rem,7vw,5rem)] leading-[0.9] text-(--crt-ink)">
          ABOUT<span className="text-(--crt-red)">.</span>
        </h1>
        <p className="crt-micro mt-3 text-[11px] text-(--crt-dim)">
          OPERATOR: AXIOM LEARNING SYSTEMS {"///"} BENGALURU, IN {"///"} EST.
          2024
        </p>
      </header>
      <section className="border border-(--crt-line) bg-(--crt-bg) px-4 py-5 sm:px-5">
        <h2 className="crt-micro text-[11px] font-bold text-(--crt-red)">
          [ 01 {"///"} MISSION ]
        </h2>
        <p className="prose-study mt-3 text-[15px] leading-7 text-(--crt-ink)">
          GATE Mentor exists for a single purpose: serious GATE Computer
          Science and IT preparation. No sprawling course catalog, no trial
          tiers, no noise — just previous-year questions organized by
          subject, topic, year, and difficulty, with every attempt validated
          on the server and every miss explained step by step by the Mentor.
        </p>
      </section>
      <section className="border border-(--crt-line) bg-(--crt-bg) px-4 py-5 sm:px-5">
        <h2 className="crt-micro text-[11px] font-bold text-(--crt-red)">
          [ 02 {"///"} METHOD ]
        </h2>
        <ul className="prose-study mt-3 list-disc space-y-2 pl-5 text-[15px] leading-7 text-(--crt-ink)">
          <li>
            Real previous-year questions — never auto-generated filler.
          </li>
          <li>
            Server-side grading, so accuracy analytics reflect real
            performance, not self-reported scores.
          </li>
          <li>
            A persistent AI tutor briefed on each question, your answer, and
            the solution — follow-ups stay in context.
          </li>
        </ul>
      </section>
      <section className="border border-(--crt-line) bg-(--crt-bg) px-4 py-5 sm:px-5">
        <h2 className="crt-micro text-[11px] font-bold text-(--crt-red)">
          [ 03 {"///"} OPERATOR ]
        </h2>
        <p className="prose-study mt-3 text-[15px] leading-7 text-(--crt-ink)">
          GATE Mentor is operated by Axiom Learning Systems, a small
          education technology outfit based in Bengaluru, India, founded in
          2024 by two former GATE rank-holders and one systems engineer. The
          entire question bank is curated and verified by hand; the Mentor is
          an AI assistant and its explanations should be cross-checked
          against standard references. Questions or corrections?{" "}
          <Link
            href="/contact"
            className="font-medium text-(--crt-red) underline underline-offset-4"
          >
            Contact us
          </Link>
          .
        </p>
      </section>
      <div className="flex items-center gap-4 border border-(--crt-line) bg-(--crt-bg) px-4 py-3 sm:px-5">
        <span className="crt-micro text-[10px] text-(--crt-dim)">
          GATE-MENTOR® {"///"} END OF FILE
        </span>
        <span aria-hidden="true" className="crt-barcode h-5 flex-1 text-(--crt-line)" />
        <span className="crt-micro text-[10px] text-(--crt-dim)">©2026</span>
      </div>
    </main>
  );
}
