import "server-only";
import { and, count, desc, eq, exists, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  attempts,
  bookmarks,
  questions,
  subjects,
  topics,
} from "@/db/schema";
import type { QuestionFilter } from "./validation/answers";
import { readSolution } from "./solutions";
import { listImagesForQuestions, type ImageMeta } from "./imports/images";

export type QuestionListItem = {
  id: string;
  year: number;
  questionNumber: number | null;
  type: "mcq" | "msq" | "nat";
  difficulty: "easy" | "medium" | "hard";
  prompt: string;
  options: { id: string; text: string }[] | null;
  marks: number;
  sourceLabel: string | null;
  subject: { slug: string; name: string };
  topic: { slug: string; name: string };
  attempted: boolean;
  bookmarked: boolean;
  /** Figure metadata (no bytes); render via /api/questions/[id]/images/[imageId]. */
  images: ImageMeta[];
};

export type QuestionList = {
  data: QuestionListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export async function listSubjects() {
  return db
    .select({
      id: subjects.id,
      slug: subjects.slug,
      name: subjects.name,
    })
    .from(subjects)
    .orderBy(subjects.displayOrder);
}

export async function listTopics(subjectSlug?: string) {
  const where = subjectSlug
    ? eq(
        topics.subjectId,
        db
          .select({ id: subjects.id })
          .from(subjects)
          .where(eq(subjects.slug, subjectSlug)),
      )
    : undefined;
  return db
    .select({
      id: topics.id,
      slug: topics.slug,
      name: topics.name,
      subjectId: topics.subjectId,
    })
    .from(topics)
    .where(where)
    .orderBy(topics.displayOrder);
}

export async function listPublishedYears(): Promise<number[]> {
  const rows = await db
    .select({ year: questions.year })
    .from(questions)
    .where(eq(questions.isPublished, true))
    .groupBy(questions.year)
    .orderBy(desc(questions.year));
  return rows.map((r) => r.year);
}

function attemptedExists(userId: string) {
  return exists(
    db
      .select({ one: sql`1` })
      .from(attempts)
      .where(
        and(
          eq(attempts.questionId, questions.id),
          eq(attempts.userId, userId),
        ),
      ),
  ).mapWith(Boolean);
}

function bookmarkedExists(userId: string) {
  return exists(
    db
      .select({ one: sql`1` })
      .from(bookmarks)
      .where(
        and(
          eq(bookmarks.questionId, questions.id),
          eq(bookmarks.userId, userId),
        ),
      ),
  ).mapWith(Boolean);
}

/**
 * Published questions with user-specific attempt/bookmark flags.
 * Correct answers and solutions are never included here.
 */
export async function listQuestions(
  userId: string,
  filter: QuestionFilter & { attempted?: boolean; bookmarked?: boolean },
): Promise<QuestionList> {
  const attempted = attemptedExists(userId);
  const bookmarked = bookmarkedExists(userId);

  const conditions = [eq(questions.isPublished, true)];
  if (filter.difficulty) conditions.push(eq(questions.difficulty, filter.difficulty));
  if (filter.type) conditions.push(eq(questions.type, filter.type));
  if (filter.year) conditions.push(eq(questions.year, filter.year));

  let subjectId: string | null = null;
  if (filter.subject) {
    const rows = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(eq(subjects.slug, filter.subject))
      .limit(1);
    if (!rows[0]) return emptyPage(filter);
    subjectId = rows[0].id;
    conditions.push(eq(questions.subjectId, subjectId));
  }
  if (filter.topic) {
    const topicWhere = subjectId
      ? and(eq(topics.slug, filter.topic), eq(topics.subjectId, subjectId))
      : eq(topics.slug, filter.topic);
    const rows = await db
      .select({ id: topics.id })
      .from(topics)
      .where(topicWhere);
    if (rows.length === 0) return emptyPage(filter);
    conditions.push(inArray(questions.topicId, rows.map((row) => row.id)));
  }
  if (filter.attempted === true) conditions.push(attempted);
  if (filter.attempted === false)
    conditions.push(sql`NOT (${attempted})`);
  if (filter.bookmarked === true) conditions.push(bookmarked);
  if (filter.bookmarked === false)
    conditions.push(sql`NOT (${bookmarked})`);

  const where = and(...conditions);
  const totalRows = await db
    .select({ total: count() })
    .from(questions)
    .where(where);
  const totalCount = totalRows[0]?.total ?? 0;

  const offset = (filter.page - 1) * filter.limit;
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
      sourceLabel: questions.sourceLabel,
      subjectSlug: subjects.slug,
      subjectName: subjects.name,
      topicSlug: topics.slug,
      topicName: topics.name,
      attempted,
      bookmarked,
    })
    .from(questions)
    .innerJoin(subjects, eq(questions.subjectId, subjects.id))
    .innerJoin(topics, eq(questions.topicId, topics.id))
    .where(where)
    .orderBy(desc(questions.year), questions.questionNumber)
    .limit(filter.limit)
    .offset(offset);

  const imageMap = await listImagesForQuestions(rows.map((r) => r.id));

  return {
    data: rows.map((r) => ({
      id: r.id,
      year: r.year,
      questionNumber: r.questionNumber,
      type: r.type,
      difficulty: r.difficulty,
      prompt: r.prompt,
      options: r.options,
      marks: r.marks,
      sourceLabel: r.sourceLabel,
      subject: { slug: r.subjectSlug, name: r.subjectName },
      topic: { slug: r.topicSlug, name: r.topicName },
      attempted: r.attempted ?? false,
      bookmarked: r.bookmarked ?? false,
      images: imageMap.get(r.id) ?? [],
    })),
    page: filter.page,
    limit: filter.limit,
    total: totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / filter.limit)),
  };
}

