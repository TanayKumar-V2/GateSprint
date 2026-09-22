import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/current-user";
import { finishMockSession } from "@/lib/mocks";
import { forbidden, notFoundPrivate, unauthorized } from "@/lib/api/respond";
import { isAllowedOrigin } from "@/lib/security/origin";
import { checkRateLimit, rateLimitedResponse } from "@/lib/security/rate-limit";

/**
 * Submit the paper. Idempotent by session state: a retried finish (or a
 * repeated Idempotency-Key) returns the same result without duplicating
 * attempt rows (clientKey `mock:{session}:{question}` + onConflictDoNothing).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  if (!isAllowedOrigin(request)) return forbidden();

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFoundPrivate();

  const limited = await checkRateLimit("mocks-finish", userId, 30, 60, {
    expensive: false,
    route: "POST /api/mocks/[id]/finish",
  });
  if (!limited.allowed) return rateLimitedResponse(limited.retryAfterSeconds);

  const result = await finishMockSession(userId, id);
  if ("error" in result) return notFoundPrivate();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
