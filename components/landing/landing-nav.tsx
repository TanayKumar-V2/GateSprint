import Link from "next/link";
import { isSignInConfigured } from "@/lib/auth";
import { SignInDialog } from "@/components/auth/sign-in-dialog";
import { ThemeLogo } from "@/components/theme-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileMenu } from "@/components/landing/mobile-menu";

/**
 * TACTICAL TELEMETRY nav unit.
 * Rigid 1px compartment bar: status strip over a bordered command row.
 * Square corners, monospace micro-type, single red action block.
 * INITIATE opens the auth modal in place — no page navigation.
 */
export async function LandingNav() {
  const configured = isSignInConfigured();

  return (
    <header className="sticky top-0 z-50 border-b-2 border-(--crt-ink) bg-(--crt-bg) text-(--crt-ink)">
      {/* SYS status strip */}
      <div
        aria-hidden="true"
        className="crt-micro flex items-center justify-between gap-4 border-b border-(--crt-line) px-4 py-1.5 text-[10px] text-(--crt-dim) sm:px-6 sm:text-[11px]"
      >
        <span>
          SYS.STATUS: <span className="text-(--crt-ok)">NOMINAL</span>
          <span className="crt-blink ml-2 inline-block h-2 w-2 bg-(--crt-ok)" />
        </span>
        <span className="hidden md:inline">GATE-CS/IT {"///"} PYQ-TELEMETRY-ARRAY {"///"} REV 2.6</span>
        <span>UNIT / D-01</span>
      </div>
      {/* Command row */}
      <nav aria-label="Primary" className="relative grid grid-cols-[1fr_auto] sm:grid-cols-[auto_1fr_auto]">
        <Link
          href="/"
          className="crt-micro flex min-w-0 items-center gap-3 border-r border-(--crt-line) px-3 py-3 text-[12px] font-bold sm:px-6 sm:text-[13px]"
        >
          <ThemeLogo />
          <span className="truncate">
            GATE-MENTOR<span className="text-(--crt-red)">_</span>
          </span>
        </Link>
        <div className="crt-micro hidden items-center justify-center gap-8 text-[11px] text-(--crt-dim) sm:flex">
          <Link href="/practice" className="transition-colors hover:text-(--crt-ink) hover:underline hover:decoration-(--crt-red) hover:decoration-2 hover:underline-offset-4">
            [ PRACTICE ]
          </Link>
          <Link href="/mentor" className="transition-colors hover:text-(--crt-ink) hover:underline hover:decoration-(--crt-red) hover:decoration-2 hover:underline-offset-4">
            [ MENTOR ]
          </Link>
          <Link href="/progress" className="transition-colors hover:text-(--crt-ink) hover:underline hover:decoration-(--crt-red) hover:decoration-2 hover:underline-offset-4">
            [ PROGRESS ]
          </Link>
        </div>
        <div className="flex min-w-0 items-stretch">
          <MobileMenu />
          <ThemeToggle className="border-l border-(--crt-line)" />
          <SignInDialog
            configured={configured}
            triggerClassName="crt-micro border-l border-(--crt-line) bg-(--crt-red) px-3 py-3 text-[11px] font-bold text-(--crt-bg) transition-colors hover:bg-(--crt-ink) sm:px-8 sm:text-[12px]"
          >
            INITIATE &gt;&gt;&gt;
          </SignInDialog>
        </div>
      </nav>
    </header>
  );
}
