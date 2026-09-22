# Threat Model — Gate Sprint (Phase 0, lightweight)

## Scope
Practice (PYQ browse/solve), Mentor (streaming chat + bridge), progress/bookmarks, Auth.js Google, Postgres (Neon/local), Redis limiter (Upstash/local), Groq `gpt-oss-20b` → `gpt-oss-120b` fallback, Vercel deploy + Docker image.

## Assets
User identity, attempts/timing, bookmarks, chat sessions/messages, PYQ bank + solutions, Groq/DB/Redis creds, model budget.

## Attackers
Anonymous bots, authenticated abusers (quota/cost), curious users (IDOR), prompt-injection authors, supply-chain / secret-scrapers.

## Key threats + controls
1. **Broken access (IDOR)** — enforce `where(eq(table.userId, session.user.id))` server-side; tests per resource family; privacy-preserving 404.
2. **Client trust** — recompute `isCorrect` server-side; ignore client userId/role; idempotency keys on attempts.
3. **Injection (prompt)** — system prompt in `lib/prompts/` versioned; source-Q block delimited, never interpolated into instructions; model gets no tools/DB/net; render safe Markdown only.
4. **DoS / wallet-drain** — shared Redis limits + daily budgets + input/history/output caps + timeouts + stream cancel; fail-closed for AI; `429` + `Retry-After` + `RateLimit-*`.
5. **Auth/session** — Auth.js v5 Google with state/nonce/PKCE, secure cookies, origin check on mutations, 5/15m auth limit.
6. **XSS/cache** — no `dangerouslySetInnerHTML`; CSP `default-src 'self'` + minimal allows; `no-store` on private APIs.
7. **Secrets/supply** — `.env` never committed/imaged; Vercel/GitHub envs; `npm ci`; audit/CodeQL/Trivy/gitleaks; pinned actions; Dependabot.
8. **Privacy** — minimize PII, hash IPs, short retention, no chat bodies in logs, deletion path before prod.

## Abuse telemetry (privacy-conscious)
`ts | category | hashed IP/user | route | outcome` for rate/auth/ownership/provider events. Alert on sustained AI abuse, cost spikes, Redis/DB failures, auth bursts. Start with structured logs; managed observability only after retention review.

## Residual risks
- next-auth v5 beta churn; AI SDK v6→v7 drift; shadcn CLI naming drift.
- Groq dev quota (1K RPM) during load tests → use mocks + budgets.
- No WAF yet → rely on app limiter + Vercel platform controls; add CDN/WAF before prod if available.
