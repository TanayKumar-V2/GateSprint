import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How GATE Mentor collects, uses, retains, and deletes your data.",
};

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: "[ 01 /// DATA WE COLLECT ]",
    body: [
      "Account basics from Google sign-in: name, email address, and profile image. We cannot see your password and never ask for it.",
      "Study activity you generate: submitted answers, correctness, bookmarks, and Mentor chat messages. This is the product — without it there is no progress tracking.",
      "Technical minimums: server logs and rate-limit counters used to keep the service abuse-free.",
    ],
  },
  {
    heading: "[ 02 /// HOW WE USE IT ]",
    body: [
      "To run the service: authentication, saving attempts and bookmarks, rendering progress analytics, and briefing the Mentor on your questions.",
      "To improve question quality: aggregate, de-identified accuracy statistics guide curation. Your chats are never sold, shared with advertisers, or used to train third-party models.",
    ],
  },
  {
    heading: "[ 03 /// SHARING ]",
    body: [
      "Processors only: hosting and database infrastructure, Google for sign-in, and the AI provider that powers grading and Mentor replies. Each sees only what its job requires.",
      "We disclose data when the law compels it, and we will tell you first unless legally barred.",
    ],
  },
  {
    heading: "[ 04 /// RETENTION + DELETION ]",
    body: [
      "Study data lives with your account until you delete it. Email hello@gatementor.in from your registered address with the subject DELETE MY DATA and everything tied to your account — attempts, bookmarks, chats, profile — is removed within 14 days. Backups age out within 30 days.",
    ],
  },
  {
    heading: "[ 05 /// YOUR RIGHTS ]",
    body: [
      "Access, correction, export, and deletion on request at the address above. Users under 18 should use the service with a guardian's involvement.",
    ],
  },
];

export default function PrivacyPage() {
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
          PRIVACY<span className="text-(--crt-red)">.</span>
        </h1>
        <p className="crt-micro mt-3 text-[11px] text-(--crt-dim)">
          OPERATOR: AXIOM LEARNING SYSTEMS {"///"} CONTACT:{" "}
          <a
            href="mailto:hello@gatementor.in"
            className="underline underline-offset-4"
          >
            HELLO@GATEMENTOR.IN
          </a>
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
