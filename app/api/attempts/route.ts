import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/current-user";
import { submitAttempt } from "@/lib/attempts";
import {
  badRequest,
  forbidden,
  notFoundPrivate,
  unauthorized,
} from "@/lib/api/respond";
import { isAllowedOrigin } from "@/lib/security/origin";
import { assertContentType } from "@/lib/security/request-guards";
import { attemptSubmissionSchema } from "@/lib/validation/answers";

/**
 * Grade and record an answer. Correctness is recomputed server-side;
 * anything the client claims about being right is ignored.
 *
 * Questions without a stored key are AI-graded on the first attempt
 * (answer cached for later attempts). Nothing is recorded when the
 * grader cannot judge or is unavailable.
 */
export async function POST(request: Request) {
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
  const parsed = attemptSubmissionSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid submission.");

  const result = await submitAttempt(userId, parsed.data);
  if ("error" in result) {
    if (result.error === "not_found") return notFoundPrivate();
    if (result.error === "needs_review")
      return NextResponse.json({ error: { code: "needs_review", message: result.message } }, { status: 422 });
    if (result.error === "ai_unavailable")
      return NextResponse.json({ error: { code: "ai_unavailable", message: result.message } }, { status: 503 });
    return badRequest(result.message);
  }
  return NextResponse.json(
    { result },
    { headers: { "Cache-Control": "no-store" } },
  );
}
