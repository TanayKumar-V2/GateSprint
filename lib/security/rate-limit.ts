import "server-only";
import { NextResponse } from "next/server";
import { Redis as UpstashRedis } from "@upstash/redis";
import { Redis as IoRedis } from "ioredis";
import { logSecurityEvent } from "./events";

export type LimitResult = {
  allowed: boolean;
  /** Seconds until the window resets (for Retry-After headers). */
  retryAfterSeconds: number;
};

type Store = {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
};

let local: IoRedis | null = null;
let upstash: UpstashRedis | null = null;

function store(): Store | null {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    upstash ??= new UpstashRedis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    return {
      incr: (key) => upstash!.incr(key),
      expire: (key, seconds) => upstash!.expire(key, seconds),
    };
  }
  if (process.env.REDIS_URL) {
    local ??= new IoRedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: false,
    });
    return local;
  }
  return null;
}

export function rateLimitEnabled(): boolean {
  return (process.env.RATE_LIMIT_ENABLED ?? "true") !== "false";
}

/**
 * Fixed-window counter in a shared Redis store — never process memory, so
 * quotas hold across serverless instances. Keys look like
 * `rl:<scope>:<windowSeconds>:<identity>`.
 *
 * When the shared store is missing or unreachable:
 * - expensive work (AI generation) fails CLOSED with allowed=false,
 * - cheap reads fail OPEN so the app stays usable.
 * Set RATE_LIMIT_ENABLED=false to bypass entirely (local tests only).
 */
export async function checkRateLimit(
  scope: string,
  identity: string,
  limit: number,
  windowSeconds: number,
  opts: { expensive: boolean; route?: string } = { expensive: false },
): Promise<LimitResult> {
  if (!rateLimitEnabled()) return { allowed: true, retryAfterSeconds: 0 };

  const key = `rl:${scope}:${windowSeconds}:${identity}`;
  const s = store();
  if (!s) {
    logSecurityEvent({
      category: "rate-limited",
      detail: `no-store route=${opts.route ?? scope} expensive=${opts.expensive}`,
    });
    return opts.expensive
      ? { allowed: false, retryAfterSeconds: windowSeconds }
      : { allowed: true, retryAfterSeconds: 0 };
  }

  try {
    const count = await s.incr(key);
    if (count === 1) await s.expire(key, windowSeconds);
    if (count > limit) {
      logSecurityEvent({
        category: "rate-limited",
        detail: `route=${opts.route ?? scope} scope=${scope}`,
        identity,
      });
      return { allowed: false, retryAfterSeconds: windowSeconds };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  } catch {
    logSecurityEvent({
      category: "rate-limited",
      detail: `store-error route=${opts.route ?? scope} expensive=${opts.expensive}`,
    });
    return opts.expensive
      ? { allowed: false, retryAfterSeconds: windowSeconds }
      : { allowed: true, retryAfterSeconds: 0 };
  }
}

export function rateLimitedResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: { code: "rate_limited", message: "Too many requests. Try again shortly." } },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, retryAfterSeconds)),
        "Cache-Control": "no-store",
      },
    },
  );
}
