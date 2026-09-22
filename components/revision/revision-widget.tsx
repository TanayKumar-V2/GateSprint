import Link from "next/link";

export function RevisionWidget({ dueCount }: { dueCount: number }) {
  return (
    <Link
      href="/revision"
      className="flex items-center justify-between border border-(--crt-line) bg-(--crt-bg) px-4 py-3"
      aria-label={`${dueCount} revisions due today`}
    >
      <span className="crt-micro text-[11px] text-(--crt-ink)">
        DUE TODAY: <output className="text-(--crt-red)">{dueCount}</output>
      </span>
      <span className="crt-micro text-[11px] text-(--crt-dim)">OPEN QUEUE →</span>
    </Link>
  );
}
