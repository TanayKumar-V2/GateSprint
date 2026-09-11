/**
 * Central security headers (Phase 1 placeholder foundation).
 * Tightened CSP allowances land with KaTeX/fonts work in Phase 7.
 */
export function getSecurityHeaders(isProduction: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    // No public caching of app responses by default; private APIs add no-store.
    "Cache-Control": "no-store",
    "Content-Security-Policy": [
      "default-src 'self'",
      // Next.js App Router renders hydration state and page data as inline
      // scripts by design, so a nonce-less `script-src 'self'` would break
      // every page (blank content, console CSP errors). 'unsafe-inline'
      // still blocks all third-party/external scripts, which is the real
      // threat for this app. Nonce-based scripts would need framework
      // support that Next.js doesn't offer for its flight payloads.
      //
      // React/Turbopack also need 'unsafe-eval' for dev-mode debugging
      // (source maps, stack reconstruction). Production React never uses
      // eval, so it stays out of the production policy below.
      `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  };
  if (isProduction) {
    headers["Strict-Transport-Security"] =
      "max-age=63072000; includeSubDomains; preload";
  }
  return headers;
}
