import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { MathText } from "@/components/markdown/math-text";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { QuestionListItem } from "@/lib/questions";

const TYPE_LABEL: Record<QuestionListItem["type"], string> = {
  mcq: "MCQ",
  msq: "MSQ",
  nat: "NAT",
};

export function QuestionCard({ question }: { question: QuestionListItem }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{TYPE_LABEL[question.type]}</Badge>
          <Badge variant="outline">{question.difficulty}</Badge>
          <Badge variant="outline">{question.year}</Badge>
          <Badge variant="outline">
            {question.marks} mark{question.marks === 1 ? "" : "s"}
          </Badge>
          {question.attempted ? (
            <Badge>Attempted</Badge>
          ) : (
            <Badge variant="outline">Unattempted</Badge>
          )}
          {question.bookmarked ? <Badge>Saved</Badge> : null}
        </div>
        <CardTitle className="text-base font-medium leading-6">
          <Link
            href={`/practice/${question.id}`}
            className="hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            {question.subject.name} · {question.topic.name}
          </Link>
        </CardTitle>
        <CardDescription>
          {question.sourceLabel ?? `GATE ${question.year}`}
          {question.questionNumber
            ? ` · Question ${question.questionNumber}`
            : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <MathText
          text={question.prompt}
          inline
          className="line-clamp-2 text-sm leading-6 text-muted-foreground [&_.katex-display]:hidden"
        />
      </CardContent>
    </Card>
  );
}
