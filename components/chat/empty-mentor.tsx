"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STARTERS = [
  "Explain Big-O notation like I'm revising the night before GATE.",
  "Why is the answer to a deadlock question 'mutual exclusion' and not 'no preemption'?",
  "Give me a 5-minute recap of normalization up to BCNF with one example.",
  "How do I approach 'find the output' C questions without tracing every line?",
];

export function SuggestionGrid() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function ask(prompt: string) {
    if (busy) return;
    setBusy(prompt);
    try {
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { session: { id: string } };
      router.push(
        `/mentor/${data.session.id}?q=${encodeURIComponent(prompt)}`,
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {STARTERS.map((prompt) => (
        <li key={prompt}>
          <Card className="h-full">
            <CardContent className="flex h-full flex-col items-start gap-3 pt-6">
              <p className="text-sm leading-6">{prompt}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => void ask(prompt)}
              >
                {busy === prompt ? "Starting…" : "Ask this"}
              </Button>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function EmptyMentor() {
  return (
    <div className="flex max-w-2xl flex-col gap-6 py-4">
      <div>
        <h2 className="text-xl font-semibold">What should we work on?</h2>
        <CardDescription className="mt-1">
          Your veteran GATE tutor: misconceptions first, step-by-step after,
          exam traps included. Pick a starter or type your own question below —
          a fresh chat opens automatically.
        </CardDescription>
      </div>
      <SuggestionGrid />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Good things to ask</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-6 text-muted-foreground">
          “Why is option B wrong here?” · “Explain paging vs segmentation in 5
          lines.” · “How do I spot a DP problem in GATE?” · Anything from a
          question page via Ask Mentor.
        </CardContent>
      </Card>
    </div>
  );
}
