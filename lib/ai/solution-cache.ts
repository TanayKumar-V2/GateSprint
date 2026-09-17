import type { CorrectAnswer } from "@/db/schema";
import { hasSolution, sameCorrectAnswer, type AiGrade } from "./grade-validation";

export type SolutionState = {
  correctAnswer: CorrectAnswer | null;
  solution: string | null;
};

export async function resolveSolutionCache(deps: {
  load: () => Promise<SolutionState>;
  generate: (answer: CorrectAnswer | null) => Promise<AiGrade>;
  save: (value: { correctAnswer: CorrectAnswer; solution: string }) => Promise<void>;
}): Promise<SolutionState & { generated: boolean; error?: "needs_review" | "ai_unavailable"; message?: string }> {
  const cached = await deps.load();
  if (cached.correctAnswer && hasSolution(cached.solution)) return { ...cached, generated: false };
  let grade: AiGrade;
  try {
    grade = await deps.generate(cached.correctAnswer);
  } catch (error) {
    console.error(
      "solution generation failed:",
      error instanceof Error ? error.message : error,
    );
    return { ...cached, generated: false, error: "ai_unavailable", message: "The solution service is temporarily unavailable. Try again." };
  }
  if (grade.verdict === "cannot_judge") {
    return { ...cached, generated: false, error: "needs_review", message: grade.explanation };
  }
  if (cached.correctAnswer && !sameCorrectAnswer(cached.correctAnswer, grade.correctAnswer)) {
    return { ...cached, generated: false, error: "needs_review", message: "The generated solution does not match the saved answer and needs review." };
  }
  const value = {
    correctAnswer: cached.correctAnswer ?? grade.correctAnswer,
    solution: hasSolution(cached.solution) ? cached.solution : grade.explanation,
  };
  await deps.save(value);
  return { ...value, generated: true };
}
