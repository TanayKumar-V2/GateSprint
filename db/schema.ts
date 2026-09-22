import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

/* ---------- Enums ---------- */

export const questionTypeEnum = pgEnum("question_type", ["mcq", "msq", "nat"]);
export const difficultyEnum = pgEnum("difficulty", ["easy", "medium", "hard"]);
export const solutionTypeEnum = pgEnum("solution_type", [
  "official",
  "curated",
]);
export const messageRoleEnum = pgEnum("message_role", [
  "system",
  "user",
  "assistant",
]);
export const generationStatusEnum = pgEnum("generation_status", [
  "completed",
  "interrupted",
  "failed",
]);
export const mistakeTagEnum = pgEnum("mistake_tag", [
  "concept_gap",
  "silly_mistake",
  "trap",
  "time_pressure",
  "unattempted",
]);

/* ---------- Structured answer shapes ----------
   MSQ answers are always arrays of option ids — never comma strings.
   NAT answers are numbers with a per-question absolute tolerance.
   correctAnswer is NULL until known: imports store no key, and the first
   student attempt triggers AI grading which caches the answer. */

export type QuestionOption = { id: string; text: string };
export type CorrectAnswer =
  | { kind: "mcq"; optionId: string }
  | { kind: "msq"; optionIds: string[] }
  | { kind: "nat"; value: number; tolerance: number };

/* ---------- Auth identity ----------
   Shape matches the Auth.js Drizzle adapter so Phase 3 needs no rework.
   Only Google OAuth rows will exist in the first release. */

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  // Public handle for /u/[username] profiles. NULL only for rows created
  // before the handle existed — backfilled on first sight and assigned
  // for every new sign-up, so profile URLs stay stable.
  username: text("username").unique(),
  // scrypt hash for email+password sign-in. NULL for OAuth-only accounts.
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* ---------- Question bank ---------- */

export const subjects = pgTable("subjects", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const topics = pgTable(
  "topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    unique("topics_subject_slug_unique").on(t.subjectId, t.slug),
    index("topics_subject_idx").on(t.subjectId),
  ],
);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "restrict" }),
    year: integer("year").notNull(),
    questionNumber: integer("question_number"),
    type: questionTypeEnum("type").notNull(),
    difficulty: difficultyEnum("difficulty").notNull(),
    prompt: text("prompt").notNull(),
    options: jsonb("options").$type<QuestionOption[]>(),
    // NULL until known: imports store no key; the first attempt triggers
    // AI grading, which caches the answer here for all later attempts.
    correctAnswer: jsonb("correct_answer").$type<CorrectAnswer | null>(),
    marks: real("marks").notNull().default(1),
    negativeMarks: real("negative_marks").notNull().default(0),
    sourceLabel: text("source_label"),
    externalId: text("external_id"),
    sourcePage: integer("source_page"),
    extractionConfidence: real("extraction_confidence"),
    isPublished: boolean("is_published").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("questions_subject_idx").on(t.subjectId),
    index("questions_topic_idx").on(t.topicId),
    index("questions_year_idx").on(t.year),
    index("questions_published_idx").on(t.isPublished),
  ],
);

export const solutions = pgTable(
  "solutions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    solutionType: solutionTypeEnum("solution_type").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    unique("solutions_question_type_unique").on(t.questionId, t.solutionType),
  ],
);

/* ---------- Question figures (diagrams extracted from PDFs) ----------
   Small raster images stored as base64 text — or a CDN url when the
   extractor uploads to ImageKit — so both database drivers (Neon HTTP and
   node-postgres) behave identically with no binary-column quirks. Served
   through /api/questions/[id]/images/[imageId] (CDN urls redirect). */

export const questionImages = pgTable(
  "question_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    width: integer("width"),
    height: integer("height"),
    dataBase64: text("data_base64"),
    url: text("url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("question_images_question_idx").on(t.questionId),
    unique("question_images_question_position_unique").on(t.questionId, t.position),
  ],
);

/* ---------- Student data (all owner-scoped) ---------- */

