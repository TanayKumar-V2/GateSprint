import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/current-user";
import { createMockSession, listMockSessions } from "@/lib/mocks";
import {
  badRequest,
  forbidden,
  unauthorized,
} from "@/lib/api/respond";
import { isAllowedOrigin } from "@/lib/security/origin";
import { assertContentType } from "@/lib/security/request-guards";
import { checkRateLimit, rateLimitedResponse } from "@/lib/security/rate-limit";
import { mockCreateSchema, mockListQuerySchema } from "@/lib/validation/extension";

export async function GET(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = mockListQuerySchema.safeParse(params);
  if (!parsed.success) return badRequest("Invalid pagination.");

  const list = await listMockSessions(userId, parsed.data);
  return NextResponse.json(list, { headers: { "Cache-Control": "no-store" } });
}

/**
 * Start a timed paper. The question set snapshots at creation; only
 * graded (keyed) questions are eligible so grading stays instant mid-exam.
 */
export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  if (!isAllowedOrigin(request)) return forbidden();

  const limited = await checkRateLimit("mocks-create", userId, 5, 3600, {
    expensive: false,
    route: "POST /api/mocks",
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
  const parsed = mockCreateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid mock request.");

  const result = await createMockSession(userId, parsed.data);
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
