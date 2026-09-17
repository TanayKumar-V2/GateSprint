"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Entry from a weak-topic recommendation: starts a revision session the
 * server briefs with the student's real accuracy and recent misses.
 */
export function RevisionStarter({
  subjectName,
  topicName,
  topicId,
}: {
  subjectName: string;
  topicName: string;
  topicId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceTopicId: topicId }),
      });
      if (!res.ok) {
        setError("Couldn't start that session. Try again.");
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
    <div className="border-2 border-(--crt-red) bg-(--crt-bg)">
      <p className="crt-micro border-b border-(--crt-red) px-4 py-2 text-[10px] text-(--crt-red)">
        [ REVISION BRIEF {"///"} TARGET LOCKED ]
      </p>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-base font-bold uppercase tracking-tight text-(--crt-ink)">
            Revise {subjectName} · {topicName}?
          </p>
          <p className="crt-micro mt-1 text-[10px] leading-relaxed text-(--crt-dim)">
            OPENS A FOCUSED SESSION BRIEFED ON YOUR ACCURACY AND RECENT MISSES.
          </p>
        </div>
        <button type="button" onClick={start} disabled={busy} className="crt-btn-red shrink-0">
          {busy ? "STARTING…" : "START REVISION >>>"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="crt-micro border-t border-(--crt-line) px-4 py-2 text-[11px] text-(--crt-red)">
          !! {error.toUpperCase()}
        </p>
      ) : null}
    </div>
  );
}
