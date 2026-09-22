import "server-only";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { attempts, questions, subjects, topics } from "@/db/schema";
import {
  classifyAttempt,
  summarize,
  type Aggregate,
  type TimeFlag,
} from "./time-analytics-rules";

export type TimeBySubject = {
  subjectSlug: string;
  subjectName: string;
  avgSeconds: number | null;
  medianSeconds: number | null;
  attempts: number;
};

export type TimeByTopic = {
  subjectSlug: string;
  topicSlug: string;
  topicName: string;
  avgSeconds: number | null;
  medianSeconds: number | null;
  attempts: number;
};

export type FlaggedAttempt = {
  questionId: string;
  prompt: string;
  subjectSlug: string;
  topicSlug: string;
  yourSeconds: number;
  medianSeconds: number | null;
  peerCount: number;
  isCorrect: boolean;
  flag: TimeFlag;
  practicePath: string;
};

/**
 * Global anonymized per-question timing. Returns aggregates only
 * ({ median, p90, n }) — never another user's rows.
 */
export async function getQuestionMedians(
  questionIds: string[],
): Promise<Map<string, { median: number | null; p90: number | null; n: number }>> {
  const out = new Map<string, { median: number | null; p90: number | null; n: number }>();
  const unique = [...new Set(questionIds)];
  if (unique.length === 0) return out;
  const byQ = new Map<string, number[]>();
  const BATCH = 200;
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    const rows = await db
      .select({ questionId: attempts.questionId, timeTakenSeconds: attempts.timeTakenSeconds })
      .from(attempts)
      .where(and(inArray(attempts.questionId, batch), isNotNull(attempts.timeTakenSeconds)));
    for (const r of rows) {
      if (typeof r.timeTakenSeconds !== "number") continue;
      const list = byQ.get(r.questionId) ?? [];
      list.push(r.timeTakenSeconds);
      byQ.set(r.questionId, list);
    }
  }
  for (const qid of unique) {
    const s: Aggregate = summarize(byQ.get(qid) ?? []);
    out.set(qid, { median: s.median, p90: s.p90, n: s.n });
  }
  return out;
}

async function loadTimedAttempts(userId: string) {
  return db
    .select({
      questionId: attempts.questionId,
      isCorrect: attempts.isCorrect,
      timeTakenSeconds: attempts.timeTakenSeconds,
      submittedAt: attempts.submittedAt,
      prompt: questions.prompt,
      subjectId: questions.subjectId,
      subjectSlug: subjects.slug,
      subjectName: subjects.name,
      topicId: questions.topicId,
      topicSlug: topics.slug,
      topicName: topics.name,
    })
    .from(attempts)
    .innerJoin(questions, eq(attempts.questionId, questions.id))
    .innerJoin(subjects, eq(questions.subjectId, subjects.id))
    .innerJoin(topics, eq(questions.topicId, topics.id))
    .where(eq(attempts.userId, userId))
    .orderBy(desc(attempts.submittedAt));
}

export async function getTimeBySubject(userId: string, subjectFilter?: string): Promise<TimeBySubject[]> {
  const rows = await loadTimedAttempts(userId);
  const bySubject = new Map<string, { name: string; times: number[] }>();
  for (const r of rows) {
    if (r.timeTakenSeconds === null || r.timeTakenSeconds === undefined) continue;
    if (subjectFilter && r.subjectSlug !== subjectFilter) continue;
    const entry = bySubject.get(r.subjectSlug) ?? { name: r.subjectName, times: [] };
    entry.times.push(r.timeTakenSeconds);
    bySubject.set(r.subjectSlug, entry);
  }
  return [...bySubject.entries()].map(([slug, v]) => {
    const s = summarize(v.times);
    return {
      subjectSlug: slug,
      subjectName: v.name,
      avgSeconds: s.avg,
      medianSeconds: s.median,
      attempts: s.n,
    };
  });
}

export async function getTimeByTopic(userId: string, subjectFilter?: string): Promise<TimeByTopic[]> {
  const rows = await loadTimedAttempts(userId);
  const byTopic = new Map<string, { subjectSlug: string; name: string; times: number[] }>();
  for (const r of rows) {
    if (r.timeTakenSeconds === null || r.timeTakenSeconds === undefined) continue;
    if (subjectFilter && r.subjectSlug !== subjectFilter) continue;
    const key = `${r.subjectSlug}/${r.topicSlug}`;
    const entry = byTopic.get(key) ?? { subjectSlug: r.subjectSlug, name: r.topicName, times: [] };
    entry.times.push(r.timeTakenSeconds);
    byTopic.set(key, entry);
  }
  return [...byTopic.entries()].map(([key, v]) => {
    const [subjectSlug, topicSlug] = key.split("/");
    const s = summarize(v.times);
    return {
      subjectSlug: subjectSlug!,
      topicSlug: topicSlug!,
      topicName: v.name,
      avgSeconds: s.avg,
      medianSeconds: s.median,
      attempts: s.n,
    };
  });
}

export async function flagAttempts(
  userId: string,
  opts: { limit?: number; subject?: string } = {},
): Promise<FlaggedAttempt[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
  const rows = (await loadTimedAttempts(userId)).filter(
    (r) => typeof r.timeTakenSeconds === "number",
  );
  const scoped = opts.subject ? rows.filter((r) => r.subjectSlug === opts.subject) : rows;
  const slice = scoped.slice(0, limit);
  const medians = await getQuestionMedians(slice.map((r) => r.questionId));
  return slice.map((r) => {
    const m = medians.get(r.questionId);
    const flag = classifyAttempt({
      yourSeconds: r.timeTakenSeconds as number,
      medianSeconds: m?.median ?? null,
      isCorrect: r.isCorrect,
    });
    return {
      questionId: r.questionId,
      prompt: r.prompt,
      subjectSlug: r.subjectSlug,
      topicSlug: r.topicSlug,
      yourSeconds: r.timeTakenSeconds as number,
      medianSeconds: m?.median ?? null,
      peerCount: m?.n ?? 0,
      isCorrect: r.isCorrect,
      flag,
      practicePath: `/practice/${r.questionId}`,
    };
  });
}

export async function getTimeAnalytics(userId: string, opts: { subject?: string } = {}) {
  const [bySubject, byTopic, flags] = await Promise.all([
    getTimeBySubject(userId, opts.subject),
    getTimeByTopic(userId, opts.subject),
    flagAttempts(userId, { subject: opts.subject }),
  ]);
  return { bySubject, byTopic, flags };
}
