import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { attempts, questions, subjects, topicOverrides, topics } from "@/db/schema";
import { accuracyOf } from "./recommend-rules";
import { topicStatus, type SyllabusStatus } from "./syllabus-rules";

export type SyllabusTopic = {
  slug: string;
  name: string;
  status: SyllabusStatus;
  accuracy: number | null;
  attempts: number;
  attemptedQuestions: number;
  totalQuestions: number;
  override: "skipped" | "focus" | null;
  practicePath: string;
  revisePath: string;
};

export type SyllabusSubject = {
  slug: string;
  name: string;
  status: SyllabusStatus;
  accuracy: number | null;
  attempts: number;
  attemptedQuestions: number;
  totalQuestions: number;
  topics: SyllabusTopic[];
};

export async function getSyllabus(userId: string): Promise<{
  subjects: SyllabusSubject[];
  overall: { examReadyTopics: number; totalTopics: number; pct: number };
}> {
  const subjectRows = await db.select().from(subjects).orderBy(subjects.displayOrder);
  const topicRows = await db.select().from(topics);
  const questionRows = await db
    .select({ id: questions.id, subjectId: questions.subjectId, topicId: questions.topicId })
    .from(questions)
    .where(eq(questions.isPublished, true));

  const attemptRows = await db
    .select({ questionId: attempts.questionId, isCorrect: attempts.isCorrect })
    .from(attempts)
    .where(eq(attempts.userId, userId));

  const overrideRows = await db
    .select({ topicId: topicOverrides.topicId, status: topicOverrides.status })
    .from(topicOverrides)
    .where(eq(topicOverrides.userId, userId));
  const overrideByTopic = new Map(overrideRows.map((o) => [o.topicId, o.status]));

  const questionById = new Map(questionRows.map((q) => [q.id, q]));
  const perTopic = new Map<string, { attempts: number; correct: number; seen: Set<string> }>();
  const perSubjectAgg = new Map<string, { attempts: number; correct: number; seen: Set<string> }>();
  for (const a of attemptRows) {
    const q = questionById.get(a.questionId);
    if (!q) continue;
    const entry = perTopic.get(q.topicId) ?? { attempts: 0, correct: 0, seen: new Set() };
    entry.attempts += 1;
    if (a.isCorrect) entry.correct += 1;
    entry.seen.add(q.id);
    perTopic.set(q.topicId, entry);
    const se = perSubjectAgg.get(q.subjectId) ?? { attempts: 0, correct: 0, seen: new Set() };
    se.attempts += 1;
    if (a.isCorrect) se.correct += 1;
    se.seen.add(q.id);
    perSubjectAgg.set(q.subjectId, se);
  }
  const totalByTopic = new Map<string, number>();
  const totalBySubject = new Map<string, number>();
  for (const q of questionRows) {
    totalByTopic.set(q.topicId, (totalByTopic.get(q.topicId) ?? 0) + 1);
    totalBySubject.set(q.subjectId, (totalBySubject.get(q.subjectId) ?? 0) + 1);
  }

  const subjectsOut: SyllabusSubject[] = subjectRows.map((s) => {
    const agg = perSubjectAgg.get(s.id) ?? { attempts: 0, correct: 0, seen: new Set<string>() };
    const sTotal = totalBySubject.get(s.id) ?? 0;
    const topicList: SyllabusTopic[] = topicRows
      .filter((t) => t.subjectId === s.id)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((t) => {
        const st = perTopic.get(t.id) ?? { attempts: 0, correct: 0, seen: new Set<string>() };
        const total = totalByTopic.get(t.id) ?? 0;
        return {
          slug: t.slug,
          name: t.name,
          status: topicStatus({
            attempts: st.attempts,
            correct: st.correct,
            attemptedQuestions: st.seen.size,
            totalQuestions: total,
          }),
          accuracy: accuracyOf(st.correct, st.attempts),
          attempts: st.attempts,
          attemptedQuestions: st.seen.size,
          totalQuestions: total,
          override: (overrideByTopic.get(t.id) as "skipped" | "focus" | undefined) ?? null,
          practicePath: `/practice?subject=${s.slug}&topic=${t.slug}`,
          revisePath: `/mentor?subject=${s.slug}&topic=${t.slug}`,
        };
      });

    return {
      slug: s.slug,
      name: s.name,
      status: topicStatus({
        attempts: agg.attempts,
        correct: agg.correct,
        attemptedQuestions: agg.seen.size,
        totalQuestions: sTotal,
      }),
      accuracy: accuracyOf(agg.correct, agg.attempts),
      attempts: agg.attempts,
      attemptedQuestions: agg.seen.size,
      totalQuestions: sTotal,
      topics: topicList,
    };
  });

  const allTopics = subjectsOut.flatMap((s) => s.topics);
  const examReadyTopics = allTopics.filter((t) => t.status === "exam-ready").length;
  const totalTopics = allTopics.length;
  return {
    subjects: subjectsOut,
    overall: {
      examReadyTopics,
      totalTopics,
      pct: totalTopics === 0 ? 0 : Math.round((examReadyTopics / totalTopics) * 100),
    },
  };
}

/**
 * Display-only marker (focus/skip). Never touches attempts, so stats stay
 * honest — clearing with null removes the row.
 */
export async function setTopicOverride(
  userId: string,
  topicId: string,
  status: "skipped" | "focus" | null,
): Promise<{ ok: true } | { error: "not_found" }> {
  const topic = await db.select({ id: topics.id }).from(topics).where(eq(topics.id, topicId)).limit(1);
  if (!topic[0]) return { error: "not_found" };
  if (status === null) {
    await db
      .delete(topicOverrides)
      .where(and(eq(topicOverrides.userId, userId), eq(topicOverrides.topicId, topicId)));
    return { ok: true };
  }
  const existing = await db
    .select({ id: topicOverrides.id })
    .from(topicOverrides)
    .where(and(eq(topicOverrides.userId, userId), eq(topicOverrides.topicId, topicId)))
    .limit(1);
  if (existing[0]) {
    await db
      .update(topicOverrides)
      .set({ status, updatedAt: new Date() })
      .where(eq(topicOverrides.id, existing[0].id));
  } else {
    await db.insert(topicOverrides).values({ userId, topicId, status });
  }
  return { ok: true };
}

export async function resolveTopicId(subjectSlug: string | undefined, topicSlug: string): Promise<string | null> {
  if (subjectSlug) {
    const s = await db.select({ id: subjects.id }).from(subjects).where(eq(subjects.slug, subjectSlug)).limit(1);
    if (!s[0]) return null;
    const t = await db
      .select({ id: topics.id })
      .from(topics)
      .where(and(eq(topics.subjectId, s[0].id), eq(topics.slug, topicSlug)))
      .limit(1);
    return t[0]?.id ?? null;
  }
  const rows = await db.select({ id: topics.id }).from(topics).where(eq(topics.slug, topicSlug));
  return rows.length === 1 ? rows[0]!.id : null;
}
