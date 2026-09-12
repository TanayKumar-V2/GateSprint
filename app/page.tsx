import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <p className="text-base font-semibold tracking-tight">
            GATE Mentor
          </p>
          <nav aria-label="Primary" className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/practice"
              className={cn(buttonVariants({ variant: "ghost" }))}
            >
              Practice
            </Link>
            <Link
              href="/mentor"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "hidden sm:inline-flex",
              )}
            >
              Mentor
            </Link>
            <Link href="/sign-in" className={cn(buttonVariants())}>
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main
        id="main"
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-4 py-12 sm:px-6"
      >
        <section aria-labelledby="hero-heading" className="max-w-2xl">
          <Badge variant="secondary" className="mb-4">
            GATE CS / IT · PYQ practice + AI tutor
          </Badge>
          <h1
            id="hero-heading"
            className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl"
          >
            Practice previous-year questions. Understand every option.
          </h1>
          <p className="prose-study mt-4 text-base leading-7 text-muted-foreground">
            GATE Mentor pairs subject-wise PYQ practice with a persistent
            Mentor that diagnoses misconceptions first and explains step by
            step — with math and code rendered clearly.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/practice"
              className={cn(buttonVariants({ size: "lg" }))}
            >
              Start practicing
            </Link>
            <Link
              href="/mentor"
              className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
            >
              Ask Mentor
            </Link>
          </div>
        </section>

        <section
          aria-labelledby="modes-heading"
          className="grid gap-4 sm:grid-cols-3"
        >
          <h2 id="modes-heading" className="sr-only">
            Study modes
          </h2>
          <Card>
            <CardHeader>
              <CardTitle>Practice Mode</CardTitle>
              <CardDescription>
                Filter by subject, topic, year, type, difficulty.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-muted-foreground">
              MCQ, MSQ, and NAT flows with server-validated attempts, timing,
              solutions, and bookmarks. Full browser lands in Phase 4.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Mentor Mode</CardTitle>
              <CardDescription>
                Persistent sessions with streamed explanations.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-muted-foreground">
              Markdown, LaTeX, and code rendered safely. Streaming pipeline
              lands in Phase 6–7.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Practice → Mentor bridge</CardTitle>
              <CardDescription>
                Send any question with its full context.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-muted-foreground">
              Selected answer, correct answer, and solution travel
              server-side — no copy-paste. Lands in Phase 8.
            </CardContent>
          </Card>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-6 text-sm text-muted-foreground sm:px-6">
          <p>GATE Mentor · Phase 1 foundation</p>
          <nav aria-label="Footer" className="flex gap-4">
            <Link href="/practice" className="hover:underline">
              Practice
            </Link>
            <Link href="/progress" className="hover:underline">
              Progress
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
