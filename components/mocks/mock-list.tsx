import Link from "next/link";
import type { listMockSessions } from "@/lib/mocks";

type List = Awaited<ReturnType<typeof listMockSessions>>;

const STATUS_LABEL: Record<string, string> = {
  in_progress: "LIVE",
  submitted: "DONE",
  expired: "TIMEOUT",
  abandoned: "QUIT",
};

export function MockList({ list }: { list: List }) {
  if (list.total === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      <ul className="grid gap-px border border-(--crt-line) bg-(--crt-line)">
        {list.data.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 bg-(--crt-bg) p-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-tight text-(--crt-ink)">{s.title}</p>
              <p className="crt-micro mt-1 text-[10px] tabular-nums text-(--crt-dim)">
                {STATUS_LABEL[s.status] ?? s.status}
                {" /// "}{s.answeredCount}/{s.questionCount} ANSWERED
                {s.score !== null ? (
                  <> {" /// "}SCORE <span className="text-(--crt-ink)">{s.score}/{s.totalMarks}</span></>
                ) : null}
              </p>
            </div>
            <Link
              href={`/mocks/${s.id}`}
              className={s.status === "in_progress" ? "crt-btn-red !px-4 !py-2 !text-[11px]" : "crt-btn-line !px-4 !py-2 !text-[11px]"}
            >
              {s.status === "in_progress" ? "RESUME >>>" : "REVIEW"}
            </Link>
          </li>
        ))}
      </ul>
      <nav aria-label="Pagination" className="crt-micro flex items-center gap-3 text-[11px] text-(--crt-dim)">
        <span>
          PAGE {list.page} / {list.totalPages} · {list.total} TOTAL
        </span>
        {list.page > 1 ? (
          <Link href={`/mocks?page=${list.page - 1}`} className="crt-btn-line !px-3 !py-1 !text-[10px]">
            ← PREV
          </Link>
        ) : null}
        {list.page < list.totalPages ? (
          <Link href={`/mocks?page=${list.page + 1}`} className="crt-btn-line !px-3 !py-1 !text-[10px]">
            NEXT →
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