function emptyPage(filter: { page: number; limit: number }): QuestionList {
  return { data: [], page: filter.page, limit: filter.limit, total: 0, totalPages: 1 };
}

export type LastAttempt = {
  selectedAnswer: unknown;
  isCorrect: boolean;
  submittedAt: Date;
} | null;

export type QuestionView = {
  id: string;
  year: number;
  questionNumber: number | null;
  type: "mcq" | "msq" | "nat";
  difficulty: "easy" | "medium" | "hard";
  prompt: string;
  options: { id: string; text: string }[] | null;
  marks: number;
  negativeMarks: number;
  sourceLabel: string | null;
  subject: { slug: string; name: string };
  topic: { slug: string; name: string };
  /** True once the student has attempted: answer + solution may be shown. */
  reveal: boolean;
  correctAnswer: unknown;
  solution: string | null;
  lastAttempt: LastAttempt;
  bookmarked: boolean;
  /** Figure metadata (no bytes); render via /api/questions/[id]/images/[imageId]. */
  images: ImageMeta[];
};

/**
 * Single published question. The correct answer and solution stay hidden
 * until the student has an attempt on record.
 */
export async function getQuestionView(
  userId: string,
  questionId: string,
): Promise<QuestionView | null> {
  const rows = await db
    .select({
      id: questions.id,
      year: questions.year,
      questionNumber: questions.questionNumber,
      type: questions.type,
      difficulty: questions.difficulty,
      prompt: questions.prompt,
      options: questions.options,
      correctAnswer: questions.correctAnswer,
      marks: questions.marks,
      negativeMarks: questions.negativeMarks,
      sourceLabel: questions.sourceLabel,
      subjectSlug: subjects.slug,
      subjectName: subjects.name,
      topicSlug: topics.slug,
      topicName: topics.name,
    })
    .from(questions)
    .innerJoin(subjects, eq(questions.subjectId, subjects.id))
    .innerJoin(topics, eq(questions.topicId, topics.id))
    .where(and(eq(questions.id, questionId), eq(questions.isPublished, true)))
    .limit(1);
  const q = rows[0];
  if (!q) return null;

  const attemptRows = await db
    .select({
      selectedAnswer: attempts.selectedAnswer,
      isCorrect: attempts.isCorrect,
      submittedAt: attempts.submittedAt,
    })
    .from(attempts)
    .where(
      and(eq(attempts.questionId, questionId), eq(attempts.userId, userId)),
    )
    .orderBy(desc(attempts.submittedAt))
    .limit(1);
  const lastAttempt = attemptRows[0] ?? null;

  const bookmarkRows = await db
    .select({ id: bookmarks.id })
    .from(bookmarks)
    .where(
      and(eq(bookmarks.questionId, questionId), eq(bookmarks.userId, userId)),
    )
    .limit(1);

  const solution = lastAttempt ? await readSolution(questionId) : null;

  const imageMap = await listImagesForQuestions([questionId]);

  return {
    id: q.id,
    year: q.year,
    questionNumber: q.questionNumber,
    type: q.type,
    difficulty: q.difficulty,
    prompt: q.prompt,
    options: q.options,
    marks: q.marks,
    negativeMarks: q.negativeMarks,
    sourceLabel: q.sourceLabel,
    subject: { slug: q.subjectSlug, name: q.subjectName },
    topic: { slug: q.topicSlug, name: q.topicName },
    reveal: lastAttempt !== null,
    correctAnswer: lastAttempt ? q.correctAnswer : null,
    solution,
    lastAttempt: lastAttempt
      ? {
          selectedAnswer: lastAttempt.selectedAnswer,
          isCorrect: lastAttempt.isCorrect,
          submittedAt: lastAttempt.submittedAt,
        }
      : null,
    bookmarked: bookmarkRows.length > 0,
    images: imageMap.get(questionId) ?? [],
  };
}
