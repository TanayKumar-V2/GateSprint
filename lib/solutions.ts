import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { questions, solutions } from "@/db/schema";
import { hasSolution } from "./ai/grade-validation";
import { resolveSolutionCache } from "./ai/solution-cache";
import { gradeWithAi } from "./ai/grading";
import { listImagesForQuestions } from "./imports/images";

export async function readSolution(questionId: string): Promise<string | null> {
  const rows = await db
    .select({ content: solutions.content })
    .from(solutions)
    .where(eq(solutions.questionId, questionId))
    .orderBy(solutions.solutionType);
  return rows.find((row) => hasSolution(row.content))?.content ?? null;
}

export async function ensureQuestionSolution(questionId: string) {
  const rows = await db
    .select()
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);
  const question = rows[0];
  if (!question || !question.isPublished) throw new Error("Question is no longer available.");
  return resolveSolutionCache({
    load: async () => {
      const solutionRows = await db
        .select({ content: solutions.content })
        .from(solutions)
        .where(eq(solutions.questionId, questionId))
        .orderBy(solutions.solutionType);
      return {
        correctAnswer: question.correctAnswer,
        solution: solutionRows.find((row) => hasSolution(row.content))?.content ?? null,
      };
    },
    generate: async (correctAnswer) => {
      const figures = await listImagesForQuestions([questionId]);
      return gradeWithAi({
        type: question.type,
        prompt: question.prompt,
        options: question.options,
        correctAnswer: correctAnswer ?? undefined,
        figureCount: figures.get(questionId)?.length ?? 0,
      });
    },
    save: async (value) => {
      const existing = await db
        .select({ content: solutions.content })
        .from(solutions)
        .where(eq(solutions.questionId, questionId));
      if (!existing.some((row) => hasSolution(row.content))) {
        await db
          .insert(solutions)
          .values({ questionId, solutionType: "curated", content: value.solution })
          .onConflictDoUpdate({
            target: [solutions.questionId, solutions.solutionType],
            set: { content: value.solution, updatedAt: new Date() },
          });
      }
      if (!question.correctAnswer) {
        await db
          .update(questions)
          .set({ correctAnswer: value.correctAnswer, extractionConfidence: 0, updatedAt: new Date() })
          .where(eq(questions.id, questionId));
      }
    },
  });
}
