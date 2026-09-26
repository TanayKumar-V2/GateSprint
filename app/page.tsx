import Link from "next/link";
import { redirect } from "next/navigation";
import { LandingNav } from "@/components/landing/landing-nav";
import { SubjectMarquee } from "@/components/landing/subject-marquee";
import { FeatureAccordion } from "@/components/landing/feature-accordion";
import { ScrubReveal } from "@/components/landing/scrub-reveal";
import { ScaleGallery } from "@/components/landing/scale-gallery";
import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { FooterColophon, FooterLinkGroups } from "@/components/site-footer";
import { currentUserId } from "@/lib/current-user";
import { isSignInConfigured } from "@/lib/auth";

const SIGNAL_ROWS = [
  ["OPERATING SYSTEMS", "CS-01", "142 PYQ", "HIGH YIELD"],
  ["ALGORITHMS", "CS-02", "168 PYQ", "HIGH YIELD"],
  ["DATABASES", "CS-03", "121 PYQ", "STABLE"],
  ["COMPUTER NETWORKS", "CS-04", "135 PYQ", "VOLATILE"],
  ["THEORY OF COMPUTATION", "CS-05", "118 PYQ", "HIGH YIELD"],
  ["DIGITAL LOGIC", "CS-06", "096 PYQ", "STABLE"],
  ["COMPILER DESIGN", "CS-07", "064 PYQ", "STABLE"],
  ["DATA STRUCTURES", "CS-08", "090 PYQ", "HIGH YIELD"],
] as const;

