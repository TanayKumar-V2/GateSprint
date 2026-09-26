import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  attempts,
  bookmarks,
  questions,
  subjects,
  topics,
} from "@/db/schema";
import {
  accuracyOf,
  evaluateWeakTopic,
  pct,
  rankQuestions,
} from "./recommend-rules";
import { listImagesForQuestions } from "./imports/images";
import { buildActivity } from "./progress-activity";

export type TopicStats = {
  subjectSlug: string;
  subjectName: string;
  topicSlug: string;
  topicName: string;
  attempts: number;
  correct: number;
  accuracy: number | null;
  recentMissStreak: number;
  weak: boolean;
  weakReason: string | null;
};

export type SubjectStats = {
  slug: string;
  name: string;
  attempts: number;
  correct: number;
  accuracy: number | null;
  attemptedQuestions: number;
  totalQuestions: number;
};

export type OverallStats = {
  attempts: number;
  correct: number;
  accuracy: number | null;
  attemptedQuestions: number;
  totalQuestions: number;
};

type PublishedQuestion = {
  id: string;
  subjectId: string;
  topicId: string;
  difficulty: "easy" | "medium" | "hard";
  year: number;
  questionNumber: number | null;
  marks: number;
  prompt: string;
};

async function loadBank() {
  const subjectRows = await db
    .select()
    .from(subjects)
    .orderBy(subjects.displayOrder);
  const topicRows = await db.select().from(topics);
  const questionRows = await db
    .select({
      id: questions.id,
      subjectId: questions.subjectId,
      topicId: questions.topicId,
      difficulty: questions.difficulty,
      year: questions.year,
      questionNumber: questions.questionNumber,
      marks: questions.marks,
      prompt: questions.prompt,
    })
    .from(questions)
    .where(eq(questions.isPublished, true));
  return { subjectRows, topicRows, questionRows };
}

async function loadUserData(userId: string) {
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
  return { attemptRows, bookmarked: new Set(bookmarkRows.map((b) => b.questionId)) };
}

export async function getTopicStats(userId: string): Promise<TopicStats[]> {
  const { subjectRows, topicRows, questionRows } = await loadBank();
  const { attemptRows } = await loadUserData(userId);

  const subjectById = new Map(subjectRows.map((s) => [s.id, s]));
  const byTopic = new Map<string, { total: number; correct: number; streak: number }>();
  const seenStreakEnd = new Set<string>();

  // attemptRows are newest-first: count totals, and measure the recent
  // miss streak per topic (consecutive incorrect from the most recent).
  for (const a of attemptRows) {
    const q = questionRows.find((x) => x.id === a.questionId);
    if (!q) continue;
    const entry = byTopic.get(q.topicId) ?? { total: 0, correct: 0, streak: 0 };
    entry.total += 1;
    if (a.isCorrect) {
      entry.correct += 1;
      seenStreakEnd.add(q.topicId);
    } else if (!seenStreakEnd.has(q.topicId)) {
      entry.streak += 1;
    }
    byTopic.set(q.topicId, entry);
  }

  return topicRows.map((t) => {
    const s = subjectById.get(t.subjectId)!;
    const stat = byTopic.get(t.id) ?? { total: 0, correct: 0, streak: 0 };
    const verdict = evaluateWeakTopic({
      attempts: stat.total,
      correct: stat.correct,
      recentMissStreak: stat.streak,
    });
    return {
      subjectSlug: s.slug,
      subjectName: s.name,
      topicSlug: t.slug,
      topicName: t.name,
      attempts: stat.total,
      correct: stat.correct,
      accuracy: verdict.accuracy,
      recentMissStreak: stat.streak,
      weak: verdict.weak,
      weakReason: verdict.reason,
    };
  });
}

