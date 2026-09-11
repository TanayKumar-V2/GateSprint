import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function PracticePlaceholderPage() {
  return (
    <section aria-labelledby="practice-heading" className="max-w-2xl">
      <h1 id="practice-heading" className="text-2xl font-semibold tracking-tight">
        Practice
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Question browsing, filtering, and solving land in Phase 4. No questions
        are faked as complete in this foundation build.
      </p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className={cn(buttonVariants())}>
          Back home
        </Link>
        <Link
          href="/mentor"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Open Mentor
        </Link>
      </div>
    </section>
  );
}
