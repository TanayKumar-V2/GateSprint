import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/current-user";
import { answerMockItem } from "@/lib/mocks";
import {
  badRequest,
  forbidden,
  notFoundPrivate,
  unauthorized,
} from "@/lib/api/respond";
import { isAllowedOrigin } from "@/lib/security/origin";
import { assertContentType } from "@/lib/security/request-guards";
import { checkRateLimit, rateLimitedResponse } from "@/lib/security/rate-limit";
import { mockAnswerSchema } from "@/lib/validation/extension";

/** Save one answer. Correctness is graded server-side, never revealed here. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  if (!isAllowedOrigin(request)) return forbidden();

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFoundPrivate();

  const limited = await checkRateLimit("mocks-answer", userId, 120, 60, {
    expensive: false,
    route: "POST /api/mocks/[id]/answer",
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
  const parsed = mockAnswerSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid answer.");

  const result = await answerMockItem(
    userId,
    id,
    parsed.data.itemId,
    parsed.data.answer,
    parsed.data.timeTakenSeconds,
  );
  if ("error" in result) {
    if (result.error === "not_found") return notFoundPrivate();
    if (result.error === "finished" || result.error === "expired") {
      return NextResponse.json(
        { error: { code: result.error, message: result.message } },
        { status: 422 },
      );
    }
    return badRequest(result.message);
  }
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
