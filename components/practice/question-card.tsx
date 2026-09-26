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
export function QuestionCard({ question, href }: { question: QuestionListItem; href?: string }) {
  const linkHref = href ?? `/practice/${question.id}`;
  const label = `Open ${question.type.toUpperCase()} from ${question.year} ${question.subject.name} - ${question.topic.name}${question.questionNumber ? ` Q${question.questionNumber}` : ""}`;
  
  return (
    <Link href={linkHref} className="group flex h-full flex-col border border-(--crt-line) bg-(--crt-bg) transition-colors duration-150 hover:border-(--crt-red) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--crt-red)" aria-label={label}>
      <article className="flex h-full flex-col pointer-events-none">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-(--crt-line) px-4 py-2.5">
          <span className="crt-tag crt-tag-solid">{TYPE_LABEL[question.type]}</span>
          <span className="crt-tag">{question.difficulty}</span>
          <span className="crt-tag">{question.year}</span>
          <span className="crt-tag">
            {question.marks}M{question.negativeMarks > 0 ? ` · −${question.negativeMarks} NEG` : ""}
          </span>
          {question.attempted ? (
            <span className="crt-tag crt-tag-solid">SOLVED ✓</span>
          ) : (
            <span className="crt-tag">UNATTEMPTED</span>
          )}
          {question.bookmarked ? <span className="crt-tag crt-tag-solid">SAVED</span> : null}
        </div>
        <div className="flex flex-1 flex-col gap-2 px-4 py-4">
          <h3 className="text-base font-bold uppercase leading-6 tracking-tight text-(--crt-ink) transition-colors group-hover:text-(--crt-red)">
            {question.subject.name} {"///"} {question.topic.name}
          </h3>
          <MathText
            text={question.prompt}
            inline
            className="line-clamp-2 text-sm leading-6 text-(--crt-dim) [&_.katex-display]:hidden"
          />
        </div>
        <div className="crt-micro flex items-center justify-between border-t border-(--crt-line) px-4 py-2.5 text-[10px] text-(--crt-dim)">
          <span className="min-w-0 truncate">
            {question.sourceLabel ?? `GATE ${question.year}`}
            {question.questionNumber ? ` · Q${question.questionNumber}` : ""}
            {question.images.length > 0 ? ` · FIG[${question.images.length}]` : ""}
          </span>
          <span
            className="ml-3 shrink-0 font-bold text-(--crt-ink) transition-colors group-hover:text-(--crt-red)"
            aria-hidden="true"
          >
            OPEN +
          </span>
        </div>
      </article>
    </Link>
  );
}
