"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TopicOverrideToggle({
  topicSlug,
  subjectSlug,
  override,
}: {
  topicSlug: string;
  subjectSlug: string;
  override: "skipped" | "focus" | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function set(value: "skipped" | "focus" | null) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/syllabus/topic", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topicSlug, subjectSlug, override: value }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch {
      setError("COULD NOT SAVE.");
    } finally {
      setBusy(false);
    }
  }

  const btn = (value: "skipped" | "focus" | null, label: string) => {
    const active = override === value || (value === null && override === null);
    return (
      <button
        key={label}
        type="button"
        disabled={busy}
        aria-pressed={active}
        onClick={() => set(value)}
        className={active ? "crt-btn-red !px-2 !py-0.5 !text-[9px]" : "crt-btn-line !px-2 !py-0.5 !text-[9px]"}
      >
        {label}
      </button>
    );
  };

  return (
    <span className="flex items-center gap-1">
      {btn("focus", "FOCUS")}
      {btn("skipped", "SKIP")}
      {override ? btn(null, "CLEAR") : null}
      {error ? (
        <span role="alert" className="crt-micro text-[9px] text-(--crt-red)">
          {error}
        </span>
      ) : null}
    </span>
  );
}