export default async function Home() {
  // Signed-in users already have a workspace waiting — skip the marketing
  // page and send them straight to practice.
  if (await currentUserId()) redirect("/practice");

  const configured = isSignInConfigured();

  // Structured data for search: the landing page is the only public,
  // indexable surface, so the organization + app schema lives here.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "Gate Sprint",
        url: "/",
        description:
          "GATE Computer Science preparation: previous-year question practice with an AI tutor.",
        inLanguage: "en-IN",
      },
      {
        "@type": "SoftwareApplication",
        name: "Gate Sprint",
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
        description:
          "Practice GATE CS/IT previous-year questions by subject, topic, year, and difficulty, with step-by-step Mentor explanations and accuracy analytics.",
      },
    ],
  };

  return (
    <main id="main" className="crt-landing crt-noise relative w-full max-w-full overflow-x-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:bg-(--crt-red) focus:px-4 focus:py-2 focus:font-mono focus:text-xs focus:font-bold focus:uppercase focus:text-(--crt-bg)"
      >
        Skip to content
      </a>
      <LandingNav />

      {/* HERO — terminal command deck */}
      <section id="main-content" aria-label="Command deck" className="relative border-b-2 border-(--crt-ink)">
        <div aria-hidden="true" className="crt-scanlines pointer-events-none absolute inset-0" />
        {/* crosshairs at compartment corners */}
        <span aria-hidden="true" className="crt-micro absolute left-3 top-3 z-10 text-(--crt-dim)">+</span>
        <span aria-hidden="true" className="crt-micro absolute right-3 top-3 z-10 text-(--crt-dim)">+</span>
        <span aria-hidden="true" className="crt-micro absolute bottom-3 left-3 z-10 text-(--crt-dim)">+</span>
        <span aria-hidden="true" className="crt-micro absolute bottom-3 right-3 z-10 text-(--crt-dim)">+</span>

        {/* meta telemetry strip */}
        <dl className="crt-grid-lines relative grid-cols-2 md:grid-cols-4">
          <div className="flex items-center justify-between px-4 py-2.5 sm:px-6">
            <dt className="crt-micro text-[10px] text-(--crt-dim)">EXAM</dt>
            <dd className="crt-micro text-[11px] text-(--crt-ink)">
              <data value="GATE-CS-IT">GATE CS/IT ©</data>
            </dd>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 sm:px-6">
            <dt className="crt-micro text-[10px] text-(--crt-dim)">MODE</dt>
            <dd className="crt-micro text-[11px] text-(--crt-ink)">
              <samp>PYQ-ARRAY™</samp>
            </dd>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 sm:px-6">
            <dt className="crt-micro text-[10px] text-(--crt-dim)">BANK</dt>
            <dd className="crt-micro text-[11px] text-(--crt-ink)">
              <output>083+ UNITS</output>
            </dd>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 sm:px-6">
            <dt className="crt-micro text-[10px] text-(--crt-dim)">LINK</dt>
            <dd className="crt-micro text-[11px] text-(--crt-ok)">● LIVE</dd>
          </div>
        </dl>

        <div className="relative px-4 pb-14 pt-14 sm:px-8 sm:pt-20">
          <p className="crt-micro text-[11px] text-(--crt-red) sm:text-xs">
            FREE. GATE CS/IT 2010-2025. 1000+ PYQS.
          </p>
          <h1 className="crt-macro crt-phosphor mt-6 text-[clamp(2.5rem,10vw,11rem)] text-(--crt-ink)">
            MAKE EVERY
            <br />
            QUESTION{" "}
            <span className="bg-(--crt-red) px-3 text-(--crt-bg) [text-shadow:none]">
              COUNT®
            </span>
          </h1>
          <div className="mt-10 grid gap-px border border-(--crt-line) bg-(--crt-line) md:grid-cols-[1fr_auto]">
            <p className="crt-micro bg-(--crt-bg) px-5 py-5 text-[11px] leading-relaxed text-(--crt-dim) sm:px-8 sm:text-[13px]">
              <span className="text-(--crt-ink)">PRACTICE PREVIOUS-YEAR QUESTIONS.</span> GET
              STEP-BY-STEP EXPLANATIONS FROM A MENTOR THAT REMEMBERS YOUR
              CONTEXT — PICK + SOLUTION ATTACHED. NO GUESSWORK. SIGNAL ONLY.
            </p>
            <div className="flex flex-col bg-(--crt-bg) sm:flex-row md:flex-col lg:flex-row">
              <Link
                href="/practice"
                className="crt-micro border-b border-(--crt-line) bg-(--crt-red) px-8 py-5 text-center text-[13px] font-bold text-(--crt-bg) transition-colors hover:bg-(--crt-ink) sm:border-b-0 sm:border-r lg:border-b-0"
              >
                START PRACTICING &gt;&gt;&gt;
              </Link>
              <Link
                href="/mentor"
                className="crt-micro px-8 py-5 text-center text-[13px] text-(--crt-ink) transition-colors hover:bg-(--crt-ink) hover:text-(--crt-bg)"
              >
                &lt; ASK MENTOR &gt;
              </Link>
            </div>
          </div>
          <p className="crt-micro mt-6 flex flex-wrap gap-x-8 gap-y-2 text-[10px] text-(--crt-dim) sm:text-[11px]">
            <span>\\\\ FEED STABLE \\\\ LAT 28.61N LON 77.20E</span>
          </p>
        </div>
        <div aria-hidden="true" className="crt-stripes h-4 w-full border-t-2 border-(--crt-ink)" />
      </section>

      <SubjectMarquee />

      {/* 01 — OPERATIONAL UNITS */}
      <section aria-label="Operational units" className="border-b-2 border-(--crt-ink)">
        <div className="flex flex-wrap items-end justify-between gap-4 px-4 pb-8 pt-14 sm:px-8">
          <div>
            <p className="crt-micro text-[11px] text-(--crt-red)">[ 01 {"///"} DELIVERY SYSTEMS ]</p>
            <h2 className="crt-macro mt-3 text-[clamp(2rem,6vw,5.5rem)] text-(--crt-ink)">
              FOUR DOORS.
              <br />
              ONE WORKSPACE.
            </h2>
          </div>
          <p className="crt-micro max-w-xs text-[11px] leading-relaxed text-(--crt-dim)">
            SELECT AN ENTRY POINT. EACH UNIT OPENS EXACTLY WHERE YOU EXPECT. NO
            ONBOARDING. NO DECORATION.
          </p>
        </div>
        <div className="border-t border-(--crt-line)">
          <FeatureAccordion />
        </div>
        {/* stat readout band */}
        <dl className="crt-grid-lines grid-cols-2 md:grid-cols-4">
          {[
            ["083+", "PYQ UNITS", "BANK / LIVE"],
            ["08", "SUBJECTS", "COVERAGE / FULL"],
            ["04", "ENTRY DOORS", "ACCESS / OPEN"],
            ["01", "MENTOR", "CONTEXT / LOCKED"],
          ].map(([value, label, sub]) => (
            <div key={label} className="px-4 py-6 sm:px-8">
              <dd className="crt-macro text-[clamp(2.4rem,5vw,4.5rem)] text-(--crt-ink)">
                {value}
                <span className="text-(--crt-red)">.</span>
              </dd>
              <dt className="crt-micro mt-2 text-[10px] text-(--crt-ink)">{label}</dt>
              <p className="crt-micro text-[10px] text-(--crt-dim)">{sub}</p>
            </div>
          ))}
        </dl>
      </section>

      {/* 02 — PROTOCOL */}
      <section aria-label="Protocol" className="border-b-2 border-(--crt-ink)">
        <div className="flex flex-wrap items-end justify-between gap-4 px-4 pb-8 pt-14 sm:px-8">
          <div>
            <p className="crt-micro text-[11px] text-(--crt-red)">[ 02 {"///"} OPERATING PROTOCOL ]</p>
            <h2 className="crt-macro mt-3 text-[clamp(2rem,6vw,5.5rem)] text-(--crt-ink)">
              ATTEMPT. MISS.
              <br />
              PATCH. RETAIN.
            </h2>
          </div>
          <p className="crt-micro max-w-xs text-[11px] leading-relaxed text-(--crt-dim)">
            THE LOOP IS THE PRODUCT. EVERY ATTEMPT TEACHES: THE TRAP, THE
            CONCEPT, THE FASTEST WAY BACK.
          </p>
        </div>
        <ScaleGallery
          images={[
            {
              src: "phase-01",
              alt: "TIMED PYQ ATTEMPT UNDER EXAM PRESSURE",
              caption: "ATTEMPT WITH INTENT",
            },
            {
              src: "phase-02",
              alt: "STEP-BY-STEP MENTOR DISSECTION OF EACH MISS",
              caption: "UNDERSTAND EVERY MISS",
            },
            {
              src: "phase-03",
              alt: "BOOKMARKED REVISION QUEUE BEFORE EXAM DAY",
              caption: "RETAIN WHAT MATTERS",
            },
          ]}
        />
      </section>

      {/* 03 — SIGNAL TABLE */}
      <section aria-label="Signal table" className="border-b-2 border-(--crt-ink)">
        <div className="px-4 pb-8 pt-14 sm:px-8">
          <p className="crt-micro text-[11px] text-(--crt-red)">[ 03 {"///"} SIGNAL TABLE ]</p>
          <h2 className="crt-macro mt-3 text-[clamp(2rem,6vw,5.5rem)] text-(--crt-ink)">
            READ THE BOARD.
          </h2>
        </div>
        <div className="overflow-x-auto border-t border-(--crt-line)">
          <table className="crt-micro w-full min-w-[640px] border-collapse text-left text-[11px] sm:text-[12px]">
            <thead>
              <tr className="border-b-2 border-(--crt-ink) text-(--crt-dim)">
                <th scope="col" className="px-4 py-3 font-normal sm:px-8">SUBJECT</th>
                <th scope="col" className="px-4 py-3 font-normal">CODE</th>
                <th scope="col" className="px-4 py-3 font-normal">VOLUME</th>
                <th scope="col" className="px-4 py-3 font-normal">ASSESSMENT</th>
                <th scope="col" className="px-4 py-3 text-right font-normal sm:px-8">FEED</th>
              </tr>
            </thead>
            <tbody>
              {SIGNAL_ROWS.map(([subject, code, volume, assessment], i) => (
                <tr
                  key={code}
                  className="border-b border-(--crt-line) text-(--crt-ink) transition-colors last:border-b-0 hover:bg-(--crt-red) hover:text-(--crt-bg)"
                >
                  <th scope="row" className="px-4 py-4 font-bold sm:px-8">
                    {String(i + 1).padStart(2, "0")} {"///"} {subject}
                  </th>
                  <td className="px-4 py-4">
                    <samp>[{code}]</samp>
                  </td>
                  <td className="px-4 py-4">
                    <data value={volume}>{volume}</data>
                  </td>
                  <td className="px-4 py-4">{assessment}</td>
                  <td className="px-4 py-4 text-right sm:px-8">++++</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ScrubReveal text="YOU DO NOT NEED MORE MATERIAL. YOU NEED EVERY ATTEMPT TO TEACH YOU SOMETHING — THE TRAP YOU FELL FOR, THE CONCEPT UNDERNEATH IT, AND THE FASTEST WAY BACK." />

      {/* TERMINAL CLOSE */}
      <section aria-label="Initiate" className="relative">
        <div aria-hidden="true" className="crt-scanlines pointer-events-none absolute inset-0" />
        <div className="relative px-4 pb-0 pt-16 sm:px-8 sm:pt-24">
          <p className="crt-micro text-[11px] text-(--crt-red)">[ FINAL TRANSMISSION {"///"} AUTH REQUIRED ]</p>
          <h2 className="crt-macro crt-phosphor mt-4 text-[clamp(2.5rem,9vw,10rem)] text-(--crt-ink)">
            STOP GUESSING.
            <br />
            START <span className="text-(--crt-red) [text-shadow:none]">KNOWING.</span>
          </h2>
          <p className="crt-micro mt-6 max-w-xl text-[11px] leading-relaxed text-(--crt-dim) sm:text-[12px]">
            ONE ACCOUNT KEEPS YOUR ATTEMPTS, BOOKMARKS, AND MENTOR CHATS IN
            SYNC. INITIALIZE BELOW. NO TRIAL TIERS. NO NOISE.
          </p>
          <div className="mt-10 grid gap-px border-2 border-(--crt-ink) bg-(--crt-ink) sm:grid-cols-2">
            <SignInDialog
              configured={configured}
              triggerClassName="crt-micro bg-(--crt-red) px-8 py-6 text-center text-[14px] font-bold text-(--crt-bg) transition-colors hover:bg-(--crt-ink)"
            >
              SIGN IN WITH GOOGLE &gt;&gt;&gt;
            </SignInDialog>
            <Link
              href="/practice"
              className="crt-micro bg-(--crt-bg) px-8 py-6 text-center text-[14px] text-(--crt-ink) transition-colors hover:bg-(--crt-ink) hover:text-(--crt-bg)"
            >
              OPEN THE QUESTION BANK +
            </Link>
          </div>
        </div>
        <footer className="relative mt-16 border-t-2 border-(--crt-ink)">
          <FooterLinkGroups />
          <div className="grid gap-px bg-(--crt-line) md:grid-cols-[1fr_auto_1fr]">
            <p className="crt-micro bg-(--crt-bg) px-4 py-4 text-[11px] text-(--crt-ink) sm:px-8">
              GATE-SPRINT® {"///"} <span className="text-(--crt-dim)">FIELD MANUAL REV 2.6</span>
            </p>
            <nav aria-label="Footer" className="crt-micro flex flex-wrap bg-(--crt-bg) text-[11px]">
              <Link href="/practice" className="border-x border-(--crt-line) px-5 py-4 transition-colors hover:bg-(--crt-ink) hover:text-(--crt-bg)">
                PRACTICE
              </Link>
              <Link href="/mentor" className="border-r border-(--crt-line) px-5 py-4 transition-colors hover:bg-(--crt-ink) hover:text-(--crt-bg)">
                MENTOR
              </Link>
              <Link href="/about" className="border-r border-(--crt-line) px-5 py-4 transition-colors hover:bg-(--crt-ink) hover:text-(--crt-bg)">
                ABOUT
              </Link>
              <Link href="/contact" className="border-r border-(--crt-line) px-5 py-4 transition-colors hover:bg-(--crt-ink) hover:text-(--crt-bg)">
                CONTACT
              </Link>
              <Link href="/privacy" className="border-r border-(--crt-line) px-5 py-4 transition-colors hover:bg-(--crt-ink) hover:text-(--crt-bg)">
                PRIVACY
              </Link>
              <SignInDialog
                configured={configured}
                triggerClassName="px-5 py-4 transition-colors hover:bg-(--crt-ink) hover:text-(--crt-bg)"
              >
                SIGN-IN
              </SignInDialog>
            </nav>
            <FooterColophon className="border-t border-(--crt-line) md:col-span-3" />
          </div>
        </footer>
      </section>
    </main>
  );
}
