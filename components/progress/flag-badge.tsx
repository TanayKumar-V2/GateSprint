import { FLAG_LABEL, type TimeFlag } from "@/lib/time-analytics-rules";

const STYLES: Record<TimeFlag, string> = {
  rushed: "border-(--crt-red) text-(--crt-red)",
  overtime: "border-(--crt-red) text-(--crt-red)",
  slow_correct: "border-(--crt-line) text-(--crt-ink)",
  ok: "border-(--crt-line) text-(--crt-dim)",
};

export function FlagBadge({ flag }: { flag: TimeFlag }) {
  return (
    <span
      className={`crt-micro inline-block border px-2 py-1 text-[9px] whitespace-nowrap ${STYLES[flag]}`}
    >
      {FLAG_LABEL[flag].toUpperCase()}
    </span>
  );
}
