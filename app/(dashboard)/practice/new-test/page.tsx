import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/current-user";
import { listFilterOptions } from "@/lib/test-builder";
import { TestBuilderForm } from "@/components/test-builder/test-builder-form";

export default async function NewTestPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/sign-in");

  const options = await listFilterOptions();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <nav aria-label="Back">
        <Link
          href="/mocks"
          className="crt-micro inline-block text-[11px] text-(--crt-dim) transition-colors hover:text-(--crt-red)"
        >
          &lt;&lt;&lt; MOCKS
        </Link>
      </nav>
      <header>
        <p className="crt-micro text-[11px] text-(--crt-red)">[ 08 {"///"} TEST-BUILDER ]</p>
        <h1 className="crt-macro mt-2 text-[clamp(2rem,6vw,4rem)] text-(--crt-ink)">
          CUSTOM DRILL<span className="text-(--crt-red)">.</span>
        </h1>
        <p className="crt-micro mt-3 max-w-xl text-[10px] leading-relaxed text-(--crt-dim)">
          DRILL YOUR WEAK MIX UNDER TIME PRESSURE. ONLY VERIFIED (GRADED) QUESTIONS ARE ELIGIBLE —
          PRACTICE ATTEMPTS VERIFY MORE KEYS AND GROW THE POOL.
        </p>
      </header>
      <TestBuilderForm options={options} />
    </div>
  );
}
