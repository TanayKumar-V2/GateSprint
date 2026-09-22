import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/current-user";
import { getTimeAnalytics } from "@/lib/time-analytics";
import { badRequest, unauthorized } from "@/lib/api/respond";
import { checkRateLimit, rateLimitedResponse } from "@/lib/security/rate-limit";
import { timeQuerySchema } from "@/lib/validation/extension";

/** Speed vs accuracy from the user's own timed attempts + anonymized medians. */
export async function GET(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = timeQuerySchema.safeParse(params);
  if (!parsed.success) return badRequest("Invalid filters.");

  const limited = await checkRateLimit("progress-time", userId, 30, 60, {
    expensive: false,
    route: "GET /api/progress/time",
  });
  if (!limited.allowed) return rateLimitedResponse(limited.retryAfterSeconds);

  const result = await getTimeAnalytics(userId, parsed.data);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