export async function getProgress(userId: string) {
  const { subjectRows, topicRows, questionRows } = await loadBank();
  const { attemptRows, bookmarked } = await loadUserData(userId);
  void bookmarked;

  const topicById = new Map(topicRows.map((t) => [t.id, t]));
  const subjectById = new Map(subjectRows.map((s) => [s.id, s]));

  const latestByQuestion = new Map<string, boolean>();
  for (const a of [...attemptRows].reverse()) latestByQuestion.set(a.questionId, a.isCorrect);

  const perSubject = new Map<string, { attempts: number; correct: number; attempted: Set<string> }>();
  const perTopic = new Map<string, { attempts: number; correct: number; attempted: Set<string> }>();
  for (const a of attemptRows) {
    const q = questionRows.find((x) => x.id === a.questionId);
    if (!q) continue;
    const s = perSubject.get(q.subjectId) ?? { attempts: 0, correct: 0, attempted: new Set() };
    s.attempts += 1;
    if (a.isCorrect) s.correct += 1;
    s.attempted.add(q.id);
    perSubject.set(q.subjectId, s);
    const t = perTopic.get(q.topicId) ?? { attempts: 0, correct: 0, attempted: new Set() };
    t.attempts += 1;
    if (a.isCorrect) t.correct += 1;
    t.attempted.add(q.id);
    perTopic.set(q.topicId, t);
  }

  const questionsBySubject = new Map<string, number>();
  const questionsByTopic = new Map<string, number>();
  for (const q of questionRows) {
    questionsBySubject.set(q.subjectId, (questionsBySubject.get(q.subjectId) ?? 0) + 1);
    questionsByTopic.set(q.topicId, (questionsByTopic.get(q.topicId) ?? 0) + 1);
  }

  const topicStats = await getTopicStats(userId);
  const weakTopics = topicStats.filter((t) => t.weak);

  const subjectsOut: SubjectStats[] = subjectRows.map((s) => {
    const st = perSubject.get(s.id) ?? { attempts: 0, correct: 0, attempted: new Set() };
    return {
      slug: s.slug,
      name: s.name,
      attempts: st.attempts,
      correct: st.correct,
      accuracy: accuracyOf(st.correct, st.attempts),
      attemptedQuestions: st.attempted.size,
      totalQuestions: questionsBySubject.get(s.id) ?? 0,
    };
  });

  const topicsOut = topicStats.map((t) => {
    const row = topicRows.find((x) => x.slug === t.topicSlug)!;
    return { ...t, totalQuestions: questionsByTopic.get(row.id) ?? 0 };
  });

  const totalAttempts = attemptRows.length;
  const totalCorrect = attemptRows.filter((a) => a.isCorrect).length;

  const overall: OverallStats = {
    attempts: totalAttempts,
    correct: totalCorrect,
    accuracy: accuracyOf(totalCorrect, totalAttempts),
    attemptedQuestions: latestByQuestion.size,
    totalQuestions: questionRows.length,
  };

  return { overall, subjects: subjectsOut, topics: topicsOut, weakTopics, topicById, subjectById, activity: buildActivity(attemptRows) };
}

export type Recommendation = {
  questionId: string;
  subject: { slug: string; name: string };
  topic: { slug: string; name: string };
  difficulty: PublishedQuestion["difficulty"];
  year: number;
  marks: number;
  prompt: string;
  reason: string;
  practicePath: string;
  revisePath: string;
};

