import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "Which cookies GATE Mentor uses and why — no advertising trackers.",
};

export default function CookiesPage() {
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
          COOKIES<span className="text-(--crt-red)">.</span>
        </h1>
        <p className="crt-micro mt-3 text-[11px] text-(--crt-dim)">
          TRACKERS: NONE {"///"} ADS: NONE
        </p>
      </header>
      <section className="border border-(--crt-line) bg-(--crt-bg) px-4 py-5 sm:px-5">
        <h2 className="crt-micro text-[11px] font-bold text-(--crt-red)">
          [ 01 {"///"} STRICTLY NECESSARY ]
        </h2>
        <ul className="prose-study mt-3 list-disc space-y-2 pl-5 text-[15px] leading-7 text-(--crt-ink)">
          <li>
            <strong>Session cookie</strong> — keeps you signed in. Without it
            the workspace cannot tell your attempts from anyone
            else&apos;s. Expires when the session ends or is revoked.
          </li>
          <li>
            <strong>Theme preference</strong> — remembers your Tactical
            Telemetry vs Swiss Print display mode on this device only.
          </li>
        </ul>
      </section>
      <section className="border border-(--crt-line) bg-(--crt-bg) px-4 py-5 sm:px-5">
        <h2 className="crt-micro text-[11px] font-bold text-(--crt-red)">
          [ 02 {"///"} WHAT WE DO NOT DO ]
        </h2>
        <ul className="prose-study mt-3 list-disc space-y-2 pl-5 text-[15px] leading-7 text-(--crt-ink)">
          <li>No advertising cookies, no cross-site trackers, no analytics beacons.</li>
          <li>
            Google sign-in sets its own cookies during the OAuth handshake,
            governed by Google&apos;s policies — we neither read nor control
            them beyond completing sign-in.
          </li>
        </ul>
      </section>
      <section className="border border-(--crt-line) bg-(--crt-bg) px-4 py-5 sm:px-5">
        <h2 className="crt-micro text-[11px] font-bold text-(--crt-red)">
          [ 03 {"///"} CONTROL ]
        </h2>
        <p className="prose-study mt-3 text-[15px] leading-7 text-(--crt-ink)">
          Blocking all cookies in your browser will sign you out — the
          workspace requires its session cookie to function. Theme-only
          browsing of the landing and legal pages works without any
          GATE Mentor cookie at all. Questions:{" "}
          <Link
            href="/contact"
            className="font-medium text-(--crt-red) underline underline-offset-4"
          >
            contact us
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
