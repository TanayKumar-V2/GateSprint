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

export function MistakeRowActions({
  questionId,
  tag,
  resolved,
  suggestResolve,
}: {
  questionId: string;
  tag: string | null;
  resolved: boolean;
  suggestResolve: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/mistakes/${questionId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch {
      setError("COULD NOT SAVE — RETRY.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="crt-micro text-[10px] text-(--crt-dim)">
        TAG{" "}
        <select
          aria-label="Mistake reason tag"
          defaultValue={tag ?? ""}
          disabled={busy}
          onChange={(e) =>
            patch({ tag: e.target.value === "" ? null : e.target.value })
          }
          className="ml-1 border border-(--crt-line) bg-(--crt-bg) px-2 py-1 text-[10px] text-(--crt-ink)"
        >
          {TAGS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() => patch({ resolved: !resolved })}
        aria-pressed={resolved}
        className={resolved ? "crt-btn-line !px-3 !py-1 !text-[10px]" : "crt-btn-red !px-3 !py-1 !text-[10px]"}
      >
        {resolved ? "REOPEN" : "RESOLVE"}
      </button>
      {suggestResolve ? (
        <span className="crt-micro border border-(--crt-line) px-2 py-1 text-[9px] text-(--crt-ink)">
          2× CORRECT — SAFE TO RESOLVE
        </span>
      ) : null}
      {error ? (
        <span role="alert" className="crt-micro text-[10px] text-(--crt-red)">
          {error}
        </span>
      ) : null}
    </div>
  );
}
