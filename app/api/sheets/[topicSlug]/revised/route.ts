import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/current-user";
import { markRevised, resolveTopicBySlug } from "@/lib/sheets";
import { db } from "@/db";
import { sheets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { forbidden, notFoundPrivate, unauthorized } from "@/lib/api/respond";
import { isAllowedOrigin } from "@/lib/security/origin";

/** One "revised" tick per user/sheet/day — retries collapse idempotently. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ topicSlug: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  if (!isAllowedOrigin(request)) return forbidden();

  const { topicSlug } = await params;
  const topic = await resolveTopicBySlug(topicSlug);
  if (!topic) return notFoundPrivate();

  const rows = await db.select({ id: sheets.id }).from(sheets).where(eq(sheets.topicId, topic.id)).limit(1);
  if (!rows[0]) return notFoundPrivate();

  const result = await markRevised(userId, rows[0].id);
  if ("error" in result) return notFoundPrivate();
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
