import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { IslandCta } from "@/components/island-cta";
import { Reveal } from "@/components/motion/reveal";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <header className="sticky top-3 z-40 px-4 sm:px-6">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between rounded-full border border-white/10 bg-background/70 px-3 shadow-[0_18px_50px_-24px_rgb(0_0_0/0.45)] backdrop-blur-2xl sm:px-4">
          <p className="rounded-full px-2 text-base font-semibold tracking-tight">
            GATE Mentor
          </p>
          <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <Link
              href="/practice"
              className={cn(buttonVariants({ variant: "ghost" }), "rounded-full")}
            >
              Practice
            </Link>
            <Link
              href="/mentor"
              className={cn(
                buttonVariants({ variant: "ghost" }),
                "hidden rounded-full sm:inline-flex",
              )}
            >
              Mentor
            </Link>
            <Link href="/sign-in" className={cn(buttonVariants(), "rounded-full")}>
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main id="main" className="flex flex-1 flex-col">
        {/* Editorial split hero over ambient orbs */}
        <section
          aria-labelledby="hero-heading"
          className="relative overflow-hidden"
        >
          <div className="orbs" aria-hidden="true" />
          <div className="relative mx-auto grid w-full max-w-5xl gap-12 px-4 py-24 sm:px-6 md:grid-cols-2 md:py-40">
            <Reveal className="flex max-w-xl flex-col justify-center">
              <span className="eyebrow mb-6 self-start">
                GATE CS / IT · PYQ practice + AI tutor
              </span>
              <h1
                id="hero-heading"
                className="text-balance text-5xl font-semibold leading-[1.05] tracking-[-0.02em] sm:text-6xl"
              >
                Practice previous-year questions. Understand every option.
              </h1>
              <p className="prose-study mt-6 text-base leading-7 text-muted-foreground">
                GATE Mentor pairs subject-wise PYQ practice with a persistent
                Mentor that diagnoses misconceptions first and explains step
                by step — with math and code rendered clearly.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <IslandCta href="/practice">Start practicing</IslandCta>
                <IslandCta href="/mentor" variant="ghost">
                  Ask Mentor
                </IslandCta>
              </div>
            </Reveal>

            <Reveal
              delay={150}
              className="flex flex-col justify-center gap-4"
            >
              <div className="bezel">
                <Card>
                  <CardHeader>
                    <Badge variant="secondary" className="mb-2 w-fit">
                      OS · CPU Scheduling · GATE 2020
                    </Badge>
                    <CardTitle className="text-base font-medium leading-6">
                      Three processes arrive for FCFS…
                    </CardTitle>
                    <CardDescription>
                      MCQ · 2 marks · avg. waiting time
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 text-sm">
                    {["5.67 — correct, waiting adds up", "4.00 — forgot P3 queues", "6.33 — counted turnaround"].map(
                      (line) => (
                        <span
                          key={line}
                          className="rounded-lg bg-muted px-3 py-2 text-muted-foreground"
                        >
                          {line}
                        </span>
                      ),
                    )}
                  </CardContent>
                </Card>
              </div>
              <div className="bezel md:ml-12">
                <Card>
                  <CardContent className="flex items-center gap-3 pt-6">
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    >
                      <ArrowUpRight className="size-4" strokeWidth={1.5} />
                    </span>
                    <p className="text-sm leading-6">
                      <strong className="font-medium">Mentor:</strong>{" "}
                      <span className="text-muted-foreground">
                        “P2 waits 7, not 4 — it arrives at 1 but starts at
                        8. That gap is the whole question.”
                      </span>
                    </p>
                  </CardContent>
                </Card>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Asymmetrical bento */}
        <section
          aria-labelledby="modes-heading"
          className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-24 sm:px-6 md:grid-cols-12"
        >
          <h2 id="modes-heading" className="sr-only">
            Study modes
          </h2>
          <Reveal className="md:col-span-7" delay={0}>
            <div className="bezel h-full">
              <Card className="justify-center">
                <CardHeader>
                  <span className="eyebrow mb-3 w-fit">Practice Mode</span>
                  <CardTitle className="text-2xl">
                    Filter by subject, topic, year, type, difficulty.
                  </CardTitle>
                  <CardDescription>
                    MCQ, MSQ, and NAT flows with server-validated attempts,
                    timing, solutions, and bookmarks.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <IslandCta href="/practice" variant="ghost">
                    Open the bank
                  </IslandCta>
                </CardContent>
              </Card>
            </div>
          </Reveal>
          <div className="flex flex-col gap-4 md:col-span-5">
            <Reveal delay={120} className="flex-1">
              <div className="bezel h-full">
                <Card>
                  <CardHeader>
                    <span className="eyebrow mb-3 w-fit">Mentor Mode</span>
                    <CardTitle>Persistent sessions, streamed answers.</CardTitle>
                    <CardDescription>
                      Markdown, LaTeX, and code — rendered safely, remembered
                      fully.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            </Reveal>
            <Reveal delay={220} className="flex-1">
              <div className="bezel h-full">
                <Card>
                  <CardHeader>
                    <span className="eyebrow mb-3 w-fit">The bridge</span>
                    <CardTitle>Any question, one click, full context.</CardTitle>
                    <CardDescription>
                      Your pick, the right answer, the solution — Mentor
                      already knows. No copy-paste.
                    </CardDescription>
                  </CardHeader>
                </Card>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="px-4 pb-10 sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between rounded-full border border-white/10 bg-background/70 px-6 py-4 text-sm text-muted-foreground backdrop-blur-2xl">
          <p>GATE Mentor · built for deep study</p>
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
