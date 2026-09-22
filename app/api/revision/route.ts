import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/current-user";
import { getDueRevisions } from "@/lib/revision";
import { badRequest, unauthorized } from "@/lib/api/respond";
import { checkRateLimit, rateLimitedResponse } from "@/lib/security/rate-limit";
import { revisionQuerySchema } from "@/lib/validation/extension";

/** Spaced queue computed from attempts + bookmarks + mistakes (v1: no writes). */
export async function GET(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = revisionQuerySchema.safeParse(params);
  if (!parsed.success) return badRequest("Invalid pagination.");

  const limited = await checkRateLimit("revision-list", userId, 60, 60, {
    expensive: false,
    route: "GET /api/revision",
  });
  if (!limited.allowed) return rateLimitedResponse(limited.retryAfterSeconds);

  const result = await getDueRevisions(userId, parsed.data);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
