import "server-only";
import { and, count, desc, eq, inArray, isNotNull, lt } from "drizzle-orm";
import { db } from "@/db";
import {
  attempts,
  mockSessionItems,
  mockSessions,
  questions,
  subjects,
  topics,
  type MockSessionConfig,
} from "@/db/schema";
import {
  gradeMcq,
  gradeMsq,
  gradeNat,
  type SubmittedAnswer,
} from "./validation/answers";
import {
  computeMockScore,
  isSessionExpired,
  paletteStatus,
  stripQuestionForRunner,
} from "./mocks-rules";
import {
  BUILDER_MIN_QUESTIONS,
  FULL_MOCK_MARKS,
  FULL_MOCK_QUESTIONS,
  FULL_MOCK_SECONDS,
  hashSeed,
  sampleQuestions,
  scaleDuration,
} from "./test-builder-rules";
import { suggestTime } from "./test-builder-rules";
import { clampInt, now } from "./time";
import { recordMiss } from "./mistakes";
import { listImagesForQuestions, type ImageMeta } from "./imports/images";
import { readSolution } from "./solutions";
import type { CorrectAnswer } from "@/db/schema";

export type MockType = "full" | "sectional" | "pyq_year";

export type CreateMockInput = {
  type: MockType;
  mode?: "full" | "custom" | "pyq";
  subjectSlugs?: string[];
  topicSlugs?: string[];
  difficulty?: "easy" | "medium" | "hard";
  questionType?: "mcq" | "msq" | "nat";
  year?: number;
  totalQuestions?: number;
  durationSeconds?: number;
};

export type PoolFilters = {
  subjectSlugs?: string[];
  topicSlugs?: string[];
  difficulty?: "easy" | "medium" | "hard";
  questionType?: "mcq" | "msq" | "nat";
  year?: number;
};

type PoolRow = {
  id: string;
  subjectId: string;
  topicId: string;
  type: "mcq" | "msq" | "nat";
  difficulty: "easy" | "medium" | "hard";
  year: number;
  questionNumber: number | null;
  marks: number;
};

function normalizeAnswer(answer: SubmittedAnswer): unknown {
  if ("optionId" in answer) return { optionId: answer.optionId.trim() };
  if ("optionIds" in answer)
    return { optionIds: [...new Set(answer.optionIds.map((s) => s.trim()))].sort() };
  return { value: answer.value };
}

function gradeWithKey(
  type: "mcq" | "msq" | "nat",
  answer: SubmittedAnswer,
  key: CorrectAnswer,
): boolean | null {
  if (type === "mcq" && "optionId" in answer && key.kind === "mcq")
    return gradeMcq(answer.optionId, key.optionId);
  if (type === "msq" && "optionIds" in answer && key.kind === "msq")
    return gradeMsq(answer.optionIds, key.optionIds);
  if (type === "nat" && "value" in answer && key.kind === "nat")
    return gradeNat(answer.value, key.value, key.tolerance);
  return null;
}

function shapeError(
  type: "mcq" | "msq" | "nat",
  answer: SubmittedAnswer,
  options: { id: string }[] | null,
): string | null {
  if (type === "mcq") {
    if (!("optionId" in answer)) return "This question needs one option.";
    if (!options?.some((o) => o.id === answer.optionId.trim())) return "Unknown option.";
  } else if (type === "msq") {
    if (!("optionIds" in answer)) return "This question needs a set of options.";
    const known = new Set((options ?? []).map((o) => o.id));
    const picked = answer.optionIds.map((s) => s.trim());
    if (picked.length === 0 || !picked.every((id) => known.has(id)))
      return "Unknown option selected.";
  } else if (!("value" in answer) || !Number.isFinite(answer.value)) {
    return "This question needs a number.";
  }
  return null;
}

/**
 * Mockable pool: published questions WITH a cached correctAnswer. Grading
 * mid-exam must be instant — never an AI call — so key-less questions stay
 * out. Practice attempts AI-grade and cache keys, growing this pool.
 */
