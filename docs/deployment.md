# Deploying GATE Mentor

Target: Vercel (app) + Neon (Postgres) + Upstash (Redis). Docker covers
local dev, CI, and the optional container deploy — not daily production.

## One-time setup

1. **Neon**: create a project + database. Copy the pooled connection string.
2. **Upstash**: create a Redis database. Copy the REST URL + token.
3. **Google OAuth**: in Cloud Console add the production origin and
   `https://YOUR-APP.vercel.app/api/auth/callback/google` as an authorized
   redirect URI (localhost entries stay for local dev).
4. **Groq**: an API key with access to `openai/gpt-oss-20b` and
   `openai/gpt-oss-120b`. Note current dev-quota limits (250K TPM / 1K RPM
   at time of writing) and raise them before any classroom-sized launch.
5. **Vercel**: import the repo, set Node 24, add every variable from
   `.env.example` (below) as environment secrets. Never commit `.env*`.

## Environment reference

| Variable | Where | Notes |
|---|---|---|
| `DATABASE_URL` | Neon pooled URL | Direct `pg` migrations + serverless HTTP at runtime |
| `AUTH_SECRET` | `openssl rand -base64 32` | Rotating signs everyone out |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google Cloud Console | |
| `GROQ_API_KEY` | Groq Console | |
| `GROQ_PRIMARY_MODEL` | `openai/gpt-oss-20b` | Override without code changes |
| `GROQ_FALLBACK_MODEL` | `openai/gpt-oss-120b` | |
| `GROQ_FALLBACK_ENABLED` | `true` | `false` disables fallback (tests) |
| `NEXT_PUBLIC_APP_URL` | Canonical URL | Origin checks + links |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash | Rate limits; app fail-closes AI without it |
| `RATE_LIMIT_ENABLED` | `true` | `false` = local tests only |
| `CHAT_MINUTE_LIMIT` / `CHAT_DAILY_BUDGET` / `SESSION_HOURLY_LIMIT` | `10` / `100` / `10` | Tune after watching real usage |
| `CHAT_MAX_INPUT_CHARS` / `CHAT_MAX_HISTORY_MESSAGES` / `CHAT_MAX_OUTPUT_TOKENS` | `4000` / `30` / `1500` | Cost rails |
| `CHAT_PROVIDER_TIMEOUT_MS` | `45000` | |

`REDIS_URL` is the local-Docker equivalent of Upstash; `USE_NEON` forces
the driver choice when auto-detection is wrong.

## Ship checklist

- [ ] `npm run lint`, `typecheck`, `test`, `build` green (CI enforces this
      on every push, plus an integration job with real Postgres + Redis).
- [ ] `npm run db:migrate` applied to Neon, then `npm run db:seed`.
      Migrations are additive; destructive ones need a backup + manual
      approval first.
- [ ] Google redirect URI registered for the production domain.
- [ ] Hit `/api/health` on the deployment (no secrets in the response).
- [ ] Signed-out visit to `/practice` lands on sign-in; test login works.
- [ ] Send one Mentor message; confirm it streams and persists.
- [ ] Review the security-event logs for anything unexpected in the first hour.

## Known limitations (launch)

- Question bank is 18 curated seeds — real PYQ volume is the next content job.
- Syntax highlighting is styled blocks + copy (full highlighting deferred).
- Screen-reader pass on streamed replies was reviewed, not lab-tested.
- Rate-limit tuning (10/min, 100/day) is a starting guess from dev quotas.
- Node 26 / ESLint 10 / TypeScript 7 upgrades are held (Dependabot #4–#7).
- Container image vulnerability scanning (e.g. Trivy) is not in CI yet —
  dependency audit, CodeQL, and the Docker build smoke test are.
- Branch protection + required checks on `main` still need enabling in
  repo settings, along with secret scanning + push protection.
