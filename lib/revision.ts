import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { attempts, bookmarks, mistakes, questions, subjects, topics } from "@/db/schema";
import { clampInt, daysBetween, now } from "./time";
import { dueReason, nextDueAt } from "./revision-rules";

export { dueReason, nextDueAt };

export type RevisionItem = {
  questionId: string;
  prompt: string;
  subject: { slug: string; name: string };
  topic: { slug: string; name: string };
  difficulty: "easy" | "medium" | "hard";
  year: number;
  marks: number;
  reason: string;
  dueAt: Date;
  overdueDays: number;
  practicePath: string;
  revisePath: string;
};

type Activity = {
  questionId: string;
  lastAttemptAt: Date | null;
  lastIsCorrect: boolean | null;
  attempts: number;
  bookmarked: boolean;
  mistakeOpen: boolean;
  missCount: number;
  lastMissedAt: Date | null;
};

export async function getDueRevisions(
  userId: string,
  opts: { limit?: number; page?: number; reference?: Date } = {},
): Promise<{
  due: RevisionItem[];
  upcoming: RevisionItem[];
  stats: { dueCount: number; doneToday: number; weekDone: number };
  note: string | null;
}> {
  const limit = clampInt(opts.limit ?? 20, 1, 50);
  const page = Math.max(1, opts.page ?? 1);
  const ref = opts.reference ?? now();

  const attemptRows = await db
    .select({
      questionId: attempts.questionId,
      isCorrect: attempts.isCorrect,
      submittedAt: attempts.submittedAt,
    })
    .from(attempts)
    .where(eq(attempts.userId, userId))
    .orderBy(desc(attempts.submittedAt));

  const bookmarkRows = await db
    .select({ questionId: bookmarks.questionId })
    .from(bookmarks)
    .where(eq(bookmarks.userId, userId));
  const bookmarked = new Set(bookmarkRows.map((b) => b.questionId));

  const mistakeRows = await db
    .select({
      questionId: mistakes.questionId,
      missCount: mistakes.missCount,
      lastMissedAt: mistakes.lastMissedAt,
      resolved: mistakes.resolved,
    })
    .from(mistakes)
    .where(eq(mistakes.userId, userId));

  const activity = new Map<string, Activity>();
  for (const a of attemptRows) {
    const entry = activity.get(a.questionId) ?? {
      questionId: a.questionId,
      lastAttemptAt: null,
      lastIsCorrect: null,
      attempts: 0,
      bookmarked: false,
      mistakeOpen: false,
      missCount: 0,
      lastMissedAt: null,
    };
    // Rows are newest-first: first sighting is the latest attempt.
    if (entry.lastAttemptAt === null) {
      entry.lastAttemptAt = a.submittedAt;
      entry.lastIsCorrect = a.isCorrect;
    }
    entry.attempts += 1;
    activity.set(a.questionId, entry);
  }
  for (const qid of bookmarked) {
    const entry = activity.get(qid) ?? {
      questionId: qid,
      lastAttemptAt: null,
      lastIsCorrect: null,
      attempts: 0,
      bookmarked: true,
      mistakeOpen: false,
      missCount: 0,
      lastMissedAt: null,
    };
    entry.bookmarked = true;
    activity.set(qid, entry);
  }
  for (const m of mistakeRows) {
    if (m.resolved) continue;
    const entry = activity.get(m.questionId) ?? {
      questionId: m.questionId,
      lastAttemptAt: null,
      lastIsCorrect: null,
      attempts: 0,
      bookmarked: false,
      mistakeOpen: true,
      missCount: 0,
      lastMissedAt: null,
    };
    entry.mistakeOpen = true;
    entry.missCount = m.missCount;
    entry.lastMissedAt = m.lastMissedAt;
    activity.set(m.questionId, entry);
  }

  if (activity.size === 0) {
    return {
      due: [],
      upcoming: [],
      stats: { dueCount: 0, doneToday: 0, weekDone: 0 },
      note: "Solve a few questions to build your revision queue.",
    };
  }

  const questionRows = await db
    .select({
      id: questions.id,
      prompt: questions.prompt,
      difficulty: questions.difficulty,
      year: questions.year,
      marks: questions.marks,
      subjectSlug: subjects.slug,
      subjectName: subjects.name,
      topicSlug: topics.slug,
      topicName: topics.name,
    })
    .from(questions)
    .innerJoin(subjects, eq(questions.subjectId, subjects.id))
    .innerJoin(topics, eq(questions.topicId, topics.id))
    .where(eq(questions.isPublished, true));
  const bankById = new Map(questionRows.map((q) => [q.id, q]));

  const items: RevisionItem[] = [];
  for (const act of activity.values()) {
    const q = bankById.get(act.questionId);
    if (!q) continue;
    const anchor = act.lastMissedAt ?? act.lastAttemptAt;
    if (!anchor) continue;
    const lastActivity = act.mistakeOpen && act.lastMissedAt ? act.lastMissedAt : act.lastAttemptAt!;
    const dueAt = nextDueAt({
      lastActivityAt: lastActivity,
      isCorrect: act.lastIsCorrect,
      missCount: act.missCount || 1,
      bookmarked: act.bookmarked,
      mistakeOpen: act.mistakeOpen,
    });
    const reason = dueReason({
      missCount: act.missCount || 1,
      mistakeOpen: act.mistakeOpen,
      bookmarked: act.bookmarked,
      isCorrect: act.lastIsCorrect,
      lastActivityAt: lastActivity,
      reference: ref,
    });
    items.push({
      questionId: q.id,
      prompt: q.prompt,
      subject: { slug: q.subjectSlug, name: q.subjectName },
      topic: { slug: q.topicSlug, name: q.topicName },
      difficulty: q.difficulty,
      year: q.year,
      marks: q.marks,
      reason,
      dueAt,
      overdueDays: Math.max(0, daysBetween(dueAt, ref)),
      practicePath: `/practice/${q.id}`,
      revisePath: `/mentor?subject=${q.subjectSlug}&topic=${q.topicSlug}`,
    });
  }

  // Dedupe by question (one row each) and sort most-overdue first.
  const seen = new Set<string>();
  const deduped = items.filter((i) => {
    if (seen.has(i.questionId)) return false;
    seen.add(i.questionId);
    return true;
  });
  const dueAll = deduped
    .filter((i) => i.dueAt.getTime() <= ref.getTime())
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  const upcomingAll = deduped
    .filter((i) => i.dueAt.getTime() > ref.getTime())
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());

  const start = (page - 1) * limit;
  const due = dueAll.slice(start, start + limit);

  const dayStart = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));
  const weekStart = new Date(dayStart.getTime() - 6 * 86_400_000);
  const doneTodayRows = await db
    .select({ id: attempts.id })
    .from(attempts)
    .where(and(eq(attempts.userId, userId), gte(attempts.submittedAt, dayStart)));
  const weekRows = await db
    .select({ id: attempts.id })
    .from(attempts)
    .where(and(eq(attempts.userId, userId), gte(attempts.submittedAt, weekStart)));
  void sql;

  return {
    due,
    upcoming: upcomingAll.slice(0, limit),
    stats: {
      dueCount: dueAll.length,
      doneToday: doneTodayRows.length,
      weekDone: weekRows.length,
    },
    note: dueAll.length === 0 ? "All caught up — nothing due today." : null,
  };
}

export async function getRevisionStats(userId: string, reference?: Date) {
  const { stats } = await getDueRevisions(userId, { limit: 1, page: 1, reference });
  return stats;
}
