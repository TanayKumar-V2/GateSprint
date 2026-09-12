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
    return badRequest(result.message);
  }
  return NextResponse.json(
    { result },
    { headers: { "Cache-Control": "no-store" } },
  );
}
