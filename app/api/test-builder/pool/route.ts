import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/current-user";
import { getPoolCount } from "@/lib/test-builder";
import { suggestedDuration } from "@/lib/test-builder";
import { badRequest, unauthorized } from "@/lib/api/respond";
import { checkRateLimit, rateLimitedResponse } from "@/lib/security/rate-limit";
import { builderPoolQuerySchema } from "@/lib/validation/extension";

/** Live pool count + estimated marks for the builder form. Keyed Qs only. */
export async function GET(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = builderPoolQuerySchema.safeParse(params);
  if (!parsed.success) return badRequest("Invalid filters.");

  const limited = await checkRateLimit("builder-pool", userId, 60, 60, {
    expensive: false,
    route: "GET /api/test-builder/pool",
  });
  if (!limited.allowed) return rateLimitedResponse(limited.retryAfterSeconds);

  const pool = await getPoolCount({
    subjectSlugs: parsed.data.subjects,
    topicSlugs: parsed.data.topics,
    difficulty: parsed.data.difficulty,
    questionType: parsed.data.type,
  });
  return NextResponse.json(
    { ...pool, suggestedDurationSeconds: suggestedDuration(pool.count, pool.mix) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
