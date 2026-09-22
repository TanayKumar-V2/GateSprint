import "server-only";
import { db } from "@/db";
import { questions, subjects, topics } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createMockSession, getMockablePool } from "./mocks";
import { suggestTime } from "./test-builder-rules";
import type { BuilderCreate } from "./validation/extension";

export async function getPoolCount(filters: {
  subjectSlugs?: string[];
  topicSlugs?: string[];
  difficulty?: "easy" | "medium" | "hard";
  questionType?: "mcq" | "msq" | "nat";
}): Promise<{ count: number; totalMarks: number; mix: { mcq: number; msq: number; nat: number } }> {
  const pool = await getMockablePool(filters);
  const mix = { mcq: 0, msq: 0, nat: 0 };
  let totalMarks = 0;
  for (const q of pool) {
    mix[q.type] += 1;
    totalMarks += q.marks;
  }
  return { count: pool.length, totalMarks: Math.round(totalMarks * 100) / 100, mix };
}

/**
 * Custom drill under time pressure: a sectional session built from the
 * requested weak mix. Reuses the mock runner for the exam feel.
 */
export async function buildCustomTest(userId: string, input: BuilderCreate) {
  return createMockSession(userId, {
    type: "sectional",
    mode: "custom",
    subjectSlugs: input.subjectSlugs,
    topicSlugs: input.topicSlugs,
    difficulty: input.difficulty,
    questionType: input.type,
    totalQuestions: input.totalQuestions,
    durationSeconds: input.durationSeconds,
  });
}

export function suggestedDuration(totalQuestions: number, mix: { mcq: number; msq: number; nat: number }) {
  return suggestTime(totalQuestions, mix);
}

export async function listFilterOptions() {
  const [sRows, years] = await Promise.all([
    db.select({ slug: subjects.slug, name: subjects.name }).from(subjects).orderBy(subjects.displayOrder),
    db.select({ year: questions.year }).from(questions).where(eq(questions.isPublished, true)).groupBy(questions.year),
  ]);
  const tRows = await db.select({ slug: topics.slug, name: topics.name, subjectId: topics.subjectId }).from(topics);
  return {
    subjects: sRows,
    topics: tRows,
    years: years.map((y) => y.year).sort((a, b) => b - a),
  };
}
