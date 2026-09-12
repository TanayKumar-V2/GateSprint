import Link from "next/link";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type FilterOptions = {
  subjects: { slug: string; name: string }[];
  topics: { slug: string; name: string; subjectId: string }[];
  years: number[];
  current: Record<string, string>;
};

/**
 * Plain GET form: filters live in the URL, so results are shareable and
 * work without JavaScript.
 */
export function PracticeFilters({ options }: { options: FilterOptions }) {
  const { subjects, topics, years, current } = options;
  return (
    <form
      method="get"
      action="/practice"
      className="grid gap-3 rounded-xl border p-4 sm:grid-cols-3 lg:grid-cols-4"
    >
      <label className="flex flex-col gap-1 text-sm">
        Subject
        <select
          name="subject"
          defaultValue={current.subject ?? ""}
          className="h-9 rounded-md border border-input bg-background px-2"
        >
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Topic
        <select
          name="topic"
          defaultValue={current.topic ?? ""}
          className="h-9 rounded-md border border-input bg-background px-2"
        >
          <option value="">All topics</option>
          {topics.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Year
        <select
          name="year"
          defaultValue={current.year ?? ""}
          className="h-9 rounded-md border border-input bg-background px-2"
        >
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Type
        <select
          name="type"
          defaultValue={current.type ?? ""}
          className="h-9 rounded-md border border-input bg-background px-2"
        >
          <option value="">All types</option>
          <option value="mcq">MCQ</option>
          <option value="msq">MSQ</option>
          <option value="nat">NAT</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Difficulty
        <select
          name="difficulty"
          defaultValue={current.difficulty ?? ""}
          className="h-9 rounded-md border border-input bg-background px-2"
        >
          <option value="">Any difficulty</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </label>
      <fieldset className="flex items-end gap-4 text-sm">
        <legend className="sr-only">Status</legend>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="attempted"
            value="true"
            defaultChecked={current.attempted === "true"}
            className="size-4"
          />
          Attempted
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="bookmarked"
            value="true"
            defaultChecked={current.bookmarked === "true"}
            className="size-4"
          />
          Saved
        </label>
      </fieldset>
      <div className="flex items-end gap-2">
        <Button type="submit">Apply</Button>
        <Link href="/practice" className={cn(buttonVariants({ variant: "outline" }))}>
          Clear
        </Link>
      </div>
      <Input type="hidden" name="page" value="1" readOnly className="hidden" />
    </form>
  );
}
