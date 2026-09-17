import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/current-user";
import { deleteOwnedSession, getOwnedSession, getSessionMessages } from "@/lib/chat";
import { forbidden, notFoundPrivate, unauthorized } from "@/lib/api/respond";
import { isAllowedOrigin } from "@/lib/security/origin";

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

/** Delete a session and its messages — owner only, no enumeration. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  if (!isAllowedOrigin(request)) return forbidden();

  const { sessionId } = await params;
  const deleted = await deleteOwnedSession(userId, sessionId);
  if (!deleted) return notFoundPrivate();
  return NextResponse.json(
    { deleted: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