export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    // Raw submitted answer; isCorrect is always recomputed server-side.
    selectedAnswer: jsonb("selected_answer").notNull(),
    isCorrect: boolean("is_correct").notNull(),
    // Optional client key: retried submissions with the same key return
    // the original attempt instead of recording a duplicate.
    clientKey: text("client_key"),
    timeTakenSeconds: integer("time_taken_seconds"),
    startedAt: timestamp("started_at"),
    submittedAt: timestamp("submitted_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("attempts_user_question_idx").on(t.userId, t.questionId),
    index("attempts_user_created_idx").on(t.userId, t.createdAt),
    uniqueIndex("attempts_user_client_key_unique")
      .on(t.userId, t.clientKey)
      .where(sql`${t.clientKey} IS NOT NULL`),
  ],
);

export const bookmarks = pgTable(
  "bookmarks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    unique("bookmarks_user_question_unique").on(t.userId, t.questionId),
    index("bookmarks_user_idx").on(t.userId),
  ],
);

export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New session"),
    sourceQuestionId: uuid("source_question_id").references(
      () => questions.id,
      { onDelete: "set null" },
    ),
    // Targeted revision started from a weak-topic recommendation.
    // Progress is always reloaded server-side from this topic.
    sourceTopicId: uuid("source_topic_id").references(() => topics.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("chat_sessions_user_updated_idx").on(t.userId, t.updatedAt)],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    modelUsed: text("model_used"),
    fallbackUsed: boolean("fallback_used").notNull().default(false),
    generationStatus: generationStatusEnum("generation_status")
      .notNull()
      .default("completed"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("chat_messages_session_created_idx").on(t.sessionId, t.createdAt)],
);

/* ---------- Mistake book (derived from incorrect attempts) ----------
   One row per (user, question). Upserted on every incorrect attempt —
   never created by hand. Correct attempts never auto-resolve; the UI
   only suggests resolving after two correct re-attempts in a row. */

export const mistakes = pgTable(
  "mistakes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    tag: mistakeTagEnum("tag"),
    missCount: integer("miss_count").notNull().default(1),
    lastMissedAt: timestamp("last_missed_at").defaultNow().notNull(),
    resolved: boolean("resolved").notNull().default(false),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    unique("mistakes_user_question_unique").on(t.userId, t.questionId),
    index("mistakes_user_resolved_missed_idx").on(
      t.userId,
      t.resolved,
      t.lastMissedAt,
    ),
  ],
);

/* ---------- Syllabus overrides (display-only focus/skip markers) ----------
   Derived readiness never changes: overrides only add a badge. Stats
   always come from attempts, so an override can't pollute accuracy. */

export const topicOverrideEnum = pgEnum("topic_override", ["skipped", "focus"]);
export const mockTypeEnum = pgEnum("mock_type", ["full", "sectional", "pyq_year"]);
export const mockStatusEnum = pgEnum("mock_status", [
  "in_progress",
  "submitted",
  "expired",
  "abandoned",
]);

export const topicOverrides = pgTable(
  "topic_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    status: topicOverrideEnum("status").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    unique("topic_overrides_user_topic_unique").on(t.userId, t.topicId),
    index("topic_overrides_user_idx").on(t.userId),
  ],
);

/* ---------- Timed mocks (exam simulation over keyed questions) ----------
   Sessions snapshot their question set in config so the paper never shifts
   under the student. Only questions WITH a cached correctAnswer are picked:
   grading must be instant mid-exam, never an AI call. Practice attempts
   grow that keyed pool (first attempt AI-grades and caches the key). */

export type MockSessionConfig = {
  mode: "full" | "custom" | "pyq";
  subjectSlugs?: string[];
  topicSlugs?: string[];
  year?: number;
  difficulty?: "easy" | "medium" | "hard";
  type?: "mcq" | "msq" | "nat";
  timePolicy?: { durationSeconds: number; suggested: boolean };
  seed?: number;
  questionIds: string[];
};

