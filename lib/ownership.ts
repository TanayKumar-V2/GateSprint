import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { attempts, bookmarks, chatSessions } from "@/db/schema";

/**
 * Owner-scoped loaders. Every query below filters by the signed-in user id
 * from the server session. A wrong owner gets the same `null` as a missing
 * row, so callers can't probe for other users' data.
 */

export async function findOwnChatSession(userId: string, sessionId: string) {
  const rows = await db
    .select()
    .from(chatSessions)
    .where(
      and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function findOwnAttempt(userId: string, attemptId: string) {
  const rows = await db
    .select()
    .from(attempts)
    .where(and(eq(attempts.id, attemptId), eq(attempts.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findOwnBookmark(userId: string, questionId: string) {
  const rows = await db
    .select()
    .from(bookmarks)
    .where(
      and(
        eq(bookmarks.questionId, questionId),
        eq(bookmarks.userId, userId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
