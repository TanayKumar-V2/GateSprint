import Link from "next/link";
import { currentUser, requireUserId } from "@/lib/current-user";
import { ensureUsername } from "@/lib/profile";
import { signOut } from "@/lib/auth";
import { UserMenu } from "@/components/dashboard/user-menu";
import { ThemeLogo } from "@/components/theme-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import "katex/dist/katex.min.css";

const NAV = [
  { href: "/practice", label: "PRACTICE", code: "D-01" },
  { href: "/mentor", label: "MENTOR", code: "D-02" },
  { href: "/progress", label: "PROGRESS", code: "D-03" },
  { href: "/bookmarks", label: "SAVED", code: "D-04" },
];

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
            aria-label="GATE Mentor home"
          >
            <ThemeLogo />
            <span className="hidden sm:inline">
              GATE-MENTOR<span className="text-(--crt-red)">_</span>
            </span>
          </Link>
          <nav aria-label="Study sections" className="flex min-w-0 items-stretch overflow-x-auto">
            <ul className="crt-micro flex items-stretch text-[11px]">
              {NAV.map((item) => (
                <li key={item.href} className="flex items-stretch">
                  <Link
                    href={item.href}
                    className="flex items-center gap-2 border-r border-(--crt-line) px-3 py-3 text-(--crt-dim) transition-colors hover:bg-(--crt-ink) hover:text-(--crt-bg) sm:px-5"
                  >
                    [ {item.label} ]
                    <span aria-hidden="true" className="hidden text-[9px] opacity-60 lg:inline">
                      {item.code}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex items-center gap-2 border-l border-(--crt-line) px-3 sm:px-4">
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
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <span className="crt-micro text-[10px] text-(--crt-dim)">
            GATE-MENTOR® {"///"} FIELD MANUAL REV 2.6
          </span>
          <span aria-hidden="true" className="crt-barcode h-5 flex-1 text-(--crt-line)" />
          <span className="crt-micro text-[10px] text-(--crt-dim)">©2026</span>
        </div>
      </footer>
    </div>
  );
}
