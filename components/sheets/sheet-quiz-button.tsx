"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** "Quiz me": opens a Mentor session scoped to this sheet's topic. */
export function SheetQuizButton({ topicSlug }: { topicSlug: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sheets/${topicSlug}/revise`, { method: "POST" });
      const data = (await res.json()) as {
        mentorPath?: string;
        error?: { message: string };
      };
      if (!res.ok || !data.mentorPath) {
        setError(data.error?.message ?? "Couldn't start the quiz.");
        return;
      }
      router.push(data.mentorPath);
    } catch {
      setError("Network hiccup — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={start} disabled={busy} className="crt-btn-red">
        {busy ? "BRIEFING MENTOR…" : "QUIZ ME >>>"}
      </button>
      {error ? (
        <p role="alert" className="crt-micro text-[10px] text-(--crt-red)">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** One "revised" tick per day — retries collapse idempotently. */export function SheetRevisedButton({
  topicSlug,
  revisedToday,
}: {
  topicSlug: string;
  revisedToday: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function mark() {
    if (busy || revisedToday) return;
    setBusy(true);
    try {
      await fetch(`/api/sheets/${topicSlug}/revised`, { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={mark}
      disabled={busy || revisedToday}
      aria-pressed={revisedToday}
      className="crt-btn-line disabled:opacity-60"
    >
      {revisedToday ? "REVISED TODAY ✓" : busy ? "MARKING…" : "MARK AS REVISED"}
    </button>
  );
}

/** Print-friendly sheet: delegates to the browser print dialog. */
export function SheetPrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="crt-btn-line">
      PRINT
    </button>
  );
}
