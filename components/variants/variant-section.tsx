import { listVariants } from "@/lib/variants";
import { GenerateVariantsButton } from "./generate-variants-button";
import { VariantQuiz } from "./variant-quiz";

/** Practice panel for question/topic Mentor sessions (server wrapper). */
export async function VariantSection({
  userId,
  sessionId,
}: {
  userId: string;
  sessionId: string;
}) {
  const initial = await listVariants(userId, sessionId);
  if ("error" in initial) return null;

  return (
    <section aria-labelledby="variants-heading" className="flex flex-col gap-4 border border-(--crt-line) bg-(--crt-raised) p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="variants-heading" className="crt-micro text-[11px] text-(--crt-red)">
            [ QUIZ-ME {"///"} RETEST WITHOUT LEAVING CHAT ]
          </h2>
          <p className="crt-micro mt-2 max-w-xl text-[10px] leading-relaxed text-(--crt-dim)">
            MENTOR WRITES FRESH VARIANTS ON THIS SOURCE — MARKED AI-GENERATED UNTIL A CORRECT
            RETEST VERIFIES THEM.
          </p>
        </div>
        <GenerateVariantsButton sessionId={sessionId} />
      </div>
      <VariantQuiz sessionId={sessionId} initial={initial} />
    </section>
  );
}
