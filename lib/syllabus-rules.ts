import {
  SYLLABUS_EXAM_READY_ACCURACY,
  SYLLABUS_EXAM_READY_ATTEMPTS,
  SYLLABUS_EXAM_READY_COVERAGE,
} from "./constants";

export type SyllabusStatus = "not-started" | "in-progress" | "exam-ready";

export const STATUS_LABEL: Record<SyllabusStatus, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  "exam-ready": "Exam ready",
};

/**
 * Pure readiness rule (unit-tested, env-tunable via lib/constants):
 * - not-started: 0 attempts;
 * - exam-ready: >=N attempts AND accuracy >=A AND coverage >=C;
 * - else in-progress.
 * Zero questions or zero attempts never divide by zero and never fake ready.
 */
export function topicStatus(args: {
  attempts: number;
  correct: number;
  attemptedQuestions: number;
  totalQuestions: number;
}): SyllabusStatus {
  const { attempts, correct, attemptedQuestions, totalQuestions } = args;
  if (attempts <= 0) return "not-started";
  const accuracy = attempts > 0 ? correct / attempts : 0;
  const coverage = totalQuestions > 0 ? attemptedQuestions / totalQuestions : 0;
  if (
    attempts >= SYLLABUS_EXAM_READY_ATTEMPTS &&
    accuracy >= SYLLABUS_EXAM_READY_ACCURACY &&
    coverage >= SYLLABUS_EXAM_READY_COVERAGE
  ) {
    return "exam-ready";
  }
  return "in-progress";
}
