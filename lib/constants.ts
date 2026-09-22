export const SITE_NAME = "Gate Sprint";
export const SITE_TAGLINE = "Practice PYQs with an AI tutor";

export const ROUTES = {
  home: "/",
  signIn: "/sign-in",
  practice: "/practice",
  mentor: "/mentor",
  progress: "/progress",
  bookmarks: "/bookmarks",
} as const;

/** Speed-vs-accuracy flags (transparent in UI tooltips, env-tunable). */
export const TIME_RUSHED_SECONDS = Number(process.env.TIME_RUSHED_SECONDS ?? 30);
export const TIME_OVERTIME_MIN_SECONDS = Number(process.env.TIME_OVERTIME_MIN_SECONDS ?? 180);
export const TIME_OVERTIME_MEDIAN_MULTIPLE = Number(process.env.TIME_OVERTIME_MEDIAN_MULTIPLE ?? 3);
export const TIME_SLOW_CORRECT_MEDIAN_MULTIPLE = Number(
  process.env.TIME_SLOW_CORRECT_MEDIAN_MULTIPLE ?? 2,
);

/** Syllabus readiness: derived, never hand-ticked (transparent in UI). */
export const SYLLABUS_EXAM_READY_ATTEMPTS = Number(process.env.SYLLABUS_EXAM_READY_ATTEMPTS ?? 5);
export const SYLLABUS_EXAM_READY_ACCURACY = Number(process.env.SYLLABUS_EXAM_READY_ACCURACY ?? 0.8);
export const SYLLABUS_EXAM_READY_COVERAGE = Number(process.env.SYLLABUS_EXAM_READY_COVERAGE ?? 0.8);
