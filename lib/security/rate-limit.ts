/**
 * Rate-limit adapter interface (Phase 1). Redis-backed implementation
 * (ioredis local / Upstash hosted) lands in Phase 6. Never use in-memory
 * limits for production quotas.
 */
export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

export async function checkRateLimit(
  _key: string,
  _limit: number,
  _windowSeconds: number,
): Promise<RateLimitResult> {
  // Phase 1: always allow; enforcement + tests arrive with the shared store.
  void _key;
  void _limit;
  void _windowSeconds;
  return { allowed: true };
}
