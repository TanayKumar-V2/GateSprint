import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Reach Gate Sprint: support email, phone, postal address, and response times.",
};

const CHANNELS = [
  {
    code: "C-01",
    label: "EMAIL",
    value: "hello@gatementor.in",
    href: "mailto:hello@gatementor.in",
    note: "Support, corrections, and account deletion requests. Replies within 2 working days.",
  },
  {
    code: "C-02",
    label: "PHONE",
    value: "+91 98765 43210",
    href: "tel:+919876543210",
    note: "Mon–Sat, 10:00–18:00 IST. For urgent access issues only.",
  },
  {
    code: "C-03",
    label: "POST",
    value: "4th Floor, 80 Residency Road, Bengaluru 560025, India",
    href: undefined,
    note: "Registered office of Axiom Learning Systems. Allow 7 working days for written correspondence.",
  },
];

export default function ContactPage() {
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
          CONTACT<span className="text-(--crt-red)">.</span>
        </h1>
        <p className="crt-micro mt-3 text-[11px] text-(--crt-dim)">
          RESPONSE WINDOW: 2 WORKING DAYS {"///"} PRIORITY: ACCESS ISSUES
        </p>
      </header>
      <div className="grid gap-px border border-(--crt-line) bg-(--crt-line) sm:grid-cols-3">
        {CHANNELS.map((channel) => (
          <section key={channel.code} className="bg-(--crt-bg) px-4 py-5 sm:px-5">
            <p className="crt-micro text-[10px] font-bold text-(--crt-red)">
              [ {channel.label} ] {channel.code}
            </p>
            {channel.href ? (
              <a
                href={channel.href}
                className="mt-3 block text-[15px] font-medium break-words text-(--crt-ink) underline underline-offset-4"
              >
                {channel.value}
              </a>
            ) : (
              <p className="mt-3 text-[15px] font-medium leading-7 text-(--crt-ink)">
                {channel.value}
              </p>
            )}
            <p className="crt-micro mt-2 text-[10px] leading-relaxed text-(--crt-dim)">
              {channel.note}
            </p>
          </section>
        ))}
      </div>
      <p className="crt-micro border border-(--crt-line) bg-(--crt-bg) px-4 py-4 text-[10px] leading-relaxed text-(--crt-dim) sm:px-5">
        REPORTING A WRONG QUESTION OR ANSWER? Include the subject, year, and
        question number as shown on the practice page — it routes straight to
        the curation queue.
      </p>
      <div className="flex items-center gap-4 border border-(--crt-line) bg-(--crt-bg) px-4 py-3 sm:px-5">
        <span className="crt-micro text-[10px] text-(--crt-dim)">
          GATE-SPRINT® {"///"} END OF FILE
        </span>
        <span aria-hidden="true" className="crt-barcode h-5 flex-1 text-(--crt-line)" />
        <span className="crt-micro text-[10px] text-(--crt-dim)">©2026</span>
      </div>
    </main>
  );
}