export async function getMockablePool(filters: PoolFilters): Promise<PoolRow[]> {
  const conditions = [eq(questions.isPublished, true), isNotNull(questions.correctAnswer)];
  if (filters.difficulty) conditions.push(eq(questions.difficulty, filters.difficulty));
  if (filters.questionType) conditions.push(eq(questions.type, filters.questionType));
  if (filters.year !== undefined) conditions.push(eq(questions.year, filters.year));

  if (filters.subjectSlugs?.length) {
    const sRows = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(inArray(subjects.slug, filters.subjectSlugs));
    if (sRows.length === 0) return [];
    const sIds = sRows.map((r) => r.id);
    conditions.push(inArray(questions.subjectId, sIds));
    if (filters.topicSlugs?.length) {
      const tRows = await db
        .select({ id: topics.id })
        .from(topics)
        .where(and(inArray(topics.slug, filters.topicSlugs), inArray(topics.subjectId, sIds)));
      if (tRows.length === 0) return [];
      conditions.push(inArray(questions.topicId, tRows.map((r) => r.id)));
    }
  } else if (filters.topicSlugs?.length) {
    const tRows = await db
      .select({ id: topics.id })
      .from(topics)
      .where(inArray(topics.slug, filters.topicSlugs));
    if (tRows.length === 0) return [];
    conditions.push(inArray(questions.topicId, tRows.map((r) => r.id)));
  }

  return db
    .select({
      id: questions.id,
      subjectId: questions.subjectId,
      topicId: questions.topicId,
      type: questions.type,
      difficulty: questions.difficulty,
      year: questions.year,
      questionNumber: questions.questionNumber,
      marks: questions.marks,
    })
    .from(questions)
    .where(and(...conditions));
}

async function recentQuestionIds(userId: string): Promise<Set<string>> {
  const rows = await db
    .select({ config: mockSessions.config })
    .from(mockSessions)
    .where(eq(mockSessions.userId, userId))
    .orderBy(desc(mockSessions.createdAt))
    .limit(3);
  const ids = new Set<string>();
  for (const r of rows) for (const qid of r.config?.questionIds ?? []) ids.add(qid);
  return ids;
}

export async function createMockSession(
  userId: string,
  input: CreateMockInput,
): Promise<
  | { sessionId: string; endsAt: Date }
  | { error: "validation"; message: string; available?: number }
> {
  if (input.type === "sectional" && !input.subjectSlugs?.length && !input.topicSlugs?.length) {
    return { error: "validation", message: "Pick at least one subject or topic for a sectional." };
  }
  if (input.type === "pyq_year" && input.year === undefined) {
    return { error: "validation", message: "Pick a year for a PYQ paper." };
  }

  const pool = await getMockablePool({
    subjectSlugs: input.subjectSlugs,
    topicSlugs: input.topicSlugs,
    difficulty: input.difficulty,
    questionType: input.questionType,
    year: input.type === "pyq_year" ? input.year : undefined,
  });

  const minNeeded = BUILDER_MIN_QUESTIONS;
  if (pool.length < minNeeded) {
    return {
      error: "validation",
      message: `Only ${pool.length} graded questions match — practice more to unlock mocks (attempts verify answer keys).`,
      available: pool.length,
    };
  }

  let count: number;
  if (input.totalQuestions !== undefined) {
    if (pool.length < input.totalQuestions) {
      return {
        error: "validation",
        message: `Only ${pool.length} graded questions match — asked for ${input.totalQuestions}.`,
        available: pool.length,
      };
    }
    count = input.totalQuestions;
  } else if (input.type === "full") {
    count = Math.min(FULL_MOCK_QUESTIONS, pool.length);
  } else if (input.type === "pyq_year") {
    count = pool.length;
  } else {
    count = Math.min(25, pool.length);
  }

  const exclude = await recentQuestionIds(userId);
  const seed = (hashSeed(`${userId}:${Date.now()}`) + Math.floor(Math.random() * 1e9)) >>> 0;
  const picked = sampleQuestions(pool, count, { excludeIds: exclude, seed });
  if (!picked) {
    return { error: "validation", message: "Pool exhausted — try fewer questions.", available: pool.length };
  }

  const mix = { mcq: 0, msq: 0, nat: 0 };
  for (const q of picked) mix[q.type] += 1;
  const duration =
    input.durationSeconds ??
    (input.type === "full" && count === FULL_MOCK_QUESTIONS
      ? FULL_MOCK_SECONDS
      : input.type === "pyq_year" || input.type === "full"
        ? scaleDuration(count)
        : suggestTime(count, mix));

  const totalMarks = picked.reduce((n, q) => n + q.marks, 0);
  const started = now();
  const endsAt = new Date(started.getTime() + duration * 1000);
  const mode = input.mode ?? (input.type === "full" ? "full" : input.type === "pyq_year" ? "pyq" : "custom");
  const title =
    input.type === "full"
      ? `Full Mock · ${count}Q`
      : input.type === "pyq_year"
        ? `GATE ${input.year} Paper · ${count}Q`
        : `Sectional · ${count}Q`;
  const config: MockSessionConfig = {
    mode,
    subjectSlugs: input.subjectSlugs,
    topicSlugs: input.topicSlugs,
    year: input.year,
    difficulty: input.difficulty,
    type: input.questionType,
    timePolicy: { durationSeconds: duration, suggested: input.durationSeconds === undefined },
    seed,
    questionIds: picked.map((q) => q.id),
  };

  const inserted = await db
    .insert(mockSessions)
    .values({
      userId,
      type: input.type,
      title,
      totalMarks,
      durationSeconds: duration,
      startedAt: started,
      endsAt,
      config,
    })
    .returning();
  const session = inserted[0]!;
  await db.insert(mockSessionItems).values(
    picked.map((q, i) => ({ sessionId: session.id, questionId: q.id, position: i })),
  );
  return { sessionId: session.id, endsAt };
}

