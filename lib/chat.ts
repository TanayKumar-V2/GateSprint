import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { chatMessages, chatSessions, questions, subjects, topics } from "@/db/schema";
import { buildQuestionContext, buildTopicContext } from "./prompts/context-builder";
import {
  MENTOR_PROMPT_VERSION,
  MENTOR_SYSTEM_PROMPT,
} from "./prompts/mentor-system-prompt";
import type { ModelMessage } from "ai";
import { CHAT_MAX_HISTORY_MESSAGES } from "./ai/limits";

export type SessionSource =
  | { kind: "blank" }
  | { kind: "question"; questionId: string }
  | { kind: "topic"; topicId: string };

function titleFor(source: SessionSource, firstMessage?: string): string {
  if (firstMessage && firstMessage.trim().length > 0) {
    const clean = firstMessage.trim().replace(/\s+/g, " ");
    return clean.length <= 60 ? clean : `${clean.slice(0, 57).trimEnd()}…`;
  }
  if (source.kind === "question") return "Question discussion";
  if (source.kind === "topic") return "Topic revision";
  return "New session";
}

/**
 * Create a session. Source references are validated here, server-side:
 * questions must be published, topics must hold published questions.
 * Returns null when the source is invalid (caller maps to 404).
 */
export async function createSession(
  userId: string,
  source: SessionSource,
  title?: string,
) {
  if (source.kind === "question") {
    const rows = await db
      .select({ id: questions.id })
      .from(questions)
      .where(
        and(eq(questions.id, source.questionId), eq(questions.isPublished, true)),
      )
      .limit(1);
    if (!rows[0]) return null;
  }
  if (source.kind === "topic") {
    const rows = await db
      .select({ id: questions.id })
      .from(questions)
      .where(
        and(eq(questions.topicId, source.topicId), eq(questions.isPublished, true)),
      )
      .limit(1);
    if (!rows[0]) return null;
  }

  const inserted = await db
    .insert(chatSessions)
    .values({
      userId,
      title: title?.trim().slice(0, 120) || titleFor(source),
      sourceQuestionId: source.kind === "question" ? source.questionId : null,
      sourceTopicId: source.kind === "topic" ? source.topicId : null,
    })
    .returning();
  return inserted[0]!;
}

export async function listSessions(userId: string, limit = 30) {
  return db
    .select({
      id: chatSessions.id,
      title: chatSessions.title,
      sourceQuestionId: chatSessions.sourceQuestionId,
      sourceTopicId: chatSessions.sourceTopicId,
      createdAt: chatSessions.createdAt,
      updatedAt: chatSessions.updatedAt,
    })
    .from(chatSessions)
    .where(eq(chatSessions.userId, userId))
    .orderBy(desc(chatSessions.updatedAt))
    .limit(Math.min(Math.max(limit, 1), 50));
}

export async function getOwnedSession(userId: string, sessionId: string) {
  const rows = await db
    .select()
    .from(chatSessions)
    .where(
      and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Delete a session owned by the user, messages included.
 * Returns false when the session doesn't exist or belongs to someone else.
 */
export async function deleteOwnedSession(
  userId: string,
  sessionId: string,
): Promise<boolean> {
  const owned = await getOwnedSession(userId, sessionId);
  if (!owned) return false;
  await db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId));
  await db
    .delete(chatSessions)
    .where(
      and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)),
    );
  return true;
}

export type SessionSourceInfo =
  | {
      kind: "question";
      href: string;
      heading: string;
      detail: string;
    }
  | {
      kind: "topic";
      href: string;
      heading: string;
      detail: string;
    }
  | null;

/** Small banner data for the source panel. Never includes answers. */
export async function getSessionSourceInfo(
  session: NonNullable<Awaited<ReturnType<typeof getOwnedSession>>>,
): Promise<SessionSourceInfo> {
  if (session.sourceQuestionId) {
    const rows = await db
      .select({
        prompt: questions.prompt,
        subjectName: subjects.name,
        topicName: topics.name,
      })
      .from(questions)
      .innerJoin(subjects, eq(questions.subjectId, subjects.id))
      .innerJoin(topics, eq(questions.topicId, topics.id))
      .where(eq(questions.id, session.sourceQuestionId))
      .limit(1);
    const q = rows[0];
    if (!q) return null;
    return {
      kind: "question",
      href: `/practice/${session.sourceQuestionId}`,
      heading: `${q.subjectName} · ${q.topicName}`,
      detail: q.prompt.length > 140 ? `${q.prompt.slice(0, 137).trimEnd()}…` : q.prompt,
    };
  }
  if (session.sourceTopicId) {
    const rows = await db
      .select({ name: topics.name, subjectName: subjects.name, subjectSlug: subjects.slug, topicSlug: topics.slug })
      .from(topics)
      .innerJoin(subjects, eq(topics.subjectId, subjects.id))
      .where(eq(topics.id, session.sourceTopicId))
      .limit(1);
    const t = rows[0];
    if (!t) return null;
    return {
      kind: "topic",
      href: `/practice?subject=${t.subjectSlug}&topic=${t.topicSlug}`,
      heading: `Revising ${t.subjectName} · ${t.name}`,
      detail: "Mentor has your accuracy and recent misses for this topic.",
    };
  }
  return null;
}

