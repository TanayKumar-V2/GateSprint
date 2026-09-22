# ADR-001 — Phase 0 Technical Baseline (Gate Sprint)

Date: 2026-09-11
Status: Accepted for Phase 1 scaffolding
Repo state: Empty except `plan.md`. No package.json, no lockfile, no Docker/CI.

## Environment verified

- Node v24.19.0, npm 11.17.0, git 2.55.0, Docker 29.7.2, Compose v5.5.0
- Workdir `C:\Tanay\gate-sprint`, not yet a git repo (init in Phase 1)

## Decisions

### 1. Package manager: npm
Locked per user choice. Use `npm` + `package-lock.json`, immutable installs (`npm ci`) in CI/Docker. Scripts: `lint`, `typecheck`, `test`, `db:*`, `docker:*`.

### 2. Framework: Next.js 16.3.4 (latest) + React 19.3.0
`npm view next dist-tags` → `latest: 16.3.4`. Peer deps accept React `^18.2 || ^19`. Use App Router, Server Components by default, `use client` only for interactivity. TypeScript strict + `noUncheckedIndexedAccess`.

### 3. Styling: Tailwind CSS v4.3.3 + shadcn CLI `shadcn@latest` (v4.x line)
Tailwind v4 CSS-first `@theme` config. shadcn: plan says "CLI v2" — current CLI is `shadcn` 4.x (`npx shadcn@latest init/add`). Treat "v2" as stale naming; use current `shadcn@latest` with `new-york` style, OKLCH tokens, `cn()` util. Only add components actually needed (button, card, dialog, form, input, table, sonner, sidebar primitives). React 19 supported; npm may need `--legacy-peer-deps` prompt handling — document in README.

### 4. DB: Drizzle ORM 0.45.2 + drizzle-kit 0.31.10 + `@neondatabase/serverless` 1.1.0
Local: PostgreSQL 16/17 container. Hosted: Neon. Single Drizzle adapter with `DATABASE_URL` switch. Migrations in `drizzle/`, `db/schema.ts`, `db/index.ts`, `db/seed.ts`.

### 5. Auth: `next-auth@5.0.0-beta.32` (Auth.js v5), Google OAuth only
`latest` stable is 4.24.15; v5 is still beta (`beta: 5.0.0-beta.32`). Required by plan. Risk accepted: beta API may shift; pin exact `5.0.0-beta.32`, follow Auth.js v5 docs (`auth.ts`, `handlers`, `auth()` helper), JWT or DB sessions via Drizzle adapter (decide in Phase 3 — recommend DB sessions for ownership joins). Google only for MVP.

### 6. AI: `ai@^6.0.0` (pin `6.0.28x` line) + `@ai-sdk/groq@^3.0.0`
`ai` dist-tags: `latest 7.0.97`, `ai-v6 6.0.280`, `ai-v5 5.0.255`. Plan mandates v6 — stick to v6 to avoid v7 churn. Pairing note (found by typecheck): `@ai-sdk/groq@4` emits spec-v4 models that `ai@6` rejects; the v6-compatible line is `@ai-sdk/groq@3` (3.0.66). Streaming API (v6): `streamText({ model, system, messages })` → `toUIMessageStream()` / `toUIMessageStreamResponse()` / `toTextStreamResponse()`, client `useChat` + transports, `convertToModelMessages`. Do NOT invent custom SSE protocol. Re-verify helper names at Phase 6 implementation time against installed version.

### 7. Groq models — VERIFIED live docs 2026
- Primary `openai/gpt-oss-20b`: production, ~1000 tps, 131,072 ctx, 65,536 max output, $0.075 in / $0.30 out per 1M, dev limits 250K TPM / 1K RPM.
- Fallback `openai/gpt-oss-120b`: production, ~500 tps, same ctx/output, $0.15 in / $0.60 out, same dev limits.
- IDs exactly as in `plan.md`. No rename needed. Env: `GROQ_PRIMARY_MODEL`, `GROQ_FALLBACK_MODEL`, `GROQ_FALLBACK_ENABLED=true`. Live key verification deferred to Phase 6 (user has key; do NOT commit it).

### 8. Markdown/math/code
`react-markdown@10.1.0`, `remark-math@6.0.0`, `rehype-katex@7.0.1`, `katex@0.18.7`. Code: prefer `shiki@4.4.3` after compat check in Phase 7; fallback `rehype-pretty-code@0.14.5`. Never `dangerouslySetInnerHTML`.

### 9. Validation: `zod@4.6.2`
Zod v4 current. Use at every Route Handler boundary. Note v4 API differences vs v3 (pin and follow v4 docs).

### 10. Redis: `ioredis@6.0.0` local + `@upstash/redis@1.38.4` hosted behind adapter
`lib/security/rate-limit.ts` exposes `checkLimit()` / `consumeBudget()`; implementation selected by `REDIS_URL` vs `UPSTASH_*`. Never in-memory only.

### 11. Docker base: Node 24 LTS (`node:24-bookworm-slim`)
Node 24 is active LTS and matches local. Multi-stage build, non-root `nextjs:nodejs`, no secrets in layers, `/app` standalone output, `HEALTHCHECK` + `/api/health` (no secrets).

### 12. Deployment boundary
Vercel (app) + Neon (pg) + Upstash (redis). Docker image is for reproducible dev/CI + optional deploy, not primary prod runtime. Migrations expand-and-contract, manual approval for destructive.

## Proposed structure (Phase 1 to create)
See `docs/phase0-baseline.md` § Structure. Adapts plan.md Part II §6 to Next 16 conventions, adds `docs/`, `tests/`, `drizzle/`.

## Risks
- next-auth v5 beta churn → pin, isolate in `lib/auth.ts`.
- AI SDK v7 exists → stay on v6, codemod later.
- shadcn "CLI v2" naming stale → use current CLI, record version.
- Groq rate limits (1K RPM dev) → budgets + fallback-once + circuit breaker in Phase 6.
- React 19 peer quirks with npm → test install flags in Phase 1.
