import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/current-user";
import { getOwnedSession, getSessionMessages } from "@/lib/chat";
import { notFoundPrivate, unauthorized } from "@/lib/api/respond";

/** One session with its messages — only for its owner. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const { sessionId } = await params;
  const session = await getOwnedSession(userId, sessionId);
  if (!session) return notFoundPrivate();

  const messages = await getSessionMessages(sessionId);
  return NextResponse.json(
    { session, messages },
    { headers: { "Cache-Control": "no-store" } },
  );
}
