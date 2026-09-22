"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StartMockButton({
  body,
  label,
  sub,
}: {
  body: Record<string, unknown>;
  label: string;
  sub: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/mocks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        practicePath?: string;
        error?: { message: string; available?: number };
      };
      if (!res.ok || !data.practicePath) {
        setError(
          data.error?.available !== undefined
            ? `${data.error.message} (available: ${data.error.available})`
            : (data.error?.message ?? "Couldn't start. Try again."),
        );
        return;
      }
      router.push(data.practicePath);
    } catch {
      setError("Network hiccup — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={start} disabled={busy} className="crt-btn-red w-full">
        {busy ? "SETTING PAPER…" : label}
      </button>
      <p className="crt-micro text-[10px] text-(--crt-dim)">{sub}</p>
      {error ? (
        <p role="alert" className="crt-micro text-[10px] leading-relaxed text-(--crt-red)">
          {error}
        </p>
      ) : null}
    </div>
  );
}
