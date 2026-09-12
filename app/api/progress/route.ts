import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/current-user";
import { getProgress, getRecommendations } from "@/lib/progress";
import { unauthorized } from "@/lib/api/respond";

/**
 * The student's own aggregates plus weak topics and next steps.
 * Accuracy is null (never 0%) until the first attempt exists.
 */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const progress = await getProgress(userId);
  const next = await getRecommendations(userId, { limit: 3 });

  return NextResponse.json(
    {
      overall: progress.overall,
      subjects: progress.subjects,
      topics: progress.topics,
      weakTopics: progress.weakTopics,
      nextSteps: next.data,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
