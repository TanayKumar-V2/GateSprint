import { createHash } from "crypto";

export type SecurityEventCategory =
  | "rate-limited"
  | "auth-failure"
  | "ownership-denied"
  | "provider-failure"
  | "provider-fallback"
  | "request-rejected";

export type SecurityEvent = {
  category: SecurityEventCategory;
  /** Coarse, non-identifying detail: route, outcome, error kind. */
  detail?: string;
  /** Raw IP or user id — stored only as a keyed hash, short-lived in logs. */
  identity?: string;
  userId?: string;
};

function hashIdentity(value: string): string {
  const salt = process.env.AUTH_SECRET ?? "local-dev-salt";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 16);
}

/**
 * Structured, privacy-conscious security logging. Enough to spot abuse
 * patterns and cost spikes; never passwords, tokens, chat content, or
 * raw identifiers.
 */
export function logSecurityEvent(event: SecurityEvent): void {
  console.warn(
    JSON.stringify({
      at: new Date().toISOString(),
      area: "security",
      category: event.category,
      detail: event.detail ?? null,
      identity: event.identity ? hashIdentity(event.identity) : null,
      user: event.userId ? "[present]" : null,
    }),
  );
}

/** Best-effort client IP for rate-limit keys. Never trusted for identity. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim().slice(0, 64);
  return "unknown";
}
