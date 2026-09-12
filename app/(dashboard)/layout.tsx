import Link from "next/link";
import { requireUserId } from "@/lib/current-user";
import { signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import "katex/dist/katex.min.css";

const NAV = [
  { href: "/practice", label: "Practice" },
  { href: "/mentor", label: "Mentor" },
  { href: "/progress", label: "Progress" },
  { href: "/bookmarks", label: "Bookmarks" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Everything under here needs an account. Signed-out visitors go to
  // sign-in; specific data scoping happens per query in lib/ownership.ts.
  await requireUserId();

  return (
    <div className="flex min-h-full flex-col bg-background text-foreground">
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <header className="sticky top-3 z-40 px-4 sm:px-6">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 rounded-full border border-white/10 bg-background/70 px-3 shadow-[0_18px_50px_-24px_rgb(0_0_0/0.45)] backdrop-blur-2xl sm:px-4">
          <Link
            href="/"
            className="shrink-0 rounded-full px-2 text-base font-semibold tracking-tight focus-visible:outline-2"
          >
            GATE Mentor
          </Link>
          <nav aria-label="Study sections" className="min-w-0 flex-1 overflow-x-auto">
            <ul className="flex w-max items-center gap-1 sm:gap-2">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-all duration-500 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/" });
                  }}
                >
                  <Button type="submit" variant="ghost" size="sm" className="whitespace-nowrap rounded-full">
                    Sign out
                  </Button>
                </form>
              </li>
            </ul>
          </nav>
          <div className="shrink-0">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main
        id="dashboard-main"
        className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6"
      >
        {children}
      </main>
    </div>
  );
}
