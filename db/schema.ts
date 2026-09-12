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

/* ---------- Structured answer shapes ----------
   MSQ answers are always arrays of option ids — never comma strings.
   NAT answers are numbers with a per-question absolute tolerance. */

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
    correctAnswer: jsonb("correct_answer").$type<CorrectAnswer>().notNull(),
    marks: real("marks").notNull().default(1),
    negativeMarks: real("negative_marks").notNull().default(0),
    sourceLabel: text("source_label"),
    isPublished: boolean("is_published").notNull().default(false),
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
