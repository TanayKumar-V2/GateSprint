"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * The bridge: creates a chat session already briefed on this question
 * (options, answer, your latest attempt, solution — all loaded
 * server-side) and takes you straight into it.
 */
export function AskMentorButton({ questionId }: { questionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceQuestionId: questionId }),
      });
      if (!res.ok) {
        setError(
          res.status === 429
            ? "Too many chats started lately — wait a bit and retry."
            : "Couldn't start that chat. Try again.",
        );
        return;
      }
      const data = (await res.json()) as { session: { id: string } };
      router.push(`/mentor/${data.session.id}`);
    } catch {
      setError("Network hiccup. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <Button type="button" variant="outline" onClick={ask} disabled={busy}>
        {busy ? "Opening chat…" : "Ask Mentor about this"}
      </Button>
      {error ? (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </span>
  );
}
