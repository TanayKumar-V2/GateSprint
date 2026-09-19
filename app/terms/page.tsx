import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The rules for using GATE Mentor: accounts, acceptable use, and AI content.",
};

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: "[ 01 /// THE SERVICE ]",
    body: [
      "GATE Mentor provides previous-year GATE CS/IT practice questions, server-validated attempts, progress analytics, and an AI tutor. Features evolve; placeholders in the product are exactly that — not promises.",
    ],
  },
  {
    heading: "[ 02 /// ACCOUNTS ]",
    body: [
      "One account per person, via Google sign-in. You are responsible for activity under your account. Shared-device users should sign out — sign-in always asks which Google account to use.",
      "We may suspend accounts for abuse: scraping the bank, hammering the AI endpoints past rate limits, or attacking the service.",
    ],
  },
  {
    heading: "[ 03 /// AI CONTENT DISCLAIMER ]",
    body: [
      "Mentor explanations and first-attempt grades are machine-generated and can be wrong. Cross-check against standard references before trusting anything for the real exam. Flag errors through the contact page — corrections go to the curation queue.",
    ],
  },
  {
    heading: "[ 04 /// ACCEPTABLE USE ]",
    body: [
      "Practice for yourself. Do not resell, scrape, or republish the question bank, solutions, or Mentor output. Do not paste other people's personal data into chats.",
    ],
  },
  {
    heading: "[ 05 /// LIABILITY + CHANGES ]",
    body: [
      "The service is provided as-is for exam preparation; no score outcomes are guaranteed. Continued use after posted changes means acceptance. Questions about these terms go to hello@gatementor.in.",
    ],
  },
];

export default function TermsPage() {
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
          [ 00 {"///"} PROTOCOL {"///"} REV 2026.01 ]
        </p>
        <h1 className="crt-macro mt-2 text-[clamp(2.6rem,7vw,5rem)] leading-[0.9] text-(--crt-ink)">
          TERMS<span className="text-(--crt-red)">.</span>
        </h1>
        <p className="crt-micro mt-3 text-[11px] text-(--crt-dim)">
          OPERATOR: AXIOM LEARNING SYSTEMS
        </p>
      </header>
      {SECTIONS.map((section) => (
        <section
          key={section.heading}
          className="border border-(--crt-line) bg-(--crt-bg) px-4 py-5 sm:px-5"
        >
          <h2 className="crt-micro text-[11px] font-bold text-(--crt-red)">
            {section.heading}
          </h2>
          <ul className="prose-study mt-3 list-disc space-y-2 pl-5 text-[15px] leading-7 text-(--crt-ink)">
            {section.body.map((paragraph) => (
              <li key={paragraph.slice(0, 24)}>{paragraph}</li>
            ))}
          </ul>
        </section>
      ))}
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
