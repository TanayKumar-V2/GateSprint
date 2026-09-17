import Link from "next/link";

const SLICES = [
  {
    href: "/practice",
    index: "01",
    unit: "UNIT / D-01",
    title: "PRACTICE",
    body: "FILTER PYQS BY SUBJECT, TOPIC, YEAR, TYPE. EVERY ATTEMPT VALIDATED ON THE SERVER. NO ESTIMATES.",
    readout: "CH 08 /// BANK 083+",
  },
  {
    href: "/mentor",
    index: "02",
    unit: "UNIT / D-02",
    title: "MENTOR",
    body: "PERSISTENT TUTOR. REMEMBERS YOUR PICK + SOLUTION. EXPLAINS STEP BY STEP, TRAPS INCLUDED.",
    readout: "CTX LOCKED /// 24/7",
  },
  {
    href: "/progress",
    index: "03",
    unit: "UNIT / D-03",
    title: "PROGRESS",
    body: "ACCURACY + WEAK TOPICS COMPUTED FROM REAL ATTEMPTS. OUTPUT, NOT OPINION.",
    readout: "SRC ATTEMPTS /// LIVE",
  },
  {
    href: "/practice?bookmarked=true",
    index: "04",
    unit: "UNIT / D-04",
    title: "SAVED",
    body: "BOOKMARK THE QUESTIONS THAT STUNG. REVISIT THEM IN ONE FOCUSED KILL-LIST.",
    readout: "BUF LOCAL /// SYNCED",
  },
];

/**
 * Operational index: four entry doors rendered as a bordered ledger.
 * Razor dividers via 1px grid gap; hover floods the row red.
 * Keyboard-first: every row is a real link with visible focus.
 */
export function FeatureAccordion() {
  return (
    <div role="list" className="crt-grid-lines">
      {SLICES.map((slice) => (
        <Link
          key={slice.title}
          role="listitem"
          href={slice.href}
          className="group grid grid-cols-[auto_1fr_auto] items-stretch gap-0 bg-(--crt-bg) text-(--crt-ink) transition-colors duration-150 hover:bg-(--crt-red) hover:text-(--crt-bg) focus-visible:bg-(--crt-red) focus-visible:text-(--crt-bg) focus-visible:outline-none"
        >
          <span className="crt-macro flex items-center border-r border-(--crt-line) px-4 py-6 text-[clamp(2rem,5vw,3.5rem)] group-hover:border-(--crt-bg) sm:px-8">
            {slice.index}
          </span>
          <span className="flex min-w-0 flex-col justify-center gap-2 px-4 py-6 sm:px-8">
            <span className="crt-micro text-[10px] opacity-70">
              {slice.unit} {"///"} {slice.readout}
            </span>
            <span className="crt-macro text-[clamp(1.6rem,4vw,3rem)]">
              {slice.title}
              <span aria-hidden="true" className="ml-3 inline-block text-[0.6em] align-middle opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                &gt;&gt;&gt;
              </span>
            </span>
            <span className="crt-micro max-w-2xl text-[11px] leading-relaxed opacity-70 sm:text-[12px]">
              {slice.body}
            </span>
          </span>
          <span aria-hidden="true" className="crt-micro hidden items-center border-l border-(--crt-line) px-6 text-[11px] group-hover:border-(--crt-bg) md:flex">
            OPEN +
          </span>
        </Link>
      ))}
    </div>
  );
}
