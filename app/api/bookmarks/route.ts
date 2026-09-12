import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookmarks, questions } from "@/db/schema";
import { currentUserId } from "@/lib/current-user";
import {
  badRequest,
  forbidden,
  notFoundPrivate,
  unauthorized,
} from "@/lib/api/respond";
import { isAllowedOrigin } from "@/lib/security/origin";
import { assertContentType } from "@/lib/security/request-guards";
import { bookmarkToggleSchema } from "@/lib/validation/answers";

/** Toggle a bookmark; returns the resulting state. */
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
  const parsed = bookmarkToggleSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid request.");

  const question = await db
    .select({ id: questions.id })
    .from(questions)
    .where(
      and(
        eq(questions.id, parsed.data.questionId),
        eq(questions.isPublished, true),
      ),
    )
    .limit(1);
  if (!question[0]) return notFoundPrivate();

  const existing = await db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.userId, userId),
        eq(bookmarks.questionId, parsed.data.questionId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db.delete(bookmarks).where(eq(bookmarks.id, existing[0].id));
    return NextResponse.json(
      { bookmarked: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  await db.insert(bookmarks).values({
    userId,
    questionId: parsed.data.questionId,
  });
  return NextResponse.json(
    { bookmarked: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
