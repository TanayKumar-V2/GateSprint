import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/current-user";
import { resolveTopicId, setTopicOverride } from "@/lib/syllabus";
import {
  badRequest,
  forbidden,
  notFoundPrivate,
  unauthorized,
} from "@/lib/api/respond";
import { isAllowedOrigin } from "@/lib/security/origin";
import { assertContentType } from "@/lib/security/request-guards";
import { checkRateLimit, rateLimitedResponse } from "@/lib/security/rate-limit";
import { syllabusTopicPatchSchema } from "@/lib/validation/extension";

/** Display-only focus/skip marker. Stats stay derived — never polluted. */
export async function PATCH(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  if (!isAllowedOrigin(request)) return forbidden();

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
  const parsed = syllabusTopicPatchSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid request.");

  const limited = await checkRateLimit("syllabus-patch", userId, 60, 60, {
    expensive: false,
    route: "PATCH /api/syllabus/topic",
  });
  if (!limited.allowed) return rateLimitedResponse(limited.retryAfterSeconds);

  const topicId = await resolveTopicId(parsed.data.subjectSlug, parsed.data.topicSlug);
  if (!topicId) return notFoundPrivate();

  const result = await setTopicOverride(userId, topicId, parsed.data.override);
  if ("error" in result) return notFoundPrivate();

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
