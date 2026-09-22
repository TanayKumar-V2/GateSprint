import Link from "next/link";
import type { MistakeRow } from "@/lib/mistakes";
import { MistakeRowActions } from "./mistake-row-actions";

export function MistakeTable({ rows }: { rows: MistakeRow[] }) {
  return (
    <ul className="grid gap-px border border-(--crt-line) bg-(--crt-line)">
      {rows.map((m) => (
        <li key={m.questionId} className="flex flex-col gap-3 bg-(--crt-bg) p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="crt-micro text-[10px] text-(--crt-dim)">
              {m.subject.name.toUpperCase()} {"///"} {m.topic.name.toUpperCase()} {"///"} {m.year} {"///"} {m.marks}M
            </p>
            <p className="crt-micro text-[10px] text-(--crt-red)">
              {m.missCount} MISS{m.missCount === 1 ? "" : "ES"} · LAST {m.lastMissedAt.toISOString().slice(0, 10)}
            </p>
          </div>
          <p className="line-clamp-3 text-sm leading-relaxed text-(--crt-ink)">{m.prompt}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={m.practicePath} className="crt-btn-line !px-3 !py-1 !text-[10px]">
              RE-ATTEMPT &gt;&gt;&gt;
            </Link>
            <Link
              href={`/mentor?subject=${m.subject.slug}&topic=${m.topic.slug}`}
              className="crt-btn-line !px-3 !py-1 !text-[10px]"
            >
              ASK MENTOR
            </Link>
            {m.resolved ? (
              <span className="crt-micro border border-(--crt-line) px-2 py-1 text-[9px] text-(--crt-dim)">
                RESOLVED
              </span>
            ) : null}
          </div>
          <MistakeRowActions
            questionId={m.questionId}
            tag={m.tag}
            resolved={m.resolved}
            suggestResolve={m.suggestResolve}
          />
        </li>
      ))}
    </ul>
  );
}
