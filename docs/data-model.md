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
- `mistakes` — derived revision inbox, one row per `(user_id, question_id)`.
  Upserted on every incorrect attempt (`miss_count+1`, `last_missed_at=now`,
  reopen if resolved). Correct attempts never auto-resolve; the UI suggests
  resolving after 2 correct re-attempts in a row. Optional `tag`
  (`concept_gap | silly_mistake | trap | time_pressure | unattempted`).
  Indexed by `(user_id, resolved, last_missed_at)`.
- `topic_overrides` — display-only `focus | skipped` marker per
  `(user_id, topic_id)`. Readiness stays derived from attempts; an override
  never changes accuracy, attempts, or coverage.
- `mock_sessions` — timed papers: `full | sectional | pyq_year`,
  `in_progress | submitted | expired | abandoned`, snapshot `config` JSONB
  (mode, filters, seed, questionIds), server-owned `ends_at`, `score`.
  Indexed by `(user_id, created_at)`.
- `mock_session_items` — one row per paper question: position, palette
  status text, saved answer (nullable), server-graded `is_correct`
  (nullable), seconds spent, review flag. Unique `(session_id, question_id)`.
- `sheets` — one curated Markdown sheet per topic (`topic_id` unique,
  `version` bumped on each admin publish). Human-reviewed only.
- `sheet_revisions` — one "revised" tick per `(user_id, sheet_id, day)`
  (UTC day column = the per-day rule).
- `generatedQuestions` — Mentor-written variant practice per chat session:
  prompt, type, options, key, difficulty, nullable topic, `verified`
  (false until a correct retest). Answers never leave in list payloads.
  Indexed by `(session_id, created_at)`.

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
