# Custom builder + Timed mocks (extension 2 + 1)

## The keyed-pool rule

Mocks grade instantly mid-exam — never an AI call under time pressure. So
both builder and mocks draw only from **published questions with a cached
`correctAnswer`**. Practice attempts AI-grade on first try and cache the
key, so practice grows the mock pool. When the pool is short, creation
returns `422 pool_exhausted` with `{ available }` and a hint — never a
half-graded paper.

Deviations from `extension.md` (deliberate, recorded here):

- `POST /api/mocks/[id]/answer` accepts `answer: null` to **clear** a saved
  answer (GATE lets you un-answer before submit).
- `finishMockSession` writes `attempts` rows for **answered items only** —
  skipped items have no answer to record (`selected_answer` is NOT NULL).
- Pool counting lives at `GET /api/test-builder/pool` (count + marks +
  suggested duration); `GET /api/questions?count-only` was not added to
  avoid a second response shape on the list endpoint.
- `abandoned` status exists in the enum but has no endpoint yet; quitting
  mid-paper just leaves it `in_progress` until the clock expires it.
- `finish` idempotency is by session state (repeat calls return the same
  result; `clientKey mock:{session}:{question}` + `onConflictDoNothing`
  blocks duplicate attempts). The `Idempotency-Key` header is accepted and
  needs no extra handling beyond that.

## Custom test builder

- `lib/test-builder-rules.ts` (pure + tested): `hashSeed`/`mulberry32`/
  `seededShuffle`, `sampleQuestions` (exclude recent when the pool allows,
  else fall back; `null` on exhaustion → 422), `suggestTime` (2 min/MCQ,
  3 min/MSQ+NAT, clamped 5 min..3 h), `scaleDuration` (full-paper pace).
- `lib/test-builder.ts`: `getPoolCount` (count + marks + type mix),
  `buildCustomTest` (sectional with `mode: "custom"`), `listFilterOptions`.
- `GET /api/test-builder/pool?subjects=&topics=&difficulty=&type=` →
  `{ count, totalMarks, mix, suggestedDurationSeconds }` (60/min).
- `POST /api/test-builder` `{ subjectSlugs?, topicSlugs?, difficulty?,
  type?, totalQuestions 5..50, durationSeconds? }` → `201 { sessionId,
  endsAt, practicePath }` (shares the 5/hour creation bucket).
- UI: `/practice/new-test` (`TestBuilderForm` + debounced `PoolCounter`,
  5–50 slider, blank time = suggested).

## Timed mocks

- `lib/mocks-rules.ts` (pure + tested): `computeMockScore` (+marks /
  −negativeMarks / 0 skipped), `isSessionExpired`, `stripQuestionForRunner`
  (shape test pins the secrecy), `paletteStatus`.
- `lib/mocks.ts`: `createMockSession` (full = up to 65Q, sectional needs a
  filter, PYQ needs a year; ≥5 keyed Qs required; duration scaled/suggested
  unless explicit), `getMockSession` (runner payload **without** answers vs
  full result), `answerMockItem` (shape-validated + server-graded on save,
  rejects past `endsAt`), `toggleMarkReview`, `finishMockSession`
  (re-grades everything server-side, writes linked attempts, records
  misses, submitted vs expired by the clock, idempotent), `expireDueMocks`,
  `listMockSessions`.
- API: `POST /api/mocks` (5/hour), `GET /api/mocks`,
  `GET /api/mocks/[id]`, `POST .../answer` (120/min),
  `POST .../mark` (60/min), `POST .../finish` (30/min),
  `POST /api/cron/expire-mocks` (Bearer `CRON_SECRET`, 404 without one).
  Lazy expiry in get/answer/finish means papers close correctly even with
  no cron configured.
- UI: `/mocks` (full/custom/PYQ starters + history), `/mocks/[id]`
  (server shell → `MockRunner` while live → `MockResult` after submit).
  Runner: server-owned countdown (`MockTimer`), live marks from **saved**
  answers only, palette (answered/marked/review + client-side visited),
  per-question save with clock deltas, review toggle, client-only
  calculator, confirm-submit, `beforeunload` guard, auto-submit on timeout,
  resume via server state. Result: score/accuracy/splits, per-question
  review with key + solution + time, drill/mentor links.

## Limits

- create 5/hour; answer 120/min; mark 60/min; finish 30/min; pool 60/min.
  All cheap fail-open with `429 + Retry-After`.

## Verify

- `npm test` (includes `tests/mocks-builder.test.ts`: negative scoring,
  deterministic sampling, exclusion + exhaustion, time clamps, secrecy
  shape, expiry edges, palette, validation).
- `npm run typecheck`, `npm run build`.
- Migration `drizzle/0012_mocks-builder.sql` (enums + 2 tables, additive).
  Apply with `npm run db:migrate`.
