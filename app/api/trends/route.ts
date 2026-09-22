import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/current-user";
import { getWeightage } from "@/lib/trends";
import { badRequest, unauthorized } from "@/lib/api/respond";
import { checkRateLimit, rateLimitedResponse } from "@/lib/security/rate-limit";
import { trendsQuerySchema } from "@/lib/validation/extension";

/**
 * Bank-derived weightage over the last 10 years. Global data, no user rows —
 * safe to cache at the edge for an hour.
 */
export async function GET(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = trendsQuerySchema.safeParse(params);
  if (!parsed.success) return badRequest("Invalid filters.");

  const limited = await checkRateLimit("trends", userId, 30, 60, {
    expensive: false,
    route: "GET /api/trends",
  });
  if (!limited.allowed) return rateLimitedResponse(limited.retryAfterSeconds);

  const weightage = await getWeightage(parsed.data);
  return NextResponse.json(weightage, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" },
  });
}