export async function getSessionMessages(sessionId: string, limit = 100) {
  return db
    .select({
      id: chatMessages.id,
      role: chatMessages.role,
      content: chatMessages.content,
      modelUsed: chatMessages.modelUsed,
      fallbackUsed: chatMessages.fallbackUsed,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(chatMessages.createdAt)
    .limit(Math.min(Math.max(limit, 1), 200));
}

export async function saveUserMessage(sessionId: string, content: string) {
  // No column selection: the Neon HTTP driver only supports bare
  // .returning(), and this keeps one code path for both drivers.
  const inserted = await db
    .insert(chatMessages)
    .values({ sessionId, role: "user", content })
    .returning();
  return inserted[0]!.id;
}

/**
 * True when this send repeats the latest user message: identical text to
 * the most recent user row. Retries reuse that row and append a fresh
 * reply instead of stacking duplicates. Anything with different text is
 * always stored as its own message.
 */
export async function isRetrySend(
  sessionId: string,
  message: string,
): Promise<boolean> {
  const recent = await db
    .select({
      role: chatMessages.role,
      content: chatMessages.content,
    })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(5);
  const latestUser = recent.find((m) => m.role === "user");
  return latestUser?.content === message;
}

export async function saveAssistantMessage(args: {
  sessionId: string;
  content: string;
  modelUsed: string | null;
  fallbackUsed: boolean;
  status: "completed" | "interrupted" | "failed";
}) {
  await db.insert(chatMessages).values({
    sessionId: args.sessionId,
    role: "assistant",
    content: args.content,
    modelUsed: args.modelUsed,
    fallbackUsed: args.fallbackUsed,
    generationStatus: args.status,
  });
  await db
    .update(chatSessions)
    .set({ updatedAt: new Date() })
    .where(eq(chatSessions.id, args.sessionId));
}

/**
 * Name a fresh session after its first real message (or its source),
 * unless the student already titled it.
 */
export async function maybeTitleSession(
  userId: string,
  sessionId: string,
  firstMessage: string,
) {
  const session = await getOwnedSession(userId, sessionId);
  if (!session || session.title !== "New session") return;
  const countRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.sessionId, sessionId),
        eq(chatMessages.role, "user"),
      ),
    );
  if ((countRows[0]?.n ?? 0) > 1) return;
  const source: SessionSource = session.sourceQuestionId
    ? { kind: "question", questionId: session.sourceQuestionId }
    : session.sourceTopicId
      ? { kind: "topic", topicId: session.sourceTopicId }
      : { kind: "blank" };
  await db
    .update(chatSessions)
    .set({ title: titleFor(source, firstMessage), updatedAt: new Date() })
    .where(eq(chatSessions.id, sessionId));
}

/** System prompt + delimited source context + trimmed history. */
export async function buildGenerationInput(
  userId: string,
  sessionId: string,
): Promise<{ system: string; messages: ModelMessage[] } | null> {
  const session = await getOwnedSession(userId, sessionId);
  if (!session) return null;

  const blocks: string[] = [];
  if (session.sourceQuestionId) {
    const block = await buildQuestionContext(userId, session.sourceQuestionId);
    if (block) blocks.push(block);
  }
  if (session.sourceTopicId) {
    const block = await buildTopicContext(userId, session.sourceTopicId);
    if (block) blocks.push(block);
  }

  const history = await db
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(CHAT_MAX_HISTORY_MESSAGES);

  const messages: ModelMessage[] = [...history]
    .reverse()
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content.slice(0, 8000),
    }));

  return {
    system: `${MENTOR_SYSTEM_PROMPT}\n\n(prompt ${MENTOR_PROMPT_VERSION})${blocks.length > 0 ? `\n\n${blocks.join("\n\n")}` : ""}`,
    messages,
  };
}
