import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/current-user";
import { buildCustomTest } from "@/lib/test-builder";
import {
  badRequest,
  forbidden,
  unauthorized,
} from "@/lib/api/respond";
import { isAllowedOrigin } from "@/lib/security/origin";
import { assertContentType } from "@/lib/security/request-guards";
import { checkRateLimit, rateLimitedResponse } from "@/lib/security/rate-limit";
import { builderCreateSchema } from "@/lib/validation/extension";

/** Build a custom drill: a sectional session, then straight to the runner. */
export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  if (!isAllowedOrigin(request)) return forbidden();

  const limited = await checkRateLimit("mocks-create", userId, 5, 3600, {
    expensive: false,
    route: "POST /api/test-builder",
  });
  if (!limited.allowed) return rateLimitedResponse(limited.retryAfterSeconds);

  try {
    assertContentType(request);
  } catch {
    return badRequest("Send JSON.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Send valid JSON.");
  }
  const parsed = builderCreateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid test request.");

  const result = await buildCustomTest(userId, parsed.data);
  if ("error" in result) {
    return NextResponse.json(
      {
        error: {
          code: "pool_exhausted",
          message: result.message,
          ...(result.available !== undefined ? { available: result.available } : {}),
        },
      },
      { status: 422 },
    );
  }
  return NextResponse.json(
    {
      sessionId: result.sessionId,
      endsAt: result.endsAt.toISOString(),
      practicePath: `/mocks/${result.sessionId}`,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
