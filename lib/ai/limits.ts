import "server-only";
import { and, count, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { chatMessages, chatSessions } from "@/db/schema";

/* ---------- Tunables (env-overridable) ---------- */

const num = (key: string, fallback: number): number => {
  const raw = process.env[key];
  const parsed = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const CHAT_MAX_INPUT_CHARS = num("CHAT_MAX_INPUT_CHARS", 4000);
export const CHAT_MAX_HISTORY_MESSAGES = num("CHAT_MAX_HISTORY_MESSAGES", 30);
export const CHAT_MAX_OUTPUT_TOKENS = num("CHAT_MAX_OUTPUT_TOKENS", 700);
export const CHAT_TEMPERATURE = 0.2;
export const CHAT_PROVIDER_TIMEOUT_MS = num("CHAT_PROVIDER_TIMEOUT_MS", 45000);
export const CHAT_DAILY_BUDGET = num("CHAT_DAILY_BUDGET", 100);
export const CHAT_MINUTE_LIMIT = num("CHAT_MINUTE_LIMIT", 10);
export const SESSION_HOURLY_LIMIT = num("SESSION_HOURLY_LIMIT", 10);

/**
 * Daily per-user model budget: counts assistant messages generated in the
 * last 24h. The remaining budget is visible only to that user.
 */
export async function generationsUsedToday(userId: string): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(chatMessages)
    .innerJoin(chatSessions, eq(chatMessages.sessionId, chatSessions.id))
    .where(
      and(
        eq(chatSessions.userId, userId),
        eq(chatMessages.role, "assistant"),
        gte(chatMessages.createdAt, sql`now() - interval '24 hours'`),
      ),
    );
  return rows[0]?.n ?? 0;
}
