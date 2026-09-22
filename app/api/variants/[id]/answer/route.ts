import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/current-user";
import { answerVariant } from "@/lib/variants";
import {
  badRequest,
  forbidden,
  notFoundPrivate,
  unauthorized,
} from "@/lib/api/respond";
import { isAllowedOrigin } from "@/lib/security/origin";
import { assertContentType } from "@/lib/security/request-guards";
import { checkRateLimit, rateLimitedResponse } from "@/lib/security/rate-limit";
import { variantAnswerSchema } from "@/lib/validation/extension";

/** Grade one variant answer. Key revealed with the verdict (retest, not exam). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  if (!isAllowedOrigin(request)) return forbidden();

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFoundPrivate();

  const limited = await checkRateLimit("variants-answer", userId, 60, 60, {
    expensive: false,
    route: "POST /api/variants/[id]/answer",
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
  const parsed = variantAnswerSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid answer.");

  const result = await answerVariant(userId, id, parsed.data.answer);
  if ("error" in result) {
    if (result.error === "not_found") return notFoundPrivate();
    return badRequest(result.message);
  }
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
