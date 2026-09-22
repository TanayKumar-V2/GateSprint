import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/current-user";
import { listVariants, requestVariants } from "@/lib/variants";
import { CHAT_DAILY_BUDGET, CHAT_MINUTE_LIMIT, generationsUsedToday } from "@/lib/ai/limits";
import {
  badRequest,
  forbidden,
  notFoundPrivate,
  unauthorized,
} from "@/lib/api/respond";
import { isAllowedOrigin } from "@/lib/security/origin";
import { assertContentType } from "@/lib/security/request-guards";
import { checkRateLimit, rateLimitedResponse } from "@/lib/security/rate-limit";
import { logSecurityEvent } from "@/lib/security/events";
import { variantRequestSchema } from "@/lib/validation/extension";

/** Session variants, answers never included. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const { sessionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return notFoundPrivate();

  const variants = await listVariants(userId, sessionId);
  if ("error" in variants) return notFoundPrivate();
  return NextResponse.json({ variants }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * Generate 1-3 variants off the session source. Counts against the shared
 * chat minute bucket + daily model budget, plus 5 variant-sets/hour.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();
  if (!isAllowedOrigin(request)) return forbidden();

  const { sessionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) return notFoundPrivate();

  let body: unknown = {};
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 0) {
    try {
      assertContentType(request);
    } catch {
      return badRequest("Send JSON.");
    }
    try {
      body = await request.json();
    } catch {
      return badRequest("Send valid JSON.");
    }
  }
  const parsed = variantRequestSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid request.");

  const minute = await checkRateLimit("chat-generate", userId, CHAT_MINUTE_LIMIT, 60, {
    expensive: true,
    route: "POST /api/chat/sessions/[sessionId]/variants",
  });
  if (!minute.allowed) return rateLimitedResponse(minute.retryAfterSeconds);

  const hourly = await checkRateLimit("variants-hourly", userId, 5, 3600, {
    expensive: true,
    route: "POST /api/chat/sessions/[sessionId]/variants",
  });
  if (!hourly.allowed) return rateLimitedResponse(hourly.retryAfterSeconds);

  const used = await generationsUsedToday(userId);
  if (used >= CHAT_DAILY_BUDGET) {
    logSecurityEvent({ category: "rate-limited", detail: "variant daily budget", userId });
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

  const result = await requestVariants(userId, sessionId, parsed.data);
  if ("error" in result) {
    if (result.error === "not_found") {
      logSecurityEvent({ category: "ownership-denied", detail: "variant session", userId });
      return notFoundPrivate();
    }
    if (result.error === "no_source") return badRequest(result.message);
    if (result.error === "ai_unavailable") {
      return NextResponse.json(
        { error: { code: "mentor_unavailable", message: result.message } },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { error: { code: "bad_variants", message: result.message } },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (result.fallbackUsed) {
    logSecurityEvent({ category: "provider-fallback", detail: `variants model=${result.modelUsed}`, userId });
  }
  return NextResponse.json(
    { variants: result.variants },
    { headers: { "Cache-Control": "no-store" } },
  );
}
