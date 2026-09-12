import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/current-user";
import { getQuestionView } from "@/lib/questions";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { QuestionSolver } from "@/components/practice/solver";
import { MathText } from "@/components/markdown/math-text";
import { cn } from "@/lib/utils";

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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <nav aria-label="Back">
        <Link
          href="/practice"
          className={cn(buttonVariants({ variant: "ghost" }))}
        >
          ← All questions
        </Link>
      </nav>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{TYPE_LABEL[view.type]}</Badge>
          <Badge variant="outline">{view.difficulty}</Badge>
          <Badge variant="outline">{view.year}</Badge>
          <Badge variant="outline">
            {view.marks} mark{view.marks === 1 ? "" : "s"}
          </Badge>
          {view.lastAttempt ? (
            <Badge>{view.lastAttempt.isCorrect ? "Solved ✓" : "Attempted"}</Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {view.subject.name} · {view.topic.name}
          {view.sourceLabel ? ` · ${view.sourceLabel}` : ""}
          {view.questionNumber ? ` · Q${view.questionNumber}` : ""}
        </p>
        <h1 className="prose-study text-lg font-medium leading-8">
          <MathText text={view.prompt} inline />
        </h1>
      </header>

      <QuestionSolver view={view} />

      <footer className="flex flex-wrap items-center gap-3 border-t pt-4">
        <Link
          href="/mentor"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Ask Mentor about this
        </Link>
        <p className="text-xs text-muted-foreground">
          Full question context travels with you soon — for now it opens a
          fresh chat.
        </p>
      </footer>
    </div>
  );
}