export async function getRecommendations(
  userId: string,
  opts: {
    subject?: string;
    topic?: string;
    difficulty?: PublishedQuestion["difficulty"];
    limit?: number;
    page?: number;
  } = {},
): Promise<{
  data: Recommendation[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  note: string | null;
}> {
  const limit = Math.min(Math.max(opts.limit ?? 10, 1), 25);
  const page = Math.max(opts.page ?? 1, 1);

  const { subjectRows, topicRows, questionRows } = await loadBank();
  const { attemptRows, bookmarked } = await loadUserData(userId);
  const topicStats = await getTopicStats(userId);

  const subjectById = new Map(subjectRows.map((s) => [s.id, s]));
  const topicById = new Map(topicRows.map((t) => [t.id, t]));

  const latestByQuestion = new Map<string, boolean>();
  for (const a of [...attemptRows].reverse()) latestByQuestion.set(a.questionId, a.isCorrect);

  const inScope = (q: PublishedQuestion) => {
    const t = topicById.get(q.topicId)!;
    const s = subjectById.get(q.subjectId)!;
    if (opts.subject && s.slug !== opts.subject) return false;
    if (opts.topic && t.slug !== opts.topic) return false;
    if (opts.difficulty && q.difficulty !== opts.difficulty) return false;
    return true;
  };

  const toRec = (
    q: PublishedQuestion,
    reason: string,
  ): Recommendation => {
    const t = topicById.get(q.topicId)!;
    const s = subjectById.get(q.subjectId)!;
    return {
      questionId: q.id,
      subject: { slug: s.slug, name: s.name },
      topic: { slug: t.slug, name: t.name },
      difficulty: q.difficulty,
      year: q.year,
      marks: q.marks,
      prompt: q.prompt,
      reason,
      practicePath: `/practice/${q.id}`,
      revisePath: `/mentor?subject=${s.slug}&topic=${t.slug}`,
    };
  };

  const emitted = new Set<string>();
  const out: Recommendation[] = [];
  const push = (q: PublishedQuestion, reason: string) => {
    if (emitted.has(q.id)) return;
    emitted.add(q.id);
    out.push(toRec(q, reason));
  };

  const byTopicId = new Map<string, PublishedQuestion[]>();
  for (const q of questionRows) {
    if (!inScope(q)) continue;
    const list = byTopicId.get(q.topicId) ?? [];
    list.push(q);
    byTopicId.set(q.topicId, list);
  }
  const order = (list: PublishedQuestion[]) => rankQuestions(list);

  // Weak topics first, worst accuracy at the top.
  const weak = topicStats
    .filter((t) => t.weak)
    .filter((t) => {
    const subject = subjectRows.find((s) => s.slug === t.subjectSlug)!;
    const row = topicRows.find((x) => x.slug === t.topicSlug && x.subjectId === subject.id)!;
      if (opts.subject && t.subjectSlug !== opts.subject) return false;
      if (opts.topic && t.topicSlug !== opts.topic) return false;
      return (byTopicId.get(row.id)?.length ?? 0) > 0;
    })
    .sort(
      (a, b) =>
        (a.accuracy ?? 1) - (b.accuracy ?? 1) || b.attempts - a.attempts,
    );

  for (const wt of weak) {
    const row = topicRows.find((x) => x.slug === wt.topicSlug)!;
    const pool = order(byTopicId.get(row.id) ?? []);
    const unattempted = pool.filter((q) => !latestByQuestion.has(q.id));
    const missed = pool.filter((q) => latestByQuestion.get(q.id) === false);
    const acc = pct(wt.accuracy);
    // Easier reinforcement first; harder questions join once the easy
    // and medium ones are done.
    const gentle = unattempted.filter((q) => q.difficulty !== "hard");
    const hardLeftovers = unattempted.filter((q) => q.difficulty === "hard");
    for (const q of gentle)
      push(q, `${acc} accuracy in ${wt.topicName} — not tried yet`);
    for (const q of missed)
      push(q, `Missed recently in ${wt.topicName} — worth another look`);
    for (const q of hardLeftovers)
      push(q, `${acc} accuracy in ${wt.topicName} — ready for a harder one`);
    // Saved questions in a weak topic resurface even if attempted.
    for (const q of pool) {
      if (bookmarked.has(q.id) && latestByQuestion.get(q.id) !== true)
        push(q, `Saved by you · ${wt.topicName} still needs work`);
    }
  }

  let note: string | null = null;
  if (out.length === 0) {
    if (attemptRows.length === 0) {
      // Starter fallback: easy, unattempted questions in scope — never a
      // fake weak topic.
      const pool = order(
        questionRows.filter(
          (q) =>
            inScope(q) &&
            q.difficulty === "easy" &&
            !latestByQuestion.has(q.id),
        ),
      ).slice(0, limit);
      for (const q of pool) {
        const t = topicById.get(q.topicId)!;
        push(q, `Good place to start in ${t.name}`);
      }
      note = "Solve a few to unlock personal recommendations.";
    } else {
      note = "All caught up — everything attempted is correct. Try a new subject.";
    }
  }

  const total = out.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const data = out.slice((page - 1) * limit, page * limit);
  return { data, page, limit, total, totalPages, note };
}

export async function listBookmarks(userId: string) {
  const { subjectRows, topicRows } = await loadBank();
  const subjectById = new Map(subjectRows.map((s) => [s.id, s]));
  const topicById = new Map(topicRows.map((t) => [t.id, t]));

  const rows = await db
    .select({
      id: questions.id,
      year: questions.year,
      questionNumber: questions.questionNumber,
      type: questions.type,
      difficulty: questions.difficulty,
      prompt: questions.prompt,
      options: questions.options,
      marks: questions.marks,
      negativeMarks: questions.negativeMarks,
      sourceLabel: questions.sourceLabel,
      subjectId: questions.subjectId,
      topicId: questions.topicId,
      savedAt: bookmarks.createdAt,
    })
    .from(bookmarks)
    .innerJoin(questions, eq(bookmarks.questionId, questions.id))
    .where(
      and(eq(bookmarks.userId, userId), eq(questions.isPublished, true)),
    )
    .orderBy(desc(bookmarks.createdAt));

  const imageMap = await listImagesForQuestions(rows.map((r) => r.id));

  return rows.map((r) => ({
    id: r.id,
    year: r.year,
    questionNumber: r.questionNumber,
    type: r.type,
    difficulty: r.difficulty,
    prompt: r.prompt,
    options: r.options,
    marks: r.marks,
    negativeMarks: r.negativeMarks,
    sourceLabel: r.sourceLabel,
    subject: {
      slug: subjectById.get(r.subjectId)!.slug,
      name: subjectById.get(r.subjectId)!.name,
    },
    topic: {
      slug: topicById.get(r.topicId)!.slug,
      name: topicById.get(r.topicId)!.name,
    },
    attempted: false,
    bookmarked: true as const,
    images: imageMap.get(r.id) ?? [],
  }));
}
