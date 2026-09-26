import Link from "next/link";
import { currentUser, requireUserId } from "@/lib/current-user";
import { ensureUsername } from "@/lib/profile";
import { signOut } from "@/lib/auth";
import { UserMenu } from "@/components/dashboard/user-menu";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { ThemeLogo } from "@/components/theme-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import "katex/dist/katex.min.css";

import { DesktopNav } from "@/components/dashboard/desktop-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Everything under here needs an account. Signed-out visitors go to
  // sign-in; specific data scoping happens per query in lib/ownership.ts.
  await requireUserId();
  const user = await currentUser();
  // Handles are assigned at sign-up, but a missed backfill must never
  // leave the nav without a working profile link — fill it in once here.
  const username =
    user?.username ??
    (user ? await ensureUsername(user.id, user.name ?? null, user.email ?? null) : null);

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    // Theme-driven CRT workspace: next-themes puts `dark` on <html> for
    // Tactical Telemetry, light for Swiss Print. Never force either here.
    <div className="crt-landing flex min-h-full flex-col">
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-(--crt-red) focus:px-4 focus:py-2 focus:font-mono focus:text-xs focus:font-bold focus:uppercase focus:text-(--crt-bg)"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b-2 border-(--crt-ink) bg-(--crt-bg)">
        {/* Command row */}
        <div className="mx-auto grid w-full max-w-6xl grid-cols-[auto_1fr_auto] items-stretch">
          <Link
            href="/"
            className="crt-micro flex items-center gap-2.5 border-r border-(--crt-line) px-4 py-3 text-[12px] font-bold sm:px-5"
            aria-label="Gate Sprint home"
          >
            <ThemeLogo />
            <span className="hidden sm:inline">
              GATE-SPRINT<span className="text-(--crt-red)">_</span>
            </span>
          </Link>
          <MobileNav onSignOut={handleSignOut} />
          <DesktopNav />
          <div className="flex shrink-0 items-center gap-2 border-l border-(--crt-line) px-2 sm:px-4">
            <ThemeToggle className="border border-(--crt-line)" />
            {username && user ? (
              <UserMenu
                username={username}
                name={user.name ?? null}
                image={user.image ?? null}
                onSignOut={handleSignOut}
              />
            ) : null}
          </div>
        </div>
      </header>
      <main
        id="dashboard-main"
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10"
      >
        {children}
      </main>
      <footer className="border-t-2 border-(--crt-ink)">
        <nav
          aria-label="Footer"
          className="crt-micro mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-5 gap-y-1 px-4 pt-3 text-[10px] sm:px-6"
        >
          <Link href="/about" className="text-(--crt-dim) transition-colors hover:text-(--crt-ink)">
            ABOUT US
          </Link>
          <Link href="/contact" className="text-(--crt-dim) transition-colors hover:text-(--crt-ink)">
            CONTACT US
          </Link>
          <Link href="/privacy" className="text-(--crt-dim) transition-colors hover:text-(--crt-ink)">
            PRIVACY POLICY
          </Link>
          <Link href="/cookies" className="text-(--crt-dim) transition-colors hover:text-(--crt-ink)">
            COOKIE POLICY
          </Link>
          <Link href="/terms" className="text-(--crt-dim) transition-colors hover:text-(--crt-ink)">
            TERMS
          </Link>
        </nav>
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <span className="crt-micro text-[10px] text-(--crt-dim)">
            GATE-SPRINT® {"///"} FIELD MANUAL REV 2.6
          </span>
          <span aria-hidden="true" className="crt-barcode h-5 min-w-10 flex-1 text-(--crt-line)" />
          <span className="crt-micro text-[10px] text-(--crt-dim)">©2026</span>
        </div>
      </footer>
    </div>
  );
}
