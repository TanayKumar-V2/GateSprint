import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/current-user";
import { setMistakeResolved, setMistakeTag } from "@/lib/mistakes";
import {
  badRequest,
  forbidden,
  notFoundPrivate,
  unauthorized,
} from "@/lib/api/respond";
import { isAllowedOrigin } from "@/lib/security/origin";
import { assertContentType } from "@/lib/security/request-guards";
import { checkRateLimit, rateLimitedResponse } from "@/lib/security/rate-limit";
import { mistakePatchSchema } from "@/lib/validation/extension";

/** Tag a mistake or flip its resolved flag. Owner-scoped; 404 stays private. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ questionId: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  if (!isAllowedOrigin(request)) return forbidden();

  const { questionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(questionId)) return notFoundPrivate();

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
  const parsed = mistakePatchSchema.safeParse(body);
  if (!parsed.success) return badRequest("Provide tag and/or resolved.");

  const limited = await checkRateLimit("mistakes-patch", userId, 60, 60, {
    expensive: false,
    route: "PATCH /api/mistakes/[questionId]",
  });
  if (!limited.allowed) return rateLimitedResponse(limited.retryAfterSeconds);

  if (parsed.data.tag !== undefined) {
    const r = await setMistakeTag(userId, questionId, parsed.data.tag);
    if ("error" in r) return notFoundPrivate();
  }
  if (parsed.data.resolved !== undefined) {
    const r = await setMistakeResolved(userId, questionId, parsed.data.resolved);
    if ("error" in r) return notFoundPrivate();
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
