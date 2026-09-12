import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/current-user";
import { getQuestionView } from "@/lib/questions";
import { notFoundPrivate, unauthorized } from "@/lib/api/respond";

/**
 * One published question. The answer and solution are included only when
 * the student already attempted it — never before.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ questionId: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const { questionId } = await params;
  const view = await getQuestionView(userId, questionId);
  if (!view) return notFoundPrivate();

  return NextResponse.json(
    { question: view },
    { headers: { "Cache-Control": "no-store" } },
  );
}
