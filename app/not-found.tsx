import Link from "next/link";

/**
 * Signal-lost terminal: macro 404 block, telemetry readout of the dead
 * route, and a compartmented nav grid back to live sectors. No app chrome
 * here on purpose — not-found renders outside all layouts.
 */
const ROUTES = [
  { href: "/", label: "HOME", code: "R-00", note: "LANDING /// PUBLIC" },
  { href: "/practice", label: "PRACTICE", code: "R-01", note: "QUESTION BANK" },
  { href: "/mentor", label: "MENTOR", code: "R-02", note: "AI CHANNEL" },
  { href: "/progress", label: "PROGRESS", code: "R-03", note: "TELEMETRY" },
];

export default function NotFound() {
  return (
    <main className="crt-landing mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 py-10 sm:px-6">
      <p className="crt-micro text-[11px] text-(--crt-red)">
        [ ERR {"///"} SIGNAL LOST ]
      </p>
      <h1
        aria-label="404 — page not found"
        className="crt-macro mt-2 text-[clamp(6rem,22vw,17rem)] leading-[0.85] tracking-[-0.05em] text-(--crt-ink)"
      >
        404<span className="text-(--crt-red)">.</span>
      </h1>
      <p className="crt-micro mt-4 max-w-xl text-[11px] leading-relaxed text-(--crt-dim)">
        TARGET NOT IN BANK {"///"} THE ROUTE YOU REQUESTED DOES NOT EXIST OR
        WAS DECOMMISSIONED. NOTHING WAS LOGGED. NOTHING WAS GRADED.
      </p>
      <dl className="crt-micro mt-8 grid max-w-xl grid-cols-2 gap-px border border-(--crt-line) bg-(--crt-line) text-[10px] sm:grid-cols-4">
        {[
          ["STATUS", "404"],
          ["SECTOR", "NULL"],
          ["RETRIES", "00"],
          ["COST", "0 MS"],
        ].map(([term, value]) => (
          <div key={term} className="bg-(--crt-bg) px-3 py-2.5">
            <dt className="text-(--crt-dim)">{term}</dt>
            <dd className="mt-1 text-sm font-bold text-(--crt-ink)">{value}</dd>
          </div>
        ))}
      </dl>
      <h2 className="crt-micro mt-10 text-[11px] font-bold text-(--crt-ink)">
        [ REROUTE {"///"} SELECT LIVE SECTOR ]
      </h2>
      <nav
        aria-label="Recovery"
        className="mt-3 grid gap-px border-2 border-(--crt-ink) bg-(--crt-ink) sm:grid-cols-2 lg:grid-cols-4"
      >
        {ROUTES.map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className="group bg-(--crt-bg) px-5 py-5 transition-colors hover:bg-(--crt-ink)"
          >
            <span className="crt-micro flex items-center justify-between text-[10px] text-(--crt-dim) transition-colors group-hover:text-(--crt-bg)">
              <span>{route.code}</span>
              <span aria-hidden="true">+</span>
            </span>
            <span className="crt-macro mt-2 block text-2xl text-(--crt-ink) transition-colors group-hover:text-(--crt-bg)">
              {route.label}
              <span className="text-(--crt-red)">_</span>
            </span>
            <span className="crt-micro mt-2 block text-[10px] text-(--crt-dim) transition-colors group-hover:text-(--crt-bg)">
              {route.note}
            </span>
          </Link>
        ))}
      </nav>
      <div className="mt-auto flex items-center gap-4 pt-10">
        <span className="crt-micro text-[10px] text-(--crt-dim)">
          GATE-MENTOR® {"///"} END OF SIGNAL
        </span>
        <span aria-hidden="true" className="crt-barcode h-5 flex-1 text-(--crt-line)" />
        <span className="crt-micro text-[10px] text-(--crt-dim)">©2026</span>
      </div>
    </main>
  );
}