type SessionRow = typeof mockSessions.$inferSelect;

async function findOwnedSession(userId: string, sessionId: string): Promise<SessionRow | null> {
  const rows = await db
    .select()
    .from(mockSessions)
    .where(and(eq(mockSessions.id, sessionId), eq(mockSessions.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export type RunnerItem = {
  itemId: string;
  position: number;
  status: string;
  selectedAnswer: unknown;
  timeTakenSeconds: number;
  markedForReview: boolean;
  question: {
    id: string;
    prompt: string;
    options: { id: string; text: string }[] | null;
    type: "mcq" | "msq" | "nat";
    difficulty: "easy" | "medium" | "hard";
    marks: number;
    negativeMarks: number;
    year: number;
    subject: { slug: string; name: string };
    topic: { slug: string; name: string };
    images: ImageMeta[];
  };
};

export type MockRunnerPayload = {
  state: "running";
  meta: {
    sessionId: string;
    title: string;
    type: MockType;
    durationSeconds: number;
    startedAt: Date;
    endsAt: Date;
    totalMarks: number;
    questionCount: number;
  };
  items: RunnerItem[];
  answeredCount: number;
  currentScore: number;
};

export type MockResultItem = RunnerItem & {
  isCorrect: boolean | null;
  correctAnswer: unknown;
  solution: string | null;
  practicePath: string;
};

export type MockResultPayload = {
  state: "finished";
  meta: {
    sessionId: string;
    title: string;
    type: MockType;
    status: "submitted" | "expired" | "abandoned";
    score: number;
    totalMarks: number;
    correct: number;
    incorrect: number;
    skipped: number;
    accuracy: number | null;
    submittedAt: Date | null;
  };
  subjectSplit: { slug: string; name: string; score: number; total: number; correct: number; attempts: number }[];
  items: MockResultItem[];
};

async function loadItems(sessionId: string) {
  return db
    .select({
      item: mockSessionItems,
      qid: questions.id,
      prompt: questions.prompt,
      options: questions.options,
      qtype: questions.type,
      difficulty: questions.difficulty,
      marks: questions.marks,
      negativeMarks: questions.negativeMarks,
      year: questions.year,
      correctAnswer: questions.correctAnswer,
      subjectSlug: subjects.slug,
      subjectName: subjects.name,
      topicSlug: topics.slug,
      topicName: topics.name,
    })
    .from(mockSessionItems)
    .innerJoin(questions, eq(mockSessionItems.questionId, questions.id))
    .innerJoin(subjects, eq(questions.subjectId, subjects.id))
    .innerJoin(topics, eq(questions.topicId, topics.id))
    .where(eq(mockSessionItems.sessionId, sessionId))
    .orderBy(mockSessionItems.position);
}

function liveScore(rows: { marks: number; negativeMarks: number; isCorrect: boolean | null }[]): number {
  return computeMockScore(
    rows.map((r) => ({ marks: r.marks, negativeMarks: r.negativeMarks, isCorrect: r.isCorrect })),
  ).score;
}

export async function getMockSession(
  userId: string,
  sessionId: string,
): Promise<MockRunnerPayload | MockResultPayload | { error: "not_found" }> {
  let session = await findOwnedSession(userId, sessionId);
  if (!session) return { error: "not_found" };
  if (session.status === "in_progress" && isSessionExpired(session.endsAt, now())) {
    session = await finishInternal(session);
  }
  if (session.status === "in_progress") {
    const rows = await loadItems(session.id);
    const imageMap = await listImagesForQuestions(rows.map((r) => r.qid));
    const items: RunnerItem[] = rows.map((r) => ({
      itemId: r.item.id,
      position: r.item.position,
      status: r.item.status,
      selectedAnswer: r.item.selectedAnswer,
      timeTakenSeconds: r.item.timeTakenSeconds,
      markedForReview: r.item.markedForReview,
      question: stripQuestionForRunner({
        id: r.qid,
        prompt: r.prompt,
        options: r.options,
        type: r.qtype,
        difficulty: r.difficulty,
        marks: r.marks,
        negativeMarks: r.negativeMarks,
        year: r.year,
        correctAnswer: r.correctAnswer,
        solution: null,
        subject: { slug: r.subjectSlug, name: r.subjectName },
        topic: { slug: r.topicSlug, name: r.topicName },
        images: imageMap.get(r.qid) ?? [],
      }),
    }));
    const answeredCount = rows.filter((r) => r.item.selectedAnswer !== null).length;
    return {
      state: "running",
      meta: {
        sessionId: session.id,
        title: session.title,
        type: session.type as MockType,
        durationSeconds: session.durationSeconds,
        startedAt: session.startedAt,
        endsAt: session.endsAt,
        totalMarks: session.totalMarks,
        questionCount: rows.length,
      },
      items,
      answeredCount,
      currentScore: liveScore(rows.map((r) => ({ marks: r.marks, negativeMarks: r.negativeMarks, isCorrect: r.item.isCorrect }))),
    };
  }
  return toResult(session);
}

async function toResult(session: SessionRow): Promise<MockResultPayload> {
  const rows = await loadItems(session.id);
  const imageMap = await listImagesForQuestions(rows.map((r) => r.qid));
  const tallies = computeMockScore(
    rows.map((r) => ({ marks: r.marks, negativeMarks: r.negativeMarks, isCorrect: r.item.isCorrect })),
  );
  const attempted = tallies.correct + tallies.incorrect;
  const items: MockResultItem[] = [];
  const split = new Map<string, { name: string; score: number; total: number; correct: number; attempts: number }>();
  for (const r of rows) {
    const solution = await readSolution(r.qid);
    items.push({
      itemId: r.item.id,
      position: r.item.position,
      status: r.item.status,
      selectedAnswer: r.item.selectedAnswer,
      timeTakenSeconds: r.item.timeTakenSeconds,
      markedForReview: r.item.markedForReview,
      isCorrect: r.item.isCorrect,
      correctAnswer: r.correctAnswer,
      solution,
      practicePath: `/practice/${r.qid}`,
      question: {
        id: r.qid,
        prompt: r.prompt,
        options: r.options,
        type: r.qtype,
        difficulty: r.difficulty,
        marks: r.marks,
        negativeMarks: r.negativeMarks,
        year: r.year,
        subject: { slug: r.subjectSlug, name: r.subjectName },
        topic: { slug: r.topicSlug, name: r.topicName },
        images: imageMap.get(r.qid) ?? [],
      },
    });
    const entry = split.get(r.subjectSlug) ?? { name: r.subjectName, score: 0, total: 0, correct: 0, attempts: 0 };
    entry.total += r.marks;
    if (r.item.isCorrect === true) {
      entry.score += r.marks;
      entry.correct += 1;
      entry.attempts += 1;
    } else if (r.item.isCorrect === false) {
      entry.score -= r.negativeMarks;
      entry.attempts += 1;
    }
    split.set(r.subjectSlug, entry);
  }
  return {
    state: "finished",
    meta: {
      sessionId: session.id,
      title: session.title,
      type: session.type as MockType,
      status: session.status as "submitted" | "expired" | "abandoned",
      score: session.score ?? tallies.score,
      totalMarks: session.totalMarks,
      correct: tallies.correct,
      incorrect: tallies.incorrect,
      skipped: tallies.skipped,
      accuracy: attempted === 0 ? null : Math.round((tallies.correct / attempted) * 1000) / 1000,
      submittedAt: session.submittedAt,
    },
    subjectSplit: [...split.entries()].map(([slug, v]) => ({
      slug,
      name: v.name,
      score: Math.round(v.score * 100) / 100,
      total: v.total,
      correct: v.correct,
      attempts: v.attempts,
    })),
    items,
  };
}

export async function answerMockItem(
  userId: string,
  sessionId: string,
  itemId: string,
  answer: SubmittedAnswer | null,
  timeTakenSeconds?: number,
): Promise<
  | { saved: true; answeredCount: number; currentScore: number }
  | { error: "not_found" }
  | { error: "bad_answer"; message: string }
  | { error: "expired"; message: string }
  | { error: "finished"; message: string }
> {
  const session = await findOwnedSession(userId, sessionId);
  if (!session) return { error: "not_found" };
  if (session.status !== "in_progress") return { error: "finished", message: "This paper is already submitted." };
  if (isSessionExpired(session.endsAt, now())) {
    await finishInternal(session);
    return { error: "expired", message: "Time expired — the paper auto-submitted." };
  }

  const rows = await db
    .select({ item: mockSessionItems, question: questions })
    .from(mockSessionItems)
    .innerJoin(questions, eq(mockSessionItems.questionId, questions.id))
    .where(and(eq(mockSessionItems.id, itemId), eq(mockSessionItems.sessionId, session.id)))
    .limit(1);
  const row = rows[0];
  if (!row) return { error: "not_found" };

  const added = clampInt(timeTakenSeconds ?? 0, 0, 10800);
  const nextTime = (row.item.timeTakenSeconds ?? 0) + added;

  // Clearing: drop the saved answer, keep the clock and the review flag.
  if (answer === null) {
    const status = paletteStatus({ hasAnswer: false, markedForReview: row.item.markedForReview });
    await db
      .update(mockSessionItems)
      .set({ selectedAnswer: null, isCorrect: null, timeTakenSeconds: nextTime, status, updatedAt: new Date() })
      .where(eq(mockSessionItems.id, row.item.id));
    return saveSummary(session.id);
  }

  const bad = shapeError(row.question.type, answer, row.question.options);
  if (bad) return { error: "bad_answer", message: bad };

  const key = row.question.correctAnswer as CorrectAnswer | null;
  const isCorrect = key ? gradeWithKey(row.question.type, answer, key) : null;
  const status = paletteStatus({ hasAnswer: true, markedForReview: row.item.markedForReview });

  await db
    .update(mockSessionItems)
    .set({
      selectedAnswer: normalizeAnswer(answer),
      isCorrect,
      timeTakenSeconds: nextTime,
      status,
      updatedAt: new Date(),
    })
    .where(eq(mockSessionItems.id, row.item.id));

  return saveSummary(session.id);
}

async function saveSummary(
  sessionId: string,
): Promise<{ saved: true; answeredCount: number; currentScore: number }> {
  const all = await loadItems(sessionId);
  const answeredCount = all.filter((r) => r.item.selectedAnswer !== null).length;
  return {
    saved: true,
    answeredCount,
    currentScore: liveScore(all.map((r) => ({ marks: r.marks, negativeMarks: r.negativeMarks, isCorrect: r.item.isCorrect }))),
  };
}

export async function toggleMarkReview(
  userId: string,
  sessionId: string,
  itemId: string,
  marked: boolean,
): Promise<{ marked: boolean; status: string } | { error: "not_found" | "finished" | "expired" }> {
  const session = await findOwnedSession(userId, sessionId);
  if (!session) return { error: "not_found" };
  if (session.status !== "in_progress") return { error: "finished" };
  if (isSessionExpired(session.endsAt, now())) {
    await finishInternal(session);
    return { error: "expired" };
  }
  const rows = await db
    .select()
    .from(mockSessionItems)
    .where(and(eq(mockSessionItems.id, itemId), eq(mockSessionItems.sessionId, session.id)))
    .limit(1);
  const item = rows[0];
  if (!item) return { error: "not_found" };
  const status = paletteStatus({ hasAnswer: item.selectedAnswer !== null, markedForReview: marked });
  await db
    .update(mockSessionItems)
    .set({ markedForReview: marked, status, updatedAt: new Date() })
    .where(eq(mockSessionItems.id, item.id));
  return { marked, status };
}

async function finishInternal(session: SessionRow): Promise<SessionRow> {
  if (session.status !== "in_progress") return session;
  const rows = await loadItems(session.id);

  for (const r of rows) {
    if (r.item.selectedAnswer === null) continue;
    const key = r.correctAnswer as CorrectAnswer | null;
    const graded = key
      ? gradeWithKey(r.qtype, r.item.selectedAnswer as SubmittedAnswer, key)
      : null;
    if (graded !== r.item.isCorrect) {
      await db
        .update(mockSessionItems)
        .set({ isCorrect: graded, updatedAt: new Date() })
        .where(eq(mockSessionItems.id, r.item.id));
      r.item.isCorrect = graded;
    }
  }

  const tallies = computeMockScore(
    rows.map((r) => ({ marks: r.marks, negativeMarks: r.negativeMarks, isCorrect: r.item.isCorrect })),
  );
  const expired = isSessionExpired(session.endsAt, now());
  const updated = await db
    .update(mockSessions)
    .set({
      status: expired ? "expired" : "submitted",
      submittedAt: now(),
      score: tallies.score,
      updatedAt: now(),
    })
    .where(eq(mockSessions.id, session.id))
    .returning();
  const fresh = updated[0] ?? session;

  // Link attempts so Progress + Mistake-book stay in sync. Skipped items
  // have no answer to record, so only answered items land here.
  for (const r of rows) {
    if (r.item.selectedAnswer === null) continue;
    try {
      await db
        .insert(attempts)
        .values({
          userId: session.userId,
          questionId: r.qid,
          selectedAnswer: r.item.selectedAnswer as object,
          isCorrect: r.item.isCorrect ?? false,
          clientKey: `mock:${session.id}:${r.qid}`,
          timeTakenSeconds: r.item.timeTakenSeconds,
        })
        .onConflictDoNothing();
    } catch {
      // A retried finish must never duplicate attempt rows.
    }
    if (r.item.isCorrect === false) {
      try {
        await recordMiss(session.userId, r.qid);
      } catch {
        // Derived state must never fail the finish.
      }
    }
  }
  return fresh;
}

export async function finishMockSession(
  userId: string,
  sessionId: string,
): Promise<MockResultPayload | { error: "not_found" }> {
  const session = await findOwnedSession(userId, sessionId);
  if (!session) return { error: "not_found" };
  const fresh = await finishInternal(session);
  return toResult(fresh);
}

/** Cron/worker: auto-finish papers past their end. Lazy expiry in get/answer/finish covers missed ticks. */
export async function expireDueMocks(limit = 50): Promise<{ expired: number }> {
  const due = await db
    .select()
    .from(mockSessions)
    .where(and(eq(mockSessions.status, "in_progress"), lt(mockSessions.endsAt, now())))
    .limit(limit);
  for (const s of due) {
    try {
      await finishInternal(s);
    } catch {
      // One bad paper must not block the sweep.
    }
  }
  return { expired: due.length };
}

export async function listMockSessions(
  userId: string,
  opts: { page?: number; limit?: number } = {},
): Promise<{
  data: {
    id: string;
    type: MockType;
    title: string;
    status: string;
    score: number | null;
    totalMarks: number;
    questionCount: number;
    answeredCount: number;
    startedAt: Date;
    endsAt: Date;
    submittedAt: Date | null;
  }[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> {
  const limit = clampInt(opts.limit ?? 10, 1, 25);
  const page = Math.max(1, opts.page ?? 1);
  const totalRows = await db
    .select({ total: count() })
    .from(mockSessions)
    .where(eq(mockSessions.userId, userId));
  const total = totalRows[0]?.total ?? 0;
  const sessions = await db
    .select()
    .from(mockSessions)
    .where(eq(mockSessions.userId, userId))
    .orderBy(desc(mockSessions.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
  const data = [];
  for (const s of sessions) {
    const items = await db
      .select({ selected: mockSessionItems.selectedAnswer })
      .from(mockSessionItems)
      .where(eq(mockSessionItems.sessionId, s.id));
    data.push({
      id: s.id,
      type: s.type as MockType,
      title: s.title,
      status: s.status,
      score: s.score,
      totalMarks: s.totalMarks,
      questionCount: items.length,
      answeredCount: items.filter((i) => i.selected !== null).length,
      startedAt: s.startedAt,
      endsAt: s.endsAt,
      submittedAt: s.submittedAt,
    });
  }
  return { data, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export { FULL_MOCK_MARKS, FULL_MOCK_QUESTIONS, FULL_MOCK_SECONDS };
