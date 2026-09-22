"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { notifyVariantsUpdated, requestVariantSet } from "./variant-client";

/** "Generate practice" button for question/topic Mentor sessions. */
export function GenerateVariantsButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await requestVariantSet(sessionId);
    if (result.ok) {
      notifyVariantsUpdated();
      router.refresh();
    } else {
      setError(result.message);
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={generate} disabled={busy} className="crt-btn-red">
        {busy ? "WRITING QUESTIONS…" : "GENERATE PRACTICE >>>"}
      </button>
      <p className="crt-micro text-[10px] text-(--crt-dim)">
        2–3 NEW QUESTIONS ON THIS TOPIC — OR TYPE /QUIZ IN CHAT.
      </p>
      {error ? (
        <p role="alert" className="crt-micro text-[10px] text-(--crt-red)">
          {error}
        </p>
      ) : null}
    </div>
  );
}
