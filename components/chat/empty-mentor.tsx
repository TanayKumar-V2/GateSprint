"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
    <ul className="grid gap-px border border-(--crt-line) bg-(--crt-line) sm:grid-cols-2" aria-label="Suggested questions">
      {STARTERS.map((prompt, i) => (
        <li key={prompt} className="group flex flex-col justify-between gap-4 bg-(--crt-bg) p-4 transition-colors hover:bg-(--crt-raised)">
          <p className="text-sm leading-6 text-(--crt-ink)">
            <span aria-hidden="true" className="crt-micro mr-2 text-[10px] text-(--crt-red)">
              Q{i + 1}
            </span>
            {prompt}
          </p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void ask(prompt)}
            className="crt-micro self-start border border-(--crt-edge) px-4 py-2 text-[11px] text-(--crt-ink) transition-colors hover:bg-(--crt-red) hover:text-(--crt-bg) disabled:opacity-45"
          >
            {busy === prompt ? "OPENING…" : "ASK THIS >>>"}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function EmptyMentor() {
  return (
    <div className="flex max-w-2xl flex-col gap-6 py-2">
      <div>
        <h2 className="crt-macro text-[clamp(1.8rem,5vw,3rem)] text-(--crt-ink)">
          WHAT SHOULD<br />WE WORK ON<span className="text-(--crt-red)">?</span>
        </h2>
        <p className="crt-micro mt-3 max-w-xl text-[11px] leading-relaxed text-(--crt-dim)">
          YOUR VETERAN GATE TUTOR: MISCONCEPTIONS FIRST, STEP-BY-STEP AFTER,
          EXAM TRAPS INCLUDED. PICK A STARTER OR TYPE YOUR OWN BELOW — A FRESH
          CHAT OPENS AUTOMATICALLY.
        </p>
      </div>
      <SuggestionGrid />
      <div className="border border-(--crt-line) bg-(--crt-bg) p-4">
        <p className="crt-micro text-[10px] text-(--crt-red)">[ GOOD THINGS TO ASK ]</p>
        <p className="mt-2 text-sm leading-6 text-(--crt-dim)">
          “Why is option B wrong here?” · “Explain paging vs segmentation in 5
          lines.” · “How do I spot a DP problem in GATE?” · Anything from a
          question page via Ask Mentor.
        </p>
      </div>
    </div>
  );
}
