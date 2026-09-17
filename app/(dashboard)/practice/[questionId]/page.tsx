import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/current-user";
import { getQuestionView } from "@/lib/questions";
import { QuestionSolver } from "@/components/practice/solver";
import { AskMentorButton } from "@/components/practice/ask-mentor-button";
import { QuestionFigures, isFigurePlaceholder, referencedFigures } from "@/components/questions/question-figures";
import { MathText } from "@/components/markdown/math-text";

const TYPE_LABEL = { mcq: "MCQ", msq: "MSQ", nat: "NAT" } as const;

export default async function QuestionPage({
  params,
}: {
  params: Promise<{ questionId: string }>;
}) {
  const userId = await currentUserId();
  if (!userId) redirect("/sign-in");
  const { questionId } = await params;

  const view = await getQuestionView(userId, questionId);
  if (!view) notFound();

  // Image-only options arrive from the extractor as "[See figure]".
  // Figures the prompt names ([Figure N]) belong to the stem; any other
  // stored figure is an unmapped option diagram rendered below.
  const hasPlaceholders = (view.options ?? []).some((o) => isFigurePlaceholder(o.text));
  const referenced = new Set(referencedFigures(view.prompt));
  const unmappedFigures = view.images.filter((img, index) => !referenced.has(index + 1));
  const figureNotice = !hasPlaceholders ? null : unmappedFigures.length > 0 ? "below" : "missing";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <nav aria-label="Back">
        <Link
          href="/practice"
          className="crt-micro inline-block text-[11px] text-(--crt-dim) transition-colors hover:text-(--crt-red)"
        >
          &lt;&lt;&lt; ALL QUESTIONS
        </Link>
      </nav>

      <header className="border border-(--crt-line) bg-(--crt-bg)">
        <div className="crt-micro flex flex-wrap items-center justify-between gap-2 border-b border-(--crt-line) px-4 py-2 text-[10px] text-(--crt-dim) sm:px-5">
          <span>
            DOSSIER {"///"} {view.subject.name.toUpperCase()} {"///"} {view.topic.name.toUpperCase()}
          </span>
          <span>Q{view.questionNumber ?? "—"}</span>
        </div>
        <div className="flex flex-col gap-4 px-4 py-5 sm:px-5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="crt-tag crt-tag-solid">{TYPE_LABEL[view.type]}</span>
            <span className="crt-tag">{view.difficulty}</span>
            <span className="crt-tag">{view.year}</span>
            <span className="crt-tag">
              {view.marks} MARK{view.marks === 1 ? "" : "S"}
            </span>
            {view.lastAttempt ? (
              <span className={`crt-tag ${view.lastAttempt.isCorrect ? "crt-tag-solid" : "crt-tag-red"}`}>
                {view.lastAttempt.isCorrect ? "SOLVED ✓" : "ATTEMPTED"}
              </span>
            ) : (
              <span className="crt-tag">UNATTEMPTED</span>
            )}
          </div>
          <p className="crt-micro text-[11px] text-(--crt-dim)">
            {view.subject.name} · {view.topic.name}
            {view.sourceLabel ? ` · ${view.sourceLabel}` : ""}
            {view.questionNumber ? ` · Q${view.questionNumber}` : ""}
          </p>
          <h1 className="prose-study text-lg font-medium leading-8 text-(--crt-ink)">
            <MathText text={view.prompt} inline />
          </h1>
          <QuestionFigures questionId={view.id} images={view.images} />
        </div>
      </header>

      <QuestionSolver view={view} figureNotice={figureNotice} />

      <footer className="flex flex-wrap items-center gap-4 border border-(--crt-line) bg-(--crt-bg) px-4 py-4 sm:px-5">
        <AskMentorButton questionId={view.id} />
        <p className="crt-micro max-w-md text-[10px] leading-relaxed text-(--crt-dim)">
          OPENS A CHAT ALREADY BRIEFED ON THIS QUESTION, YOUR ANSWER, AND THE
          SOLUTION — JUST ASK YOUR FOLLOW-UP.
        </p>
      </footer>
    </div>
  );
}
