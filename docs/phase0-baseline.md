# Phase 0 Baseline — Findings, Infra, CI, Threat Model

Companion to `docs/adr.md`. No feature code written in Phase 0.

## 1. Repo / env findings
- Only `plan.md` (1458 lines). No `package.json`, lockfile, `app/`, `db/`, Docker, workflows.
- Node v24.19.0 / npm 11.17.0 / Docker 29.7.2 / Compose v5.5.0 — all meet plan needs.
- Not a git repo yet → `git init` + branch protection checklist in Phase 1/9.

## 2. Version decisions (verified 2026-09-11 via npm + Groq docs)
| Layer | Decision | Source |
|---|---|---|
| next | `16.3.4` | `latest` tag |
| react / react-dom | `19.3.0` | next peer `^18.2 \|\| ^19` |
| tailwindcss | `^4.3.3` | latest, CSS-first |
| shadcn CLI | `shadcn@latest` (4.x, e.g. 4.21.0) | plan "CLI v2" is stale naming |
| drizzle-orm | `^0.45.2`, drizzle-kit `^0.31.10` | latest |
| @neondatabase/serverless | `^1.1.0` | latest |
| next-auth | `5.0.0-beta.32` exact | `beta` tag (stable is 4.24.15) |
| ai | `^6.0.0` (ai-v6 `6.0.280`) | plan mandates v6; `latest` is 7.0.97 — deferred |
| @ai-sdk/groq | `^4.0.0` (4.0.40) | peer zod only |
| zod | `^4.6.2` | latest (v4 API) |
| react-markdown / remark-math / rehype-katex / katex | `10.1.0 / 6.0.0 / 7.0.1 / 0.18.7` | latest |
| shiki (preferred) / rehype-pretty-code | `4.4.3 / 0.14.5` | decide in Phase 7 |
| ioredis / @upstash/redis | `6.0.0 / 1.38.4` | adapter pattern |
| pg containers | `postgres:17-alpine`, `redis:7-alpine` | healthchecks |
| Docker base | `node:24-bookworm-slim` | LTS, matches local |

Groq (from console.groq.com/docs):
- `openai/gpt-oss-20b` primary, `openai/gpt-oss-120b` fallback — IDs exact, both Production, 131K ctx / 65K output, 250K TPM + 1K RPM dev.

## 3. Proposed directory structure (Phase 1)
```text
app/
  (auth)/sign-in/page.tsx
  (dashboard)/layout.tsx
  (dashboard)/practice/page.tsx
  (dashboard)/practice/[questionId]/page.tsx
  (dashboard)/mentor/page.tsx
  (dashboard)/mentor/[sessionId]/page.tsx
  (dashboard)/progress/page.tsx
  (dashboard)/bookmarks/page.tsx
  api/auth/[...nextauth]/route.ts
  api/attempts/route.ts
  api/bookmarks/route.ts
  api/chat/route.ts
  api/chat/sessions/route.ts
  api/chat/sessions/[sessionId]/route.ts
  api/progress/route.ts
  api/questions/route.ts
  api/questions/[questionId]/route.ts
  api/health/route.ts
  layout.tsx  page.tsx  not-found.tsx  error.tsx
components/app-shell/ chat/ practice/ progress/ ui/
db/index.ts  db/schema.ts  db/seed.ts
lib/ai/model-router.ts  lib/prompts/mentor-system-prompt.ts
lib/security/{headers.ts,origin.ts,rate-limit.ts,request-guards.ts}
lib/validation/  lib/auth.ts  lib/constants.ts  lib/utils.ts
docs/adr.md  docs/phase0-baseline.md  docs/threat-model.md
tests/unit/  tests/integration/  tests/e2e/
drizzle/
Dockerfile  .dockerignore  docker-compose.yml  docker-compose.test.yml
.github/workflows/{ci.yml,security.yml}  .github/dependabot.yml
.env.example  README.md
```

## 4. Local Docker + hosted decision (locked: Docker Compose local)
- `docker-compose.yml`: `app` (dev, hot reload) + `db` (postgres:17-alpine, named volume `pgdata`, `pg_isready` check) + `redis` (redis:7-alpine, `redis-cli ping` check). No secrets baked; `${VAR:-default}` only.
- `docker-compose.test.yml`: isolated `testdb`/`testredis` on different ports/volumes so tests never touch dev data. `npm run test:integration` spins this profile.
- Hosted: Neon PG + Upstash Redis via env switch. `DATABASE_URL`, `REDIS_URL` vs `UPSTASH_*`.
- Reset docs: `docker compose down -v` documented in README (Phase 1).