export const mockSessions = pgTable(
  "mock_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: mockTypeEnum("type").notNull(),
    title: text("title").notNull(),
    totalMarks: real("total_marks").notNull().default(0),
    durationSeconds: integer("duration_seconds").notNull(),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    endsAt: timestamp("ends_at").notNull(),
    submittedAt: timestamp("submitted_at"),
    status: mockStatusEnum("status").notNull().default("in_progress"),
    config: jsonb("config").$type<MockSessionConfig>(),
    score: real("score"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("mock_sessions_user_created_idx").on(t.userId, t.createdAt)],
);

/* ---------- Formula / one-shot sheets (admin-curated, human-reviewed) ----------
   Sheets are curated revision notes per topic — never auto-published AI
   output. sheetRevisions records one "revised" tick per user/sheet/day
   (the `day` UTC column enforces it; equivalent to a date() unique). */

export const sheets = pgTable(
  "sheets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" })
      .unique(),
    contentMd: text("content_md").notNull(),
    version: integer("version").notNull().default(1),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    updatedBy: text("updated_by"),
  },
  (t) => [index("sheets_topic_idx").on(t.topicId)],
);

export const sheetRevisions = pgTable(  "sheet_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sheetId: uuid("sheet_id")
      .notNull()
      .references(() => sheets.id, { onDelete: "cascade" }),
    revisedAt: timestamp("revised_at").defaultNow().notNull(),
    day: text("day").notNull(),
  },
  (t) => [
    unique("sheet_revisions_user_sheet_day_unique").on(t.userId, t.sheetId, t.day),
    index("sheet_revisions_user_idx").on(t.userId),
  ],
);

/* ---------- AI-generated variant questions (Mentor "Quiz me") ----------
   Ephemeral practice spun off a chat session — marked AI-generated and
   unreviewed until a correct grading path verifies them. Never shown with
   answers in list payloads. Admins may promote vetted rows to the bank. */

export const generatedQuestions = pgTable(
  "generated_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    type: questionTypeEnum("type").notNull(),
    options: jsonb("options").$type<QuestionOption[] | null>(),
    correctAnswer: jsonb("correct_answer").$type<CorrectAnswer>().notNull(),
    difficulty: difficultyEnum("difficulty").notNull().default("medium"),
    topicId: uuid("topic_id").references(() => topics.id, { onDelete: "set null" }),
    verified: boolean("verified").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("generated_questions_session_created_idx").on(t.sessionId, t.createdAt)],
);

export const mockSessionItems = pgTable(  "mock_session_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => mockSessions.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    /** unvisited | unanswered | answered | marked | answered_marked */
    status: text("status").notNull().default("unanswered"),
    selectedAnswer: jsonb("selected_answer"),
    isCorrect: boolean("is_correct"),
    timeTakenSeconds: integer("time_taken_seconds").notNull().default(0),
    markedForReview: boolean("marked_for_review").notNull().default(false),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("mock_session_items_session_position_idx").on(t.sessionId, t.position),
    unique("mock_session_items_session_question_unique").on(t.sessionId, t.questionId),
  ],
);

/* ---------- Relations ---------- */

export const subjectsRelations = relations(subjects, ({ many }) => ({
  topics: many(topics),
  questions: many(questions),
}));

export const topicsRelations = relations(topics, ({ one, many }) => ({
  subject: one(subjects, {
    fields: [topics.subjectId],
    references: [subjects.id],
  }),
  questions: many(questions),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  subject: one(subjects, {
    fields: [questions.subjectId],
    references: [subjects.id],
  }),
  topic: one(topics, {
    fields: [questions.topicId],
    references: [topics.id],
  }),
  solutions: many(solutions),
  images: many(questionImages),
  attempts: many(attempts),
  bookmarks: many(bookmarks),
}));

export const chatSessionsRelations = relations(
  chatSessions,
  ({ one, many }) => ({
    user: one(users, {
      fields: [chatSessions.userId],
      references: [users.id],
    }),
    sourceQuestion: one(questions, {
      fields: [chatSessions.sourceQuestionId],
      references: [questions.id],
    }),
    messages: many(chatMessages),
  }),
);

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatMessages.sessionId],
    references: [chatSessions.id],
  }),
}));

export const questionImagesRelations = relations(questionImages, ({ one }) => ({
  question: one(questions, {
    fields: [questionImages.questionId],
    references: [questions.id],
  }),
}));
