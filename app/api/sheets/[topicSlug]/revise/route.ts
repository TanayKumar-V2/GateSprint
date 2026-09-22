import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/current-user";
import { resolveTopicBySlug, startSheetQuiz } from "@/lib/sheets";
import { forbidden, notFoundPrivate, unauthorized } from "@/lib/api/respond";
import { isAllowedOrigin } from "@/lib/security/origin";
import { checkRateLimit, rateLimitedResponse } from "@/lib/security/rate-limit";

/** Start a Mentor revision session scoped to this topic's sheet. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ topicSlug: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  if (!isAllowedOrigin(request)) return forbidden();

  const { topicSlug } = await params;
  const topic = await resolveTopicBySlug(topicSlug);
  if (!topic) return notFoundPrivate();

  const limited = await checkRateLimit("sheet-quiz", userId, 10, 3600, {
    expensive: false,
    route: "POST /api/sheets/[topicSlug]/revise",
  });
  if (!limited.allowed) return rateLimitedResponse(limited.retryAfterSeconds);

  const result = await startSheetQuiz(userId, topic.id);
  if ("error" in result) {
    return NextResponse.json(
      {
        error: {
          code: result.error,
          message:
            result.error === "no_sheet"
              ? "No sheet published for this topic yet."
              : "Not found.",
        },
      },
      { status: result.error === "no_sheet" ? 422 : 404 },
    );
  }
  return NextResponse.json(
    { sessionId: result.sessionId, mentorPath: `/mentor/${result.sessionId}` },
    { headers: { "Cache-Control": "no-store" } },
  );
}
