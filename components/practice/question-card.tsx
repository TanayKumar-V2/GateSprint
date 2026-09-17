import Link from "next/link";
import { MathText } from "@/components/markdown/math-text";
import type { QuestionListItem } from "@/lib/questions";

const TYPE_LABEL: Record<QuestionListItem["type"], string> = {
  mcq: "MCQ",
  msq: "MSQ",
  nat: "NAT",
};

/**
 * Question dossier: square bordered unit with a meta strip, subject
 * header, clamped prompt readout, and an OPEN directive. Hover arms
 * the border red — no rounding, no shadows.
 */
export function QuestionCard({ question }: { question: QuestionListItem }) {
  return (
    <article className="group flex h-full flex-col border border-(--crt-line) bg-(--crt-bg) transition-colors duration-150 hover:border-(--crt-red)">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-(--crt-line) px-4 py-2.5">
        <span className="crt-tag crt-tag-solid">{TYPE_LABEL[question.type]}</span>
        <span className="crt-tag">{question.difficulty}</span>
        <span className="crt-tag">{question.year}</span>
        <span className="crt-tag">
          {question.marks} MARK{question.marks === 1 ? "" : "S"}
        </span>
        {question.attempted ? (
          <span className="crt-tag crt-tag-red">ATTEMPTED</span>
        ) : (
          <span className="crt-tag">UNATTEMPTED</span>
        )}
        {question.bookmarked ? <span className="crt-tag crt-tag-solid">SAVED</span> : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 py-4">
        <h3 className="text-base font-bold uppercase leading-6 tracking-tight text-(--crt-ink)">
          <Link
            href={`/practice/${question.id}`}
            className="transition-colors group-hover:text-(--crt-red)"
          >
            {question.subject.name} {"///"} {question.topic.name}
          </Link>
        </h3>
        <MathText
          text={question.prompt}
          inline
          className="line-clamp-2 text-sm leading-6 text-(--crt-dim) [&_.katex-display]:hidden"
        />
      </div>
      <div className="crt-micro flex items-center justify-between border-t border-(--crt-line) px-4 py-2.5 text-[10px] text-(--crt-dim)">
        <span className="truncate">
          {question.sourceLabel ?? `GATE ${question.year}`}
          {question.questionNumber ? ` · Q${question.questionNumber}` : ""}
          {question.images.length > 0 ? ` · FIG[${question.images.length}]` : ""}
        </span>
        <Link
          href={`/practice/${question.id}`}
          aria-label={`Open ${question.subject.name} ${question.topic.name}`}
          className="ml-3 shrink-0 font-bold text-(--crt-ink) transition-colors group-hover:text-(--crt-red)"
        >
          OPEN +
        </Link>
      </div>
    </article>
  );
}
