import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/current-user";
import { getSyllabus } from "@/lib/syllabus";
import { ReadinessBar } from "@/components/syllabus/readiness-bar";
import { SyllabusGrid } from "@/components/syllabus/syllabus-grid";

const RULES =
  "NOT-STARTED: 0 ATTEMPTS · IN-PROGRESS: STARTED BUT UNDER A BAR · EXAM-READY: 5+ ATTEMPTS AND 80%+ ACCURACY AND 80%+ COVERAGE. FOCUS/SKIP MARKERS NEVER CHANGE STATS.";

export default async function SyllabusPage() {
  const userId = await currentUserId();
  if (!userId) redirect("/sign-in");

  const { subjects, overall } = await getSyllabus(userId);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="crt-micro text-[11px] text-(--crt-red)">[ 07 {"///"} SYLLABUS-MAP ]</p>
        <h1 className="crt-macro mt-2 text-[clamp(2.2rem,7vw,5.5rem)] text-(--crt-ink)">
          SYLLABUS<span className="text-(--crt-red)">.</span>
        </h1>
        <p className="crt-micro mt-3 max-w-2xl text-[10px] leading-relaxed text-(--crt-dim)" title={RULES}>
          DERIVED FROM YOUR ATTEMPTS — NO HAND-TICKS. {RULES}
        </p>
      </header>

      <ReadinessBar examReady={overall.examReadyTopics} total={overall.totalTopics} />
      <SyllabusGrid subjects={subjects} />
    </div>
  );
}
