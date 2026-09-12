import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/current-user";
import {
  listQuestions,
  listSubjects,
  listTopics,
} from "@/lib/questions";
import { listQuerySchema } from "@/lib/validation/answers";
import { PracticeFilters } from "@/components/practice/filters";
import { QuestionCard } from "@/components/practice/question-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const userId = await currentUserId();
  if (!userId) redirect("/sign-in");

  const raw = await searchParams;
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string" && v !== "") flat[k] = v;
  }
  const parsed = listQuerySchema.safeParse(flat);
  const filter = parsed.success
    ? parsed.data
    : { page: 1, limit: 20 as const };

  const [list, subjects, topics] = await Promise.all([
    listQuestions(userId, filter),
    listSubjects(),
    listTopics(flat.subject),
  ]);
  const years = Array.from(new Set(list.data.map((q) => q.year))).sort(
    (a, b) => b - a,
  );
  // Include seeded year range even when filters narrow the list.
  for (const y of [2024, 2023, 2022, 2021, 2020, 2019]) {
    if (!years.includes(y)) years.push(y);
  }
  years.sort((a, b) => b - a);

  const pageHref = (page: number) => {
    const params = new URLSearchParams({ ...flat, page: String(page) });
    return `/practice?${params.toString()}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Practice</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {list.total} question{list.total === 1 ? "" : "s"}
          {list.total > 0
            ? ` · page ${list.page} of ${list.totalPages}`
            : ""}
        </p>
      </div>

      <PracticeFilters
        options={{ subjects, topics, years, current: flat }}
      />

      {list.data.length === 0 ? (
        <div className="rounded-xl border p-8 text-center">
          <p className="font-medium">No questions match those filters</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Loosen a filter or two — new questions arrive as the bank grows.
          </p>
          <Link
            href="/practice"
            className={cn(buttonVariants({ variant: "outline" }), "mt-4")}
          >
            Clear filters
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {list.data.map((q) => (
            <li key={q.id}>
              <QuestionCard question={q} />
            </li>
          ))}
        </ul>
      )}

      {list.totalPages > 1 ? (
        <nav aria-label="Pages" className="flex items-center gap-2">
          {list.page > 1 ? (
            <Link
              href={pageHref(list.page - 1)}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              ← Previous
            </Link>
          ) : null}
          <span className="text-sm text-muted-foreground" aria-current="page">
            Page {list.page} of {list.totalPages}
          </span>
          {list.page < list.totalPages ? (
            <Link
              href={pageHref(list.page + 1)}
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Next →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
