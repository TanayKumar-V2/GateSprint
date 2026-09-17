import "server-only";
import { generateImportText } from "./model-router";
import { buildGradePrompt, GRADE_SYSTEM, parseAiGrade, type AiGrade, type GradeInput } from "./grade-validation";

export type { AiGrade, AiGradeSuccess, GradeInput } from "./grade-validation";

export async function gradeWithAi(input: GradeInput): Promise<AiGrade> {
  const text = await generateImportText({ system: GRADE_SYSTEM, prompt: buildGradePrompt(input), maxOutputTokens: 2400 });
  const grade = parseAiGrade(text, input.type, input.options);
  if (!grade) throw new Error("The grader returned an unusable answer.");
  return grade;
}
