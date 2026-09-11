# Data model

## Connection

`db/index.ts` picks the driver from `DATABASE_URL`:

- Neon URLs (or `USE_NEON=true`) → `@neondatabase/serverless` HTTP driver.
- Anything else → local `pg` pool (Docker Compose `db` service).

Same schema and queries on both. Migrations (`db/migrate.ts`) always use a
direct `pg` connection — point `DATABASE_URL` at local Postgres or Neon
before running.

## Tables

- `users`, `accounts`, `sessions`, `verification_tokens` — Auth.js shape
  (Google OAuth only for now). App code joins on `users.id`.
- `subjects` — the 12 GATE CS/IT areas, `slug` unique, ordered for display.
- `topics` — belong to one subject; unique `(subject_id, slug)`. A
  question's topic must belong to its subject (enforced in app code and seed).
- `questions` — `mcq | msq | nat`, `easy | medium | hard`, prompt, `options`
  JSON (null for NAT), `correctAnswer` JSON, marks + negative marks,
  `sourceLabel` (e.g. `GATE 2022`), `isPublished`. Only published rows are
  served to students.
- `solutions` — one row per `(question_id, solution_type)`; `official` or
  `curated`. Seed writes `curated` for all 18 questions.
- `attempts` — raw submitted answer + server-recomputed `isCorrect`. Never
  trust client correctness. Indexed by `(user_id, question_id)`.
- `bookmarks` — unique `(user_id, question_id)`.
- `chat_sessions` — nullable `source_question_id` for the Ask-Mentor bridge,
  indexed by `(user_id, updated_at)`.
- `chat_messages` — `system | user | assistant`, `model_used` +
  `fallback_used` for provider audit, `generation_status` for interrupted
  streams. Indexed by `(session_id, created_at)`.

## Answer shapes

```text
options:       [{ id: "A", text: "..." }, ...]
mcq answer:    { kind: "mcq", optionId: "A" }
msq answer:    { kind: "msq", optionIds: ["A", "C"] }   # array, never CSV
nat answer:    { kind: "nat", value: 104, tolerance: 0 }
```

Grading lives in `lib/validation/answers.ts`: MCQ is exact match, MSQ is
set equality (order and duplicates ignored), NAT is absolute-difference
within the question's tolerance (default 0.01).

## Commands

```bash
npm run db:generate   # new migration from schema changes
npm run db:migrate    # apply to DATABASE_URL
npm run db:seed       # idempotent: safe to rerun any time
```

Seed covers 12 subjects, 21 topics, 18 published questions (8 MCQ, 5 MSQ,
5 NAT) with curated solutions. Reruns update in place; student rows
(attempts, bookmarks, chats) are never touched.
