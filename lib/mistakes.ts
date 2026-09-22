import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  mistakes,
  questions,
  subjects,
  topics,
  attempts,
} from "@/db/schema";
import { clampInt } from "./time";
import type { MistakeTag } from "./validation/extension";

export type MistakeRow = {
  questionId: string;
  tag: MistakeTag | null;
  missCount: number;
  lastMissedAt: Date;
  resolved: boolean;
  resolvedAt: Date | null;
  prompt: string;
  type: "mcq" | "msq" | "nat";
  difficulty: "easy" | "medium" | "hard";
  year: number;
  marks: number;
  subject: { slug: string; name: string };
  topic: { slug: string; name: string };
  correctStreak: number;
  suggestResolve: boolean;
  practicePath: string;
};

/**
 * Upserted on every incorrect attempt. Re-missing a resolved row reopens
 * it (resolved=false, resolvedAt=null) and bumps missCount.
 */
export async function recordMiss(userId: string, questionId: string) {
  const existing = await db
    .select()
    .from(mistakes)
    .where(and(eq(mistakes.userId, userId), eq(mistakes.questionId, questionId)))
    .limit(1);
  if (existing[0]) {
    await db
      .update(mistakes)
      .set({
        missCount: (existing[0].missCount ?? 1) + 1,
        lastMissedAt: new Date(),
        resolved: false,
        resolvedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(mistakes.id, existing[0].id));
    return;
  }
  await db.insert(mistakes).values({ userId, questionId });
}

/**
 * Correct attempts never auto-resolve. Callers use correctStreak /
 * suggestResolve from listMistakes to nudge the student after two
 * correct re-attempts in a row.
 */
export async function correctStreak(userId: string, questionId: string): Promise<number> {
  const rows = await db
    .select({ isCorrect: attempts.isCorrect })
    .from(attempts)
    .where(and(eq(attempts.userId, userId), eq(attempts.questionId, questionId)))
    .orderBy(desc(attempts.submittedAt))
    .limit(2);
  let streak = 0;
  for (const r of rows) {
    if (r.isCorrect) streak += 1;
    else break;
  }
  return streak;
}

async function streaksFor(userId: string, questionIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const qid of questionIds) {
    out.set(qid, await correctStreak(userId, qid));
  }
  return out;
}

export async function listMistakes(
  userId: string,
  opts: {
    tag?: MistakeTag;
    subject?: string;
    topic?: string;
    resolved?: boolean;
    page?: number;
    limit?: number;
  } = {},
): Promise<{ data: MistakeRow[]; page: number; limit: number; total: number; totalPages: number }> {
  const limit = clampInt(opts.limit ?? 20, 1, 50);
  const page = Math.max(1, opts.page ?? 1);

  const conditions = [eq(mistakes.userId, userId)];
  if (opts.tag) conditions.push(eq(mistakes.tag, opts.tag));
  if (opts.resolved !== undefined) conditions.push(eq(mistakes.resolved, opts.resolved));

  const rows = await db
    .select({
      mistake: mistakes,
      prompt: questions.prompt,
      type: questions.type,
      difficulty: questions.difficulty,
      year: questions.year,
      marks: questions.marks,
      subjectSlug: subjects.slug,
      subjectName: subjects.name,
      topicSlug: topics.slug,
      topicName: topics.name,
      subjectId: questions.subjectId,
      topicId: questions.topicId,
    })
    .from(mistakes)
    .innerJoin(questions, eq(mistakes.questionId, questions.id))
    .innerJoin(subjects, eq(questions.subjectId, subjects.id))
    .innerJoin(topics, eq(questions.topicId, topics.id))
    .where(and(...conditions))
    .orderBy(desc(mistakes.lastMissedAt), asc(mistakes.questionId));

  let filtered = rows;
  if (opts.subject) filtered = filtered.filter((r) => r.subjectSlug === opts.subject);
  if (opts.topic) filtered = filtered.filter((r) => r.topicSlug === opts.topic);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const slice = filtered.slice((page - 1) * limit, page * limit);
  const streaks = await streaksFor(
    userId,
    slice.map((r) => r.mistake.questionId),
  );

  const data: MistakeRow[] = slice.map((r) => {
    const streak = streaks.get(r.mistake.questionId) ?? 0;
    return {
      questionId: r.mistake.questionId,
      tag: (r.mistake.tag as MistakeTag | null) ?? null,
      missCount: r.mistake.missCount,
      lastMissedAt: r.mistake.lastMissedAt,
      resolved: r.mistake.resolved,
      resolvedAt: r.mistake.resolvedAt,
      prompt: r.prompt,
      type: r.type,
      difficulty: r.difficulty,
      year: r.year,
      marks: r.marks,
      subject: { slug: r.subjectSlug, name: r.subjectName },
      topic: { slug: r.topicSlug, name: r.topicName },
      correctStreak: streak,
      suggestResolve: !r.mistake.resolved && streak >= 2,
      practicePath: `/practice/${r.mistake.questionId}`,
    };
  });

  return { data, page, limit, total, totalPages };
}

export async function setMistakeTag(
  userId: string,
  questionId: string,
  tag: MistakeTag | null,
): Promise<{ ok: true } | { error: "not_found" }> {
  const rows = await db
    .select({ id: mistakes.id })
    .from(mistakes)
    .where(and(eq(mistakes.userId, userId), eq(mistakes.questionId, questionId)))
    .limit(1);
  if (!rows[0]) return { error: "not_found" };
  await db
    .update(mistakes)
    .set({ tag: tag ?? null, updatedAt: new Date() })
    .where(eq(mistakes.id, rows[0].id));
  return { ok: true };
}

export async function setMistakeResolved(
  userId: string,
  questionId: string,
  resolved: boolean,
): Promise<{ ok: true } | { error: "not_found" }> {
  const rows = await db
    .select({ id: mistakes.id })
    .from(mistakes)
    .where(and(eq(mistakes.userId, userId), eq(mistakes.questionId, questionId)))
    .limit(1);
  if (!rows[0]) return { error: "not_found" };
  await db
    .update(mistakes)
    .set({
      resolved,
      resolvedAt: resolved ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(mistakes.id, rows[0].id));
  return { ok: true };
}

export async function getMistakeStats(userId: string): Promise<{
  open: number;
  byTag: Record<string, number>;
  bySubject: { slug: string; name: string; open: number }[];
}> {
  const rows = await db
    .select({
      tag: mistakes.tag,
      subjectSlug: subjects.slug,
      subjectName: subjects.name,
    })
    .from(mistakes)
    .innerJoin(questions, eq(mistakes.questionId, questions.id))
    .innerJoin(subjects, eq(questions.subjectId, subjects.id))
    .where(and(eq(mistakes.userId, userId), eq(mistakes.resolved, false)));

  const byTag: Record<string, number> = {};
  const bySubjectMap = new Map<string, { slug: string; name: string; open: number }>();
  for (const r of rows) {
    const tag = r.tag ?? "untagged";
    byTag[tag] = (byTag[tag] ?? 0) + 1;
    const entry = bySubjectMap.get(r.subjectSlug) ?? {
      slug: r.subjectSlug,
      name: r.subjectName,
      open: 0,
    };
    entry.open += 1;
    bySubjectMap.set(r.subjectSlug, entry);
  }
  return { open: rows.length, byTag, bySubject: [...bySubjectMap.values()] };
}
