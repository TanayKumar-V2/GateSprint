import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/current-user";
import { toggleMarkReview } from "@/lib/mocks";
import {
  badRequest,
  forbidden,
  notFoundPrivate,
  unauthorized,
} from "@/lib/api/respond";
import { isAllowedOrigin } from "@/lib/security/origin";
import { assertContentType } from "@/lib/security/request-guards";
import { checkRateLimit, rateLimitedResponse } from "@/lib/security/rate-limit";
import { mockMarkSchema } from "@/lib/validation/extension";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  if (!isAllowedOrigin(request)) return forbidden();

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFoundPrivate();

  const limited = await checkRateLimit("mocks-mark", userId, 60, 60, {
    expensive: false,
    route: "POST /api/mocks/[id]/mark",
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
  const parsed = mockMarkSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid request.");

  const result = await toggleMarkReview(userId, id, parsed.data.itemId, parsed.data.marked);
  if ("error" in result) {
    if (result.error === "not_found") return notFoundPrivate();
    return NextResponse.json(
      { error: { code: result.error, message: "This paper is already submitted." } },
      { status: 422 },
    );
  }
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
