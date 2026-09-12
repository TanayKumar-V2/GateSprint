import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUserId } from "@/lib/current-user";
import {
  buildGenerationInput,
  getOwnedSession,
  isRetrySend,
  maybeTitleSession,
  saveAssistantMessage,
  saveUserMessage,
} from "@/lib/chat";
import { streamWithFallback } from "@/lib/ai/model-router";
import {
  CHAT_DAILY_BUDGET,
  CHAT_MAX_INPUT_CHARS,
  CHAT_MAX_OUTPUT_TOKENS,
  CHAT_MINUTE_LIMIT,
  CHAT_PROVIDER_TIMEOUT_MS,
  CHAT_TEMPERATURE,
  generationsUsedToday,
} from "@/lib/ai/limits";
import {
  badRequest,
  forbidden,
  notFoundPrivate,
  unauthorized,
} from "@/lib/api/respond";
import { isAllowedOrigin } from "@/lib/security/origin";
import {
  MAX_BODY_BYTES,
  assertContentType,
} from "@/lib/security/request-guards";
import {
  checkRateLimit,
  rateLimitedResponse,
} from "@/lib/security/rate-limit";
import { clientIp, logSecurityEvent } from "@/lib/security/events";

const chatSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().trim().min(1).max(CHAT_MAX_INPUT_CHARS),
});

/**
 * Send one message and stream the Mentor's reply. The user message is
 * stored before generation; the completed reply is stored with which
 * model wrote it. Retried sends are safe: each POST creates exactly one
 * user message, and the stream carries exactly one reply.
 */
export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  if (!isAllowedOrigin(request)) return forbidden();

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return badRequest("Message too large.");
  }
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
  const parsed = chatSchema.safeParse(body);
  if (!parsed.success) {
    if (
      typeof (body as { message?: unknown })?.message === "string" &&
      (body as { message: string }).message.length > CHAT_MAX_INPUT_CHARS
    ) {
      return badRequest(
        `Keep it under ${CHAT_MAX_INPUT_CHARS} characters — split longer questions up.`,
      );
    }
    return badRequest("Invalid request.");
  }

  const session = await getOwnedSession(userId, parsed.data.sessionId);
  if (!session) {
    logSecurityEvent({ category: "ownership-denied", detail: "chat session", userId });
    return notFoundPrivate();
  }

  const ip = clientIp(request);
  const minute = await checkRateLimit("chat-generate", userId, CHAT_MINUTE_LIMIT, 60, {
    expensive: true,
    route: "POST /api/chat",
  });
  if (!minute.allowed) return rateLimitedResponse(minute.retryAfterSeconds);

  const used = await generationsUsedToday(userId);
  if (used >= CHAT_DAILY_BUDGET) {
    logSecurityEvent({ category: "rate-limited", detail: "daily budget", userId });
    return NextResponse.json(
      {
        error: {
          code: "rate_limited",
          message: `Daily Mentor budget used (${CHAT_DAILY_BUDGET} replies). Back tomorrow.`,
        },
      },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Retry/regenerate sends the same text again: reuse the existing user
  // message instead of stacking a duplicate, then append a fresh reply.
  // Anything new is always stored as its own message.
  if (!(await isRetrySend(session.id, parsed.data.message))) {
    await saveUserMessage(session.id, parsed.data.message);
  }
  await maybeTitleSession(userId, session.id, parsed.data.message);

  const input = await buildGenerationInput(userId, session.id);
  if (!input) return notFoundPrivate();

  const outcome = await streamWithFallback({
    system: input.system,
    messages: input.messages,
    maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS,
    temperature: CHAT_TEMPERATURE,
    abortSignal: request.signal,
    timeoutMs: CHAT_PROVIDER_TIMEOUT_MS,
    persist: async (text, info) => {
      await saveAssistantMessage({
        sessionId: session.id,
        content: text,
        modelUsed: info.status === "failed" ? null : info.modelUsed,
        fallbackUsed: info.fallbackUsed,
        status: info.status,
      });
      if (info.fallbackUsed || info.status !== "completed") {
        logSecurityEvent({
          category:
            info.status === "completed" ? "provider-fallback" : "provider-failure",
          detail: `model=${info.modelUsed} status=${info.status}`,
          userId,
        });
      }
    },
  });

  if (!outcome.ok) {
    await saveAssistantMessage({
      sessionId: session.id,
      content: "",
      modelUsed: null,
      fallbackUsed: false,
      status: "failed",
    });
    logSecurityEvent({
      category: "provider-failure",
      detail: `kind=${outcome.kind}`,
      userId,
      identity: ip,
    });
    if (outcome.kind === "invalid-request") return badRequest("That message couldn't be processed. Try rephrasing.");
    return NextResponse.json(
      {
        error: {
          code: "mentor_unavailable",
          message: "Mentor is temporarily unavailable. Your message is saved — try again in a bit.",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return outcome.response;
}
