import Link from "next/link";
import { notFound } from "next/navigation";

export default async function QuestionPlaceholderPage({
  params,
}: {
  params: Promise<{ questionId: string }>;
}) {
  const { questionId } = await params;
  if (!questionId || questionId.length > 120) notFound();
  return (
    <section aria-labelledby="q-heading" className="max-w-2xl">
      <h1 id="q-heading" className="text-2xl font-semibold tracking-tight">
        Question
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Question detail for <code>{questionId}</code> lands in Phase 4.
      </p>
      <p className="mt-4 text-sm">
        <Link href="/practice" className="underline">
          Back to Practice
        </Link>
      </p>
    </section>
  );
}
