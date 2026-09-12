import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUserId } from "@/lib/current-user";
import { createSession, listSessions } from "@/lib/chat";
import {
  badRequest,
  forbidden,
  notFoundPrivate,
  unauthorized,
} from "@/lib/api/respond";
import { isAllowedOrigin } from "@/lib/security/origin";
import { assertContentType } from "@/lib/security/request-guards";
import {
  checkRateLimit,
  rateLimitedResponse,
} from "@/lib/security/rate-limit";
import { clientIp, logSecurityEvent } from "@/lib/security/events";
import { SESSION_HOURLY_LIMIT } from "@/lib/ai/limits";

const createSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    sourceQuestionId: z.string().uuid().optional(),
    sourceTopicId: z.string().uuid().optional(),
  })
  .refine((v) => !(v.sourceQuestionId && v.sourceTopicId), {
    message: "One source at a time.",
  });

/**
 * Start a blank chat, a question-linked chat (Ask Mentor), or a
 * weak-topic revision chat. Sources are validated server-side; anything
 * unpublished or missing comes back 404.
 */
export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  if (!isAllowedOrigin(request)) return forbidden();

  const ip = clientIp(request);
  const hourly = await checkRateLimit(
    "chat-session-create",
    `${userId}:${ip}`,
    SESSION_HOURLY_LIMIT,
    3600,
    { expensive: false, route: "POST /api/chat/sessions" },
  );
  if (!hourly.allowed) return rateLimitedResponse(hourly.retryAfterSeconds);

  try {
    assertContentType(request);
  } catch {
    return badRequest("Send JSON.");
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Send valid JSON.");
  }
  const parsed = createSchema.safeParse(body ?? {});
  if (!parsed.success) return badRequest("Invalid request.");

  const { title, sourceQuestionId, sourceTopicId } = parsed.data;
  const session = await createSession(
    userId,
    sourceQuestionId
      ? { kind: "question", questionId: sourceQuestionId }
      : sourceTopicId
        ? { kind: "topic", topicId: sourceTopicId }
        : { kind: "blank" },
    title,
  );
  if (!session) {
    logSecurityEvent({ category: "ownership-denied", detail: "bad chat source", userId });
    return notFoundPrivate("That question or topic isn't available.");
  }
  return NextResponse.json(
    { session },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** The signed-in student's sessions, most recent first. */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const sessions = await listSessions(userId);
  return NextResponse.json(
    { sessions },
    { headers: { "Cache-Control": "no-store" } },
  );
}
