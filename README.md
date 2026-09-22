# Gate Sprint

Focused GATE CS/IT preparation: PYQ practice with server-validated attempts,
plus a persistent Mentor that explains concepts step by step.

> Phase 1 foundation. Practice browser (Phase 4), progress (Phase 5),
> Mentor streaming (Phase 6–7), and the Ask-Mentor bridge (Phase 8) are
> placeholders — nothing is faked as complete.

## Stack

Next.js 16 App Router · React 19 · TypeScript strict · Tailwind CSS v4 ·
shadcn/ui · Drizzle + Neon (Phase 2) · Auth.js v5 Google (Phase 3) ·
Groq `openai/gpt-oss-20b` → `openai/gpt-oss-120b` (Phase 6) · Docker · GitHub Actions

## Setup

Requirements: Node 24 (`24.x`), npm 11, Docker 29+ with Compose v2.

```bash
cp .env.example .env.local   # fill values; never commit .env*
npm ci
npm run dev                  # http://localhost:3000
```

Useful scripts:

```bash
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
npm run build       # production build
npm run start       # serve production build
```

## Docker

```bash
docker compose up --build            # app + postgres + redis (dev)
docker compose down -v               # reset named volumes (dev data loss)
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit
docker build -t gate-sprint:phase1 .
docker run --rm -p 3000:3000 gate-sprint:phase1
```

Health: `GET /api/health` returns `{ status: "ok" }` with `no-store`.

## Database (local)

```bash
docker compose up -d db              # postgres:17 on localhost:5432
DATABASE_URL=postgresql://gate:gate@localhost:5432/gate_mentor npm run db:migrate
DATABASE_URL=postgresql://gate:gate@localhost:5432/gate_mentor npm run db:seed
```

The seed is idempotent — rerun it any time. Point `DATABASE_URL` at Neon
(or set `USE_NEON=true`) for hosted. See `docs/data-model.md`.

## Docs

- `plan.md` — product + engineering source of truth
- `docs/adr.md` — version/decision record
- `docs/phase0-baseline.md` — env findings, infra, CI, threat model
- `docs/threat-model.md` — lightweight threat model
- `docs/data-model.md` — tables, answer shapes, db commands
- `docs/auth.md` — sign-in setup, sessions, rotation
- `docs/mentor.md` — prompt, fallback policy, budgets
- `docs/deployment.md` — hosting setup, env reference, launch checklist
- `docs/operations.md` — backups, rotation, incident checklist

## Security notes

- Secrets only via env; `.env*` ignored; never baked into images.
- Security headers centralized in `lib/security/headers.ts` + `next.config.ts`.
- Rate limiting runs on shared Redis (local container or Upstash) with
  per-user chat budgets — see `docs/mentor.md` and `docs/operations.md`.
