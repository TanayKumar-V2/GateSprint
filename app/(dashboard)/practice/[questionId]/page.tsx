import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/current-user";
import { getAdjacentQuestions, getQuestionView } from "@/lib/questions";
import { questionFilterSchema } from "@/lib/validation/answers";
import { QuestionSolver } from "@/components/practice/solver";
import { AskMentorButton } from "@/components/practice/ask-mentor-button";
import { QuestionFigures, isFigurePlaceholder } from "@/components/questions/question-figures";
import { MathText } from "@/components/markdown/math-text";

const TYPE_LABEL = { mcq: "MCQ", msq: "MSQ", nat: "NAT" } as const;

export default async function QuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ questionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await currentUserId();
  if (!userId) redirect("/sign-in");
  const { questionId } = await params;
  const sp = await searchParams;

  const view = await getQuestionView(userId, questionId);
  if (!view) notFound();

  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") flat[k] = v;
  }
  const searchString = new URLSearchParams(flat).toString();
  const filterQuery = searchString ? `?${searchString}` : "";

  const filterParsed = questionFilterSchema.safeParse(flat);
  let adj = { prev: null as string | null, next: null as string | null, nextUnattempted: null as string | null };
  if (filterParsed.success && Object.keys(flat).length > 0) {
    adj = await getAdjacentQuestions(userId, questionId, filterParsed.data);
  }

  // Image-only options arrive from the extractor as "[See figure]"; their
  // diagrams render together with the stem's in the figure block below.
  // Only the presence of stored figures decides the notice — marker
  // bookkeeping can't tell stem diagrams from option diagrams.
  const hasPlaceholders = (view.options ?? []).some((o) => isFigurePlaceholder(o.text));
  const figureNotice = !hasPlaceholders ? null : view.images.length > 0 ? "below" : "missing";

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <nav aria-label="Back and pagination" className="flex items-center justify-between">
        <Link
          href={`/practice${filterQuery}`}
          className="crt-micro inline-block text-[11px] text-(--crt-dim) transition-colors hover:text-(--crt-red)"
        >
          &lt;&lt;&lt; ALL QUESTIONS
        </Link>
        {filterParsed.success && Object.keys(flat).length > 0 ? (
          <div className="crt-micro flex gap-4 text-[11px] text-(--crt-ink)">
            {adj.prev ? (
              <Link href={`/practice/${adj.prev}${filterQuery}`} className="transition-colors hover:text-(--crt-red)">&lt; PREV</Link>
            ) : <span className="text-(--crt-dim) opacity-50">&lt; PREV</span>}
            {adj.next ? (
              <Link href={`/practice/${adj.next}${filterQuery}`} className="transition-colors hover:text-(--crt-red)">NEXT &gt;</Link>
            ) : <span className="text-(--crt-dim) opacity-50">NEXT &gt;</span>}
          </div>
        ) : null}
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
              {view.marks}M{view.negativeMarks > 0 ? ` · −${view.negativeMarks} NEG` : ""}
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
          <div className="prose-study min-w-0 text-lg font-medium leading-8 break-words text-(--crt-ink)">
            <MathText text={view.prompt} />
          </div>
          <QuestionFigures questionId={view.id} images={view.images} />
        </div>
      </header>

      <QuestionSolver view={view} figureNotice={figureNotice} />

      <footer className="flex flex-col gap-4 border border-(--crt-line) bg-(--crt-bg) px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <AskMentorButton questionId={view.id} />
            <p className="crt-micro max-w-md text-[10px] leading-relaxed text-(--crt-dim)">
              OPENS A CHAT ALREADY BRIEFED ON THIS QUESTION, YOUR ANSWER, AND THE
              SOLUTION — JUST ASK YOUR FOLLOW-UP.
            </p>
          </div>
          {adj.nextUnattempted ? (
            <Link href={`/practice/${adj.nextUnattempted}${filterQuery}`} className="crt-btn-line whitespace-nowrap">
              NEXT UNATTEMPTED &gt;&gt;&gt;
            </Link>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
