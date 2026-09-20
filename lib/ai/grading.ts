import "server-only";
import { fallbackEnabled, fallbackModelId, generateImportText, primaryModelId } from "./model-router";
import { buildGradePrompt, GRADE_SYSTEM, parseAiGradeDetailed, type AiGrade, type GradeInput } from "./grade-validation";

export type { AiGrade, AiGradeSuccess, GradeInput } from "./grade-validation";

/** Collapse whitespace and clip, so failure logs stay one short line. */
function previewRaw(text: string, max = 200): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

export async function gradeWithAi(input: GradeInput): Promise<AiGrade> {
  const args = { system: GRADE_SYSTEM, prompt: buildGradePrompt(input), maxOutputTokens: 2400 };
  const first = await generateImportText(args);
  const parsed = parseAiGradeDetailed(first, input.type, input.options);
  if ("grade" in parsed) return parsed.grade;
  // One malformed sample must not sink the attempt: the fallback model
  // gets a second, independent draw before we report the grader down.
  // (generateImportText already spent its own fallback when the API call
  // itself throws, so this only triggers on unusable output.)
  const fallback = fallbackModelId();
  if (fallbackEnabled() && fallback !== primaryModelId()) {
    try {
      const second = await generateImportText({ ...args, modelId: fallback });
      const reparsed = parseAiGradeDetailed(second, input.type, input.options);
      if ("grade" in reparsed) return reparsed.grade;
    } catch {
      // Fall through to the specific error below.
    }
  }
  throw new Error(
    `The grader returned an unusable answer (${parsed.failure}). Raw: ${previewRaw(first)}`,
  );
}
