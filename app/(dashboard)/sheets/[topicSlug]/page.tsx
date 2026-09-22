import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/current-user";
import { getSheet } from "@/lib/sheets";
import { SheetRenderer } from "@/components/sheets/sheet-renderer";
import { SheetQuizButton, SheetRevisedButton, SheetPrintButton } from "@/components/sheets/sheet-quiz-button";

export default async function SheetPage({
  params,
}: {
  params: Promise<{ topicSlug: string }>;
}) {
  const userId = await currentUserId();
  if (!userId) redirect("/sign-in");

  const { topicSlug } = await params;
  const result = await getSheet(userId, topicSlug);
  if ("error" in result) notFound();

  const { topic, sheet, revisedToday } = result;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <nav aria-label="Back">
        <Link
          href="/sheets"
          className="crt-micro inline-block text-[11px] text-(--crt-dim) transition-colors hover:text-(--crt-red) print:hidden"
        >
          &lt;&lt;&lt; ALL SHEETS
        </Link>
      </nav>

      <header>
        <p className="crt-micro text-[11px] text-(--crt-red)">
          [ SHEET {"///"} {topic.subjectName.toUpperCase()} ]
        </p>
        <h1 className="crt-macro mt-2 text-[clamp(2rem,6vw,4rem)] text-(--crt-ink) print:text-black">
          {topic.name}<span className="text-(--crt-red)">.</span>
        </h1>
        {sheet ? (
          <p className="crt-micro mt-3 text-[10px] text-(--crt-dim)">
            V{sheet.version} · UPDATED {sheet.updatedAt.toISOString().slice(0, 10)} · HUMAN-CURATED
          </p>
        ) : null}
      </header>

      {sheet ? (
        <>
          <SheetRenderer contentMd={sheet.contentMd} />
          <div className="flex flex-wrap gap-3 print:hidden">
            <SheetQuizButton topicSlug={topic.slug} />
            <SheetRevisedButton topicSlug={topic.slug} revisedToday={revisedToday} />
            <SheetPrintButton />
          </div>
        </>
      ) : (
        <div className="border border-(--crt-line) bg-(--crt-bg) p-8 text-center sm:p-12">
          <p className="crt-macro text-[clamp(1.4rem,4vw,2.2rem)] text-(--crt-ink)">
            NO SHEET YET<span className="text-(--crt-red)">.</span>
          </p>
          <p className="crt-micro mt-3 text-[11px] leading-relaxed text-(--crt-dim)">
            SHEETS ARE HUMAN-CURATED — THIS ONE IS STILL ON THE DRAFTING TABLE.
          </p>
          <Link href={`/practice?subject=${topic.subjectSlug}&topic=${topic.slug}`} className="crt-btn-red mt-6">
            PRACTICE THE TOPIC &gt;&gt;&gt;
          </Link>
        </div>
      )}
    </div>
  );
}
