"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TAGS = [
  { value: "", label: "UNTAGGED" },
  { value: "concept_gap", label: "CONCEPT GAP" },
  { value: "silly_mistake", label: "SILLY MISTAKE" },
  { value: "trap", label: "TRAP" },
  { value: "time_pressure", label: "TIME PRESSURE" },
  { value: "unattempted", label: "UNATTEMPTED" },
] as const;

export function MistakeTagSelect({
  questionId,
  tag,
}: {
  questionId: string;
  tag: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onChange(value: string) {
    setBusy(true);
    try {
      await fetch(`/api/mistakes/${questionId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tag: value === "" ? null : value }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="crt-micro text-[10px] text-(--crt-dim)">
      TAG{" "}
      <select
        aria-label="Mistake reason tag"
        defaultValue={tag ?? ""}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        className="ml-1 border border-(--crt-line) bg-(--crt-bg) px-2 py-1 text-[10px] text-(--crt-ink)"
      >
        {TAGS.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
    </label>
  );
}
