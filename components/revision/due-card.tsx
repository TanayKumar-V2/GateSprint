import Link from "next/link";
import { MathText } from "@/components/markdown/math-text";
import type { RevisionItem } from "@/lib/revision";

export function DueCard({ item, isUpcoming = false }: { item: RevisionItem; isUpcoming?: boolean }) {
  return (
    <li className="flex flex-col gap-3 bg-(--crt-bg) p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="crt-micro text-[10px] text-(--crt-dim)">
          {item.subject.name.toUpperCase()} {"///"} {item.topic.name.toUpperCase()} {"///"} {item.year}
        </p>
        <p className="crt-micro text-[10px] text-(--crt-red)">{item.reason.toUpperCase()}</p>
      </div>
      <MathText text={item.prompt} className="line-clamp-3 text-sm leading-relaxed text-(--crt-ink)" />
      <div className="flex flex-wrap gap-2">
        {isUpcoming ? (
          <span className="crt-btn-line !px-3 !py-1 !text-[10px] opacity-50 cursor-not-allowed">
            LOCKED UNTIL DUE
          </span>
        ) : (
          <Link href={item.practicePath} className="crt-btn-red !px-3 !py-1 !text-[10px]">
            PRACTICE &gt;&gt;&gt;
          </Link>
        )}
        <Link href={item.revisePath} className="crt-btn-line !px-3 !py-1 !text-[10px]">
          REVISE WITH MENTOR
        </Link>
      </div>
    </li>
  );
}
