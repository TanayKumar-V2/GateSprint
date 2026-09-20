import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/current-user";
import { listBookmarks } from "@/lib/progress";
import { QuestionCard } from "@/components/practice/question-card";
import { Reveal } from "@/components/motion/reveal";

export default async function BookmarksPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/sign-in");

  const saved = await listBookmarks(userId);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="crt-micro text-[11px] text-(--crt-red)">[ 04 {"///"} SAVED-BUFFER ]</p>
        <h1 className="crt-macro mt-2 text-[clamp(2.2rem,7vw,5.5rem)] text-(--crt-ink)">
          SAVED<span className="text-(--crt-red)">.</span>
        </h1>
        <p className="crt-micro mt-3 text-[11px] text-(--crt-dim)">
          <output>
            {saved.length} UNIT{saved.length === 1 ? "" : "S"} IN BUFFER
          </output>
          {" /// "}KILL-LIST FOR REVISION
        </p>
      </header>

      {saved.length === 0 ? (
        <div className="border border-(--crt-line) bg-(--crt-bg) p-8 text-center sm:p-12">
          <p className="crt-macro text-[clamp(1.4rem,4vw,2.2rem)] text-(--crt-ink)">
            BUFFER EMPTY<span className="text-(--crt-red)">.</span>
          </p>
          <p className="crt-micro mt-3 text-[11px] leading-relaxed text-(--crt-dim)">
            SAVE TRICKY QUESTIONS WHILE SOLVING TO REVISIT THEM HERE.
          </p>
          <Link href="/practice" className="crt-btn-red mt-6">
            FIND QUESTIONS &gt;&gt;&gt;
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {saved.map((q, i) => (
            <Reveal as="li" key={q.id} delay={(i % 6) * 60}>
              <QuestionCard question={q} />
            </Reveal>
          ))}
        </ul>
      )}
    </div>
  );
}
