import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/current-user";
import { getMistakeStats, listMistakes } from "@/lib/mistakes";
import { badRequest, unauthorized } from "@/lib/api/respond";
import { checkRateLimit, rateLimitedResponse } from "@/lib/security/rate-limit";
import { mistakeListQuerySchema } from "@/lib/validation/extension";

/** Owner-scoped revision inbox: wrong attempts with tag/resolve state. */
export async function GET(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = mistakeListQuerySchema.safeParse(params);
  if (!parsed.success) return badRequest("Invalid filters.");

  const limited = await checkRateLimit("mistakes-list", userId, 60, 60, {
    expensive: false,
    route: "GET /api/mistakes",
  });
  if (!limited.allowed) return rateLimitedResponse(limited.retryAfterSeconds);

  const result = await listMistakes(userId, parsed.data);
  const stats = await getMistakeStats(userId);
  return NextResponse.json(
    { ...result, stats },
    { headers: { "Cache-Control": "no-store" } },
  );
}
