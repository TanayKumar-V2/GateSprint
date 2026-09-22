import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { chatMessages, sheets, sheetRevisions, subjects, topics } from "@/db/schema";
import { createSession } from "./chat";
import { sheetContextBlock, utcDay } from "./sheets-rules";
import { now } from "./time";

export type SheetTopic = {
  id: string;
  slug: string;
  name: string;
  subjectSlug: string;
  subjectName: string;
};

export async function resolveTopicBySlug(topicSlug: string): Promise<SheetTopic | null> {
  const rows = await db
    .select({
      id: topics.id,
      slug: topics.slug,
      name: topics.name,
      subjectSlug: subjects.slug,
      subjectName: subjects.name,
    })
    .from(topics)
    .innerJoin(subjects, eq(topics.subjectId, subjects.id))
    .where(eq(topics.slug, topicSlug));
  // Slugs are unique per subject, not globally: never guess on collision.
  return rows.length === 1 ? rows[0]! : null;
}

export async function getSheet(userId: string, topicSlug: string): Promise<
  | {
      topic: SheetTopic;
      sheet: { contentMd: string; version: number; updatedAt: Date } | null;
      revisedToday: boolean;
    }
  | { error: "not_found" }
> {
  const topic = await resolveTopicBySlug(topicSlug);
  if (!topic) return { error: "not_found" };
  const rows = await db.select().from(sheets).where(eq(sheets.topicId, topic.id)).limit(1);
  const sheet = rows[0] ?? null;
  let revisedToday = false;
  if (sheet) {
    const rev = await db
      .select({ id: sheetRevisions.id })
      .from(sheetRevisions)
      .where(
        and(
          eq(sheetRevisions.userId, userId),
          eq(sheetRevisions.sheetId, sheet.id),
          eq(sheetRevisions.day, utcDay(now())),
        ),
      )
      .limit(1);
    revisedToday = rev.length > 0;
  }
  return {
    topic,
    sheet: sheet ? { contentMd: sheet.contentMd, version: sheet.version, updatedAt: sheet.updatedAt } : null,
    revisedToday,
  };
}

/** Admin-only publish: creates v1 or bumps the version. Cache-busting not needed (reads are live). */
export async function upsertSheet(
  adminId: string,
  topicId: string,
  contentMd: string,
): Promise<{ ok: true; version: number } | { error: "not_found" }> {
  const topic = await db.select({ id: topics.id }).from(topics).where(eq(topics.id, topicId)).limit(1);
  if (!topic[0]) return { error: "not_found" };
  const existing = await db.select().from(sheets).where(eq(sheets.topicId, topicId)).limit(1);
  if (existing[0]) {
    const version = (existing[0].version ?? 1) + 1;
    await db
      .update(sheets)
      .set({ contentMd, version, updatedAt: now(), updatedBy: adminId })
      .where(eq(sheets.id, existing[0].id));
    return { ok: true, version };
  }
  await db.insert(sheets).values({ topicId, contentMd, version: 1, updatedBy: adminId });
  return { ok: true, version: 1 };
}

/** One tick per user/sheet/day — retries collapse into the same row. */
export async function markRevised(
  userId: string,
  sheetId: string,
): Promise<{ ok: true } | { error: "not_found" }> {
  const sheet = await db.select({ id: sheets.id }).from(sheets).where(eq(sheets.id, sheetId)).limit(1);
  if (!sheet[0]) return { error: "not_found" };
  await db
    .insert(sheetRevisions)
    .values({ userId, sheetId, day: utcDay(now()) })
    .onConflictDoNothing();
  return { ok: true };
}

/**
 * Mentor revision session scoped to the sheet: topic session + the sheet
 * as a delimited, truncated system message. buildGenerationInput picks
 * stored system messages up into the system prompt.
 */
export async function startSheetQuiz(
  userId: string,
  topicId: string,
): Promise<{ sessionId: string } | { error: "not_found" | "no_sheet" }> {
  const rows = await db
    .select({ id: topics.id, name: topics.name })
    .from(topics)
    .where(eq(topics.id, topicId))
    .limit(1);
  const topic = rows[0];
  if (!topic) return { error: "not_found" };
  const sheetRows = await db.select().from(sheets).where(eq(sheets.topicId, topicId)).limit(1);
  const sheet = sheetRows[0];
  if (!sheet) return { error: "no_sheet" };

  const session = await createSession(userId, { kind: "topic", topicId }, `Sheet quiz: ${topic.name}`);
  if (!session) return { error: "not_found" };
  await db.insert(chatMessages).values({
    sessionId: session.id,
    role: "system",
    content: sheetContextBlock(topic.name, sheet.contentMd),
  });
  return { sessionId: session.id };
}

export async function listSheetsIndex(): Promise<{
  subjects: {
    slug: string;
    name: string;
    topics: { slug: string; name: string; hasSheet: boolean }[];
  }[];
}> {
  const [subjectRows, topicRows, sheetRows] = await Promise.all([
    db.select().from(subjects).orderBy(subjects.displayOrder),
    db.select().from(topics).orderBy(topics.displayOrder),
    db.select({ topicId: sheets.topicId }).from(sheets),
  ]);
  const withSheet = new Set(sheetRows.map((s) => s.topicId));
  return {
    subjects: subjectRows.map((s) => ({
      slug: s.slug,
      name: s.name,
      topics: topicRows
        .filter((t) => t.subjectId === s.id)
        .map((t) => ({ slug: t.slug, name: t.name, hasSheet: withSheet.has(t.id) })),
    })),
  };
}
