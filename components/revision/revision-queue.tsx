import type { RevisionItem } from "@/lib/revision";
import { DueCard } from "./due-card";

export function RevisionQueue({ due }: { due: RevisionItem[] }) {
  if (due.length === 0) return null;
  return (
    <ul className="grid gap-px border border-(--crt-line) bg-(--crt-line)">
      {due.map((d) => (
        <DueCard key={d.questionId} item={d} />
      ))}
    </ul>
  );
}
