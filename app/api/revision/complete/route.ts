import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/current-user";
import { getDueRevisions } from "@/lib/revision";
import {
  badRequest,
  forbidden,
  unauthorized,
} from "@/lib/api/respond";
import { isAllowedOrigin } from "@/lib/security/origin";
import { assertContentType } from "@/lib/security/request-guards";
import { revisionCompleteSchema } from "@/lib/validation/extension";

/**
 * v1: completion is derived from attempts — re-attempting the question is
 * what moves it. This endpoint just returns the fresh queue state so the
 * client can confirm without inventing a write.
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
  const parsed = revisionCompleteSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid request.");

  const result = await getDueRevisions(userId, { limit: 20, page: 1 });
  const stillDue = result.due.some((d) => d.questionId === parsed.data.questionId);
  return NextResponse.json(
    { ok: true, stillDue, stats: result.stats },
    { headers: { "Cache-Control": "no-store" } },
  );
}
