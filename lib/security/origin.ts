/**
 * Origin / CSRF guard placeholder. Enforced for mutations from Phase 3.
 * Only trust forwarded headers behind a verified trusted proxy (Vercel).
 */
export function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  // Safe methods without Origin are allowed through; mutations without
  // Origin fall back to SameSite cookies + explicit checks in Phase 3.
  if (!origin) return true;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    return new URL(origin).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}
