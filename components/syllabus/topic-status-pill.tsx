import type { SyllabusStatus } from "@/lib/syllabus-rules";
import { STATUS_LABEL } from "@/lib/syllabus-rules";

const STYLES: Record<SyllabusStatus, string> = {
  "not-started": "border-(--crt-line) text-(--crt-dim)",
  "in-progress": "border-(--brand-saffron) text-(--crt-ink)",
  "exam-ready": "border-(--brand-success) text-(--crt-ink)",
};

export function TopicStatusPill({ status }: { status: SyllabusStatus }) {
  return (
    <span
      className={`crt-micro inline-block border px-2 py-1 text-[9px] whitespace-nowrap ${STYLES[status]}`}
    >
      {STATUS_LABEL[status].toUpperCase()}
    </span>
  );
}
