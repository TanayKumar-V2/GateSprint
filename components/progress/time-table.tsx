import Link from "next/link";
import type { FlaggedAttempt } from "@/lib/time-analytics";
import { FlagBadge } from "./flag-badge";

export function formatSeconds(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const s = Math.round(value);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

export function TimeTable({ rows }: { rows: FlaggedAttempt[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto border border-(--crt-line)">
      <table className="crt-micro w-full min-w-xl text-left text-[11px]">
        <caption className="sr-only">Your time versus the peer median per question</caption>
        <thead>
          <tr className="border-b border-(--crt-line) text-(--crt-dim)">
            <th scope="col" className="px-4 py-2 font-normal">QUESTION</th>
            <th scope="col" className="px-4 py-2 font-normal">YOURS</th>
            <th scope="col" className="px-4 py-2 font-normal">MEDIAN</th>
            <th scope="col" className="px-4 py-2 font-normal">FLAG</th>
            <th scope="col" className="px-4 py-2 font-normal"><span className="sr-only">Action</span></th>
          </tr>
        </thead>
        <tbody className="tabular-nums text-(--crt-ink)">
          {rows.map((r) => (
            <tr key={`${r.questionId}-${r.yourSeconds}`} className="border-t border-(--crt-line)">
              <td className="max-w-64 px-4 py-2">
                <span className="line-clamp-2 block normal-case">{r.prompt}</span>
                <span className="text-[9px] text-(--crt-dim)">
                  {r.isCorrect ? "CORRECT" : "WRONG"} · {r.peerCount} PEER{r.peerCount === 1 ? "" : "S"} TIMED
                </span>
              </td>
              <td className="px-4 py-2 whitespace-nowrap">{formatSeconds(r.yourSeconds)}</td>
              <td className="px-4 py-2 whitespace-nowrap">{formatSeconds(r.medianSeconds)}</td>
              <td className="px-4 py-2">
                <FlagBadge flag={r.flag} />
              </td>
              <td className="px-4 py-2">
                <Link href={r.practicePath} className="underline underline-offset-2 hover:text-(--crt-red)">
                  RETRY
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
