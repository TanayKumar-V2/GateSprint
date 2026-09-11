import Link from "next/link";
import { notFound } from "next/navigation";

export default async function SessionPlaceholderPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  if (!sessionId || sessionId.length > 120) notFound();
  return (
    <section aria-labelledby="s-heading" className="max-w-2xl">
      <h1 id="s-heading" className="text-2xl font-semibold tracking-tight">
        Mentor session
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Session <code>{sessionId}</code> view lands in Phase 7.
      </p>
      <p className="mt-4 text-sm">
        <Link href="/mentor" className="underline">
          Back to Mentor
        </Link>
      </p>
    </section>
  );
}