## 5. CI/CD + security checks decision
- `ci.yml` (PR + push to main, `contents: read`): checkout pinned → `npm ci` → format check → lint → typecheck → unit → integration (pg+redis services) → migration check (`drizzle-kit check`) → `next build` → `docker build` smoke → `npm audit --audit-level=high` → Trivy container scan → upload non-sensitive artifacts only.
- `security.yml`: CodeQL (js/ts), secret scanning note + gitleaks, Dependabot (`dependabot.yml`) weekly for npm + Docker + actions.
- Deploy: PR preview after CI; main → staging; prod requires env approval + reviewed secrets in Vercel/GitHub environments. No `pull_request_target` on untrusted code. Pin actions to SHA/major. Never expose prod secrets to forks.
- Container: multi-stage, `USER nextjs`, `.dockerignore` (`.git,node_modules,.env*,coverage,drizzle/*.db`), `HEALTHCHECK`, non-root verified in e2e.

## 6. Threat model (lightweight)
| Area | Threat | Control (phase) |
|---|---|---|
| Auth | session hijack, OAuth bypass, brute force | Auth.js v5 Google, HttpOnly+Secure+SameSite, origin/referer check, 5/15m auth limit, no hand-rolled OAuth (3) |
| IDOR | user A reads B's sessions/attempts/bookmarks | owner-scoped queries, 401/403-or-404 consistently, cross-user tests (3,9) |
| Trust boundary | client `isCorrect`, `userId`, forged context | server recompute, server-load Q+attempt for Ask Mentor, Zod everywhere (4,6,8) |
| Prompt injection | override teaching, exfiltrate prompt/context | system/context separation + delimiting, no tools/DB/net for model, output Markdown-only, injection tests (6) |
| Abuse/cost | chat spam, stream abandon, huge inputs | Redis shared limiter (per-user/IP/combined/cost-cat), 429+Retry-After, input/history/output caps, daily budgets, timeouts, fail-closed AI on limiter outage (6,9) |
| Browser | XSS via AI HTML, clickjack, sniff, cache leak | no `dangerouslySetInnerHTML`, CSP `default-src 'self'`, HSTS prod, nosniff, private `Cache-Control: no-store`, frame-ancestors (1,3,9) |
| SSRF/SQLi | URL fetch, string SQL | no server fetch of user URLs (allowlist+timeout only), Drizzle params only (9) |
| Supply chain | vuln dep/image/action, secret leak | lockfile+`npm ci`, Dependabot, audit/CodeQL/Trivy/gitleaks, least-priv creds, rotation runbook (9) |
| Privacy | IP/chat over-retention, log leak | hashed/short-retention IPs, no private chat in logs, deletion path blocker before prod (9) |
| Ops | bad migration, provider outage | expand-contract, backup/restore + rollback doc, fallback-once router + both-down friendly msg (6,9) |

Abuse plan defaults per plan.md §Rate-limit (env-tunable): auth 5/15m, public reads 120/m IP, authed reads 180/m user, attempts 60/m user+Q + idempotency, bookmarks 120/m, progress 30/m, session-create 10/h user+IP, generations 10/m + 100/d + cost-cat. Security events: rate violations, auth fails, ownership fails, provider fails — timestamp + category + hashed IP, no passwords/tokens/chat bodies.

## 7. Assumptions / open items for Phase 1
1. `GROQ_API_KEY` available from user at Phase 6; Phase 0 used public docs only.
2. Google OAuth client ID/secret provisioned at Phase 3; local mock auth for tests.
3. Neon + Upstash projects provisioned before Phase 9 deploy; local PG/Redis suffices until then.
4. Seed scope: ~12 subjects, ~20 topics, 15–30 Qs (MCQ/MSQ/NAT) — user locked.
5. AI SDK v6 helper names re-verified at install (`toUIMessageStreamResponse` vs `toTextStreamResponse`).
6. `shadcn@latest` version recorded at init; "CLI v2" treated as doc drift.

## 8. Next phase unblocked
Phase 1 may scaffold Next 16 + TS strict + Tailwind v4 + shadcn + shell + `not-found.tsx` + Docker/CI + headers placeholders. No DB/AI code until Phase 2+.
