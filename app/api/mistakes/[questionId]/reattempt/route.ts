import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { mistakes, questions } from "@/db/schema";
import { currentUserId } from "@/lib/current-user";
import { forbidden, notFoundPrivate, unauthorized } from "@/lib/api/respond";
import { isAllowedOrigin } from "@/lib/security/origin";

/** Convenience redirect target for "Re-attempt" — no mutation. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ questionId: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  if (!isAllowedOrigin(request)) return forbidden();

  const { questionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(questionId)) return notFoundPrivate();

  const rows = await db
    .select({ questionId: mistakes.questionId })
    .from(mistakes)
    .innerJoin(questions, eq(mistakes.questionId, questions.id))
    .where(
      and(
        eq(mistakes.userId, userId),
        eq(mistakes.questionId, questionId),
        eq(questions.isPublished, true),
      ),
    )
    .limit(1);
  if (!rows[0]) return notFoundPrivate();

  return NextResponse.json(
    { practicePath: `/practice/${questionId}` },
    { headers: { "Cache-Control": "no-store" } },
  );
}
