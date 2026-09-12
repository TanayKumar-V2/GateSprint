import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/current-user";
import { listBookmarks } from "@/lib/progress";
import { QuestionCard } from "@/components/practice/question-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function BookmarksPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/sign-in");

  const saved = await listBookmarks(userId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Saved</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {saved.length} saved question{saved.length === 1 ? "" : "s"}
        </p>
      </div>

      {saved.length === 0 ? (
        <div className="rounded-xl border p-8 text-center">
          <p className="font-medium">Nothing saved yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Save tricky questions while solving to revisit them here.
          </p>
          <Link
            href="/practice"
            className={cn(buttonVariants(), "mt-4")}
          >
            Find questions
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {saved.map((q) => (
            <li key={q.id}>
              <QuestionCard question={q} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
