# Gate Sprint Extensions — 9 Aspirant-Requested Features

Source: serious GATE CS/IT aspirant feedback. Goal: turn single-question practice into rank-oriented exam preparation: practice -> analyze -> revise -> retest under pressure.

Conventions (follow existing codebase):
- `db/schema.ts` Drizzle + `drizzle/` migration, expand-and-contract, no destructive migrations.
- `lib/*` `server-only`, owner-scoped, Zod at every Route Handler boundary in `lib/validation/*`.
- Route Handlers in `app/api/*`, consistent JSON error shape `{ error, message }`, `401/403/404/400|422/429`.
- Reuse `gradeMcq/gradeMsq/gradeNat` in `lib/validation/answers.ts`, `evaluateWeakTopic` in `lib/recommend-rules.ts`, `checkLimit/consumeBudget` in `lib/security/rate-limit.ts`.
- Never trust client `isCorrect`, scores, stats, or context. Reload server-side.

Shared infra needed by all 9:
- `lib/validation/extension.ts`: Zod schemas for all new endpoints.
- `lib/time.ts`: `now()`, `clampInt()`, `toSeconds()`.
- New rate-limit buckets in `lib/security/rate-limit.ts` (see each feature).
- Tests in `tests/`: unit + integration per feature. No security/ownership test skipped.

---

## 1. Timed Mocks with Real GATE UI

**Why:** Single untimed attempts don't train pacing, negative-marking temperament, or 3-hr stamina.

**UX:**
- `app/(dashboard)/mocks/page.tsx`: list (Full 65Q/100M/180min, Sectional, PYQ Year Paper), Start button.
- `app/(dashboard)/mocks/[mockSessionId]/page.tsx`: Server Component shell + `use client` runner:
  - Top bar: timer countdown, marks obtained (live, without revealing answers), Submit.
  - Left: question render (reuse MCQ/MSQ/NAT controls + images via `/api/questions/[id]/images/[imageId]`).
  - Right: question palette (answered / not-answered / marked-for-review / answered+marked), jump on click.
  - Virtual calculator (client-only, no server dependency), mark-for-review toggle.
  - Auto-submit on timeout, `beforeunload` guard, resume on reconnect.
- Result page: score, accuracy, time per Q, subject split, solutions locked until finish.

**Data model (`db/schema.ts`):**
```ts
mockTypeEnum: ["full", "sectional", "pyq_year"]
mockStatusEnum: ["in_progress", "submitted", "expired", "abandoned"]
mockSessions: id uuid PK, userId text FK users.cascade, type mockType, title text, totalMarks real, durationSeconds int, startedAt timestamp, endsAt timestamp, submittedAt timestamp nullable, status mockStatus default in_progress, config jsonb {subjectIds, topicIds, year, questionIds snapshot}, score real nullable, createdAt/updatedAt
mockSessionItems: id uuid PK, sessionId uuid FK mockSessions.cascade, questionId uuid FK questions.restrict, position int, status enum? use text: ["unvisited","unanswered","answered","marked","answered_marked"], selectedAnswer jsonb nullable, isCorrect bool nullable, timeTakenSeconds int default 0, markedForReview bool default false, updatedAt
indexes: mockSessions(userId, createdAt), mockSessionItems(sessionId, position), unique(sessionId, questionId)
```

**Lib (`lib/mocks.ts`, `server-only`):**
- `createMockSession(userId: string, input: { type, subjectSlugs?, topicSlugs?, year?, totalQuestions?, durationSeconds? }) => { sessionId, endsAt }` — validates bank has enough published Qs, snapshots `questionIds` with `rankQuestions()` distribution (easy->hard), sets `endsAt = now + duration`.
- `getMockSession(userId, sessionId) => { meta, items: [{ itemId, questionViewWithoutAnswer, status }] }` — hides `correctAnswer/solution` until submitted. Enforces ownership.
- `answerMockItem(userId, sessionId, itemId, answer: SubmittedAnswer, timeTakenSeconds) => { saved }` — shape-validates (same as `submitAttempt`), upserts `selectedAnswer`, updates palette status, extends `timeTakenSeconds`. Rejects if `now > endsAt` or `status != in_progress`.
- `toggleMarkReview(userId, sessionId, itemId, marked: boolean)`
- `finishMockSession(userId, sessionId) => { score, correct, incorrect, skipped, subjectSplit }` — recomputes all `isCorrect` server-side via `gradeMcq/Msq/Nat`, applies `marks/negativeMarks`, writes `score`, flips `status=submitted`, creates linked `attempts` rows (one per item, `clientKey = mock:{sessionId}:{questionId}`) so Progress/Mistake-book stay in sync. Idempotent.
- `expireDueMocks()` — cron/worker: `in_progress + now > endsAt => expired + auto-finish`.

**API:**
- `POST /api/mocks` `{ type, subjectSlugs?, topicSlugs?, year?, totalQuestions?, durationSeconds? }` -> `201 { sessionId, endsAt, practicePath }` | `400/422`. Limit: `5/hour` per userId.
- `GET /api/mocks` `?page&limit` -> list with `status/score`.
- `GET /api/mocks/[id]` -> runner payload (no answers if in_progress).
- `POST /api/mocks/[id]/answer` `{ itemId, answer, timeTakenSeconds? }` -> `{ saved }`. Limit `120/min` per user.
- `POST /api/mocks/[id]/mark` `{ itemId, marked }`
- `POST /api/mocks/[id]/finish` `{}` -> result. Idempotency-Key header supported.

**Components (`components/mocks/`):** `mock-runner.tsx`, `mock-timer.tsx`, `question-palette.tsx`, `virtual-calculator.tsx`, `mock-result.tsx`, `mock-list.tsx`.

**Tests:** scoring with negatives, auto-submit expiry, answer hidden pre-submit, cross-user 404, idempotent double-finish.

---

## 2. Custom Test Builder

**Why:** Aspirant wants to drill exact weak mix under time pressure.

**UX:** `app/(dashboard)/practice/new-test/page.tsx`: multi-select subjects/topics, difficulty, type, count (5-50), time per Q or total time, `Generate` -> creates `mockSessions(type=sectional)` -> redirect to runner. Show estimated marks + available pool count live (`GET /api/questions?count-only`).

**Data model:** Reuses `mockSessions/mockSessionItems` (no new tables). Add `config` fields: `{ mode: "custom", filters, timePolicy }`.

**Lib (`lib/test-builder.ts`):**
- `getPoolCount(filters) => number` — counts published Qs matching filters.
- `buildCustomTest(userId, filters: QuestionFilter & { totalQuestions: 5..50, durationSeconds: 300..10800 }) => sessionId` — validates pool >= requested, samples via `rankQuestions()` + seeded shuffle (avoid same set repeat: exclude last 3 sessions' Qs if pool allows).
- `suggestTime(totalQuestions, difficultyMix) => durationSeconds` — default 2 min/MCQ, 3 min/MSQ+NAT.

**API:**
- `GET /api/test-builder/pool?subject=&topic=&difficulty=&type=` -> `{ count }`
- `POST /api/test-builder` same body as `POST /api/mocks` with `type=sectional` -> `{ sessionId }`

**Components:** `test-builder-form.tsx`, `pool-counter.tsx`.

**Tests:** pool exhaustion 422, no-repeat sampling, invalid time clamped.

---

## 3. Auto Mistake-Book with Reason Tagging

**Why:** Wrong attempts scatter across Practice/Progress. Need one revision inbox.

**UX:** `app/(dashboard)/mistakes/page.tsx`: filter by tag/subject/topic, sort by `lastMissed`, each row: prompt snippet, your answer vs correct (after reveal), `Re-attempt`, `Ask Mentor`, tag dropdown, resolve toggle. `Re-attempt` opens question; on correct twice in a row auto-suggest resolve.

**Data model:**
```ts
mistakeTagEnum: ["concept_gap","silly_mistake","trap","time_pressure","unattempted"]
mistakes: id uuid PK, userId text FK cascade, questionId uuid FK cascade, tag mistakeTag nullable, missCount int default 1, lastMissedAt timestamp, resolved bool default false, resolvedAt timestamp nullable, createdAt, updatedAt
unique(userId, questionId), index(userId, resolved, lastMissedAt)
```
Derived, not manually created: upserted on every incorrect `submitAttempt` / `finishMockSession`.

**Lib (`lib/mistakes.ts`):**
- `recordMiss(userId, questionId)` — upsert, `missCount+1`, `lastMissedAt=now`, `resolved=false` if re-missed.
- `recordCorrect(userId, questionId)` — if `mistakes` open, increment `correctStreak` (in-memory calc from `attempts` last 2); no auto-resolve, only suggest.
- `listMistakes(userId, { tag?, subject?, topic?, resolved?, page, limit })`
- `setMistakeTag(userId, questionId, tag | null)`
- `setMistakeResolved(userId, questionId, resolved: boolean)`
- `getMistakeStats(userId) => { open, byTag, bySubject }`

**API:**
- `GET /api/mistakes?tag=&subject=&resolved=&page&limit`
- `PATCH /api/mistakes/[questionId]` `{ tag?, resolved? }`
- `POST /api/mistakes/[questionId]/reattempt` -> `{ practicePath }` (convenience redirect, no mutation)

**Components:** `mistake-table.tsx`, `mistake-tag-select.tsx`, `mistake-filters.tsx`.

**Tests:** miss upsert idempotent, correct doesn't auto-resolve, cross-user isolation.

---

## 4. Spaced Revision Queue (Due Today)

**Why:** Bookmarks are static; memory decays. Need `Due today: N`.

**UX:** Dashboard widget + `app/(dashboard)/revision/page.tsx`: `Due (12) | Upcoming | Done`, each card: why-due reason (`Missed 3d ago · 2 misses`, `Saved · weak topic`, `Correct 28d ago · fading`), `Practice` + `Revise with Mentor`. `Done` on re-attempt. Streak of days revised (honest count, no fake XP).

**Data model:** No new table v1 (compute from `attempts+bookmarks+mistakes`). Add if history needed later:
```ts
revisionLogs: id uuid PK, userId FK, questionId FK, dueAt timestamp, completedAt timestamp nullable, reason text
index(userId, dueAt)
```
v1 computes on read; v2 persists for analytics.

**Lib (`lib/revision.ts`):**
- `getDueRevisions(userId, { limit=20, page=1 }) => { due: Recommendation[], upcoming, stats }`
- Intervals: incorrect -> due in `1d, 3d, 7d, 14d`; bookmarked weak -> `2d`; correct -> `28d` refresh. Formula: `nextDue(lastAttemptAt, isCorrect, missCount, bookmarked)`.
- `completeRevision(userId, questionId)` — logs attempt counts as completion; no separate write in v1.
- `getRevisionStats(userId) => { dueCount, doneToday, weekDone }`

**API:**
- `GET /api/revision?limit=&page=` -> `{ due[], upcoming[], stats, note }`
- `POST /api/revision/complete` `{ questionId }` -> `{ ok }` (v2; v1 returns derived state)

**Components:** `revision-queue.tsx`, `due-card.tsx`, `revision-widget.tsx` (dashboard).

**Tests:** interval math, dedupe (same Q once), empty-state note, no-repeat until set done.

---

## 5. Time Analytics (Speed vs Accuracy)

**Why:** Accuracy without pace fails in GATE. Need to see overtime kills.

**UX:** `app/(dashboard)/progress/time/page.tsx` (tab in Progress): avg sec/Q by subject/topic, scatter `time vs correctness`, flags: `Too fast + wrong (<30s)`, `Overtime + wrong (>3x median)`, `Slow + correct (revision candidate)`. Per-question table with `your time vs median`.

**Data model:** Reuses `attempts.timeTakenSeconds + startedAt/submittedAt`. Add materialized helper, no new table v1. Optional cache:
```ts
topicTimeStats: topicId uuid, medianSeconds int, p90Seconds int, updatedAt — refreshed nightly via `tools/` script.
```

**Lib (`lib/time-analytics.ts`):**
- `getTimeBySubject(userId) => [{ subjectSlug, avgSeconds, medianSeconds, attempts }]`
- `getTimeByTopic(userId) => [...]`
- `getQuestionMedians(questionIds) => Map<questionId, { median, p90, n }>` — global anonymized aggregate, never exposes other users' rows.
- `flagAttempts(userId, { limit=50 }) => [{ questionId, yourSeconds, median, flag: "rushed"|"overtime"|"slow_correct"|"ok" }]`
- Thresholds: `rushed <30s + incorrect`, `overtime > max(180s, 3*median)`, env-tunable in `lib/constants.ts`.

**API:**
- `GET /api/progress/time?subject=` -> `{ bySubject[], byTopic[], flags[] }`

**Components:** `time-table.tsx`, `time-scatter.tsx` (reuse visx already in deps), `flag-badge.tsx`.

**Tests:** null time handling, median with n=0, no cross-user leak in medians.

---

## 6. Weightage + Trend View (Last 10 Years)

**Why:** Prioritize last 60 days by marks, not vibes.

**UX:** `app/(dashboard)/trends/page.tsx`: per subject: total marks last 10y, sparkline by year, top topics by marks, `rising/stable/falling` badge, link `Practice this topic`. Disclaimer: derived from bank coverage, not official GATE key.

**Data model:** No new tables. Computed from `questions(year, marks, subjectId, topicId, isPublished)`. Cache in-memory 1h via `lib/api/cache.ts` or Redis.

**Lib (`lib/trends.ts`):**
- `getWeightage({ fromYear = currentYear-10 }) => { subjects: [{ slug, name, totalMarks, byYear: [{year, marks, count}], share }], topics: [{ slug, subjectSlug, totalMarks, byYear }] }`
- `getTopicTrend(topicId) => { slope, label: "rising"|"stable"|"falling" }` — simple linear regression on last 5y marks.
- `getCoverageWarning() => { missingYears: number[] }` — honest gap notice if bank incomplete.

**API:**
- `GET /api/trends?fromYear=&subject=` -> weightage JSON, `Cache-Control: s-maxage=3600`.

**Components:** `trend-table.tsx`, `weightage-bar.tsx`, `year-sparkline.tsx`.

**Tests:** marks sum correct, empty-year zero-fill, coverage warning triggers.

---

## 7. Mentor Generates Variant Questions (Quiz Me)

**Why:** Close loop: explain -> new similar Qs -> retest without leaving chat.

**UX:** In Mentor session: `/quiz` command or `Generate practice` button (weak-topic + question sessions). Mentor replies with 2-3 variants as structured cards (not just prose), each with `Try` -> inline MCQ/MSQ/NAT widget -> instant grade -> `Explain`. Variants marked `AI-generated · unreviewed` until solved/verified.

**Data model:**
```ts
generatedQuestions: id uuid PK, sessionId uuid FK chatSessions.cascade, userId text FK, prompt text, type questionType, options jsonb nullable, correctAnswer jsonb, difficulty difficulty default medium, topicId uuid FK nullable, verified bool default false, createdAt
index(sessionId, createdAt)
```

**Lib (`lib/variants.ts` + `lib/ai/variant-router.ts`):**
- `requestVariants(userId, sessionId, { count=3, difficulty? }) => variants[]` — loads `buildQuestionContext/buildTopicContext`, calls Groq primary->fallback (same policy as chat), Zod-parses model JSON `{ prompt, type, options, correctAnswer }`, shape-validates via `answers.ts`, persists to `generatedQuestions`. Reuses chat budgets.
- `answerVariant(userId, variantId, answer) => { isCorrect, correctAnswer }` — grades via `gradeMcq/Msq/Nat`, marks `verified=true` on first correct grading path.
- `promoteVariant(variantId)` (admin only, `lib/admin.ts`): copy to `questions` as unpublished for review.

**API:**
- `POST /api/chat/sessions/[id]/variants` `{ count?, difficulty? }` -> `{ variants: [{ id, prompt, type, options }] }` (no answers in list).
- `POST /api/variants/[id]/answer` `{ answer }` -> `{ isCorrect, correctAnswer }`
- Rate limit: count against `CHAT_MINUTE_LIMIT + CHAT_DAILY_BUDGET`, plus `5 variant-sets/hour`.

**Prompt (`lib/prompts/variant-prompt.ts`):** strict JSON-only, same topic/concept, same difficulty, no repeat of source Q, tolerance for NAT, 2-4 options for MCQ/MSQ.

**Components:** `variant-card.tsx`, `variant-quiz.tsx`, `generate-variants-button.tsx`.

**Tests:** JSON parse fail -> friendly error, no answer leak, ownership, budget enforcement, malformed variant rejected pre-persist.

---

## 8. Formula / One-Shot Sheets + Recall Quiz

**Why:** Last-mile revision needs 2-page dense sheets, not 30-min explanations.

**UX:** `app/(dashboard)/sheets/[topicSlug]/page.tsx`: curated sheet (formulas, traps, 5 PYQ patterns), `Quiz me` -> Mentor revision session scoped to sheet. Print-friendly CSS. `Mark as revised`.

**Data model:**
```ts
sheets: id uuid PK, topicId uuid FK unique, contentMd text, version int default 1, updatedAt, updatedBy text nullable
sheetRevisions: id uuid PK, userId FK, sheetId FK, revisedAt timestamp defaultNow
unique(userId, sheetId, revisedAt::date) — one per day
```

**Lib (`lib/sheets.ts`):**
- `getSheet(topicSlug) => { contentMd, version, updatedAt } | null`
- `upsertSheet(adminId, topicId, contentMd)` — admin only, bumps `version`.
- `markRevised(userId, sheetId)` — idempotent per day.
- `startSheetQuiz(userId, topicId) => sessionId` — creates `chatSessions(sourceTopicId)` + system context = sheet content (delimited, truncated to budget).

**API:**
- `GET /api/sheets/[topicSlug]`
- `POST /api/sheets/[topicSlug]/revise` -> `{ sessionId, mentorPath }`
- `POST /api/sheets/[topicSlug]/revised` -> `{ ok }`
- `PUT /api/admin/sheets/[topicId]` admin-guarded via `lib/admin.ts`.

**Content pipeline (`tools/sheets/`):** seed from existing `solutions` + Mentor, human review required before `isPublished`-equivalent flag. Never auto-publish AI sheets.

**Components:** `sheet-renderer.tsx` (reuse Markdown/KaTeX renderer), `sheet-quiz-button.tsx`.

**Tests:** admin-only write, revise idempotent, sheet context truncated to input cap.

---

## 9. Syllabus Tracker Linked to Real Progress

**Why:** Manual checklists lie. Tracker should derive from attempts.

**UX:** `app/(dashboard)/syllabus/page.tsx`: 12 subjects -> topics, each: status pill `not-started / in-progress / exam-ready`, `accuracy · attempts · coverage`, `Practice` + `Revise`. Overall readiness bar. No manual ticks v1.

**Data model:** No new tables v1. Derives from `subjects/topics/questions/attempts` via `getProgress()`. Optional override:
```ts
topicOverrides: userId FK, topicId FK, status text ["skipped","focus"], updatedAt, unique(userId, topicId)
```

**Lib (`lib/syllabus.ts`):**
- `getSyllabus(userId) => { subjects: [{ slug, name, status, accuracy, attemptedQuestions, totalQuestions, topics: [{ slug, name, status, accuracy, attempts }] }], overall: { examReadyTopics, totalTopics, pct } }`
- Rules (env-tunable, transparent in UI tooltip):
  - `not-started`: 0 attempts
  - `in-progress`: >0 attempts AND (accuracy <80% OR coverage <80% of topic Qs)
  - `exam-ready`: >=5 attempts AND accuracy >=80% AND coverage >=80%
- `setTopicOverride(userId, topicSlug, status | null)`

**API:**
- `GET /api/syllabus` -> syllabus JSON
- `PATCH /api/syllabus/topic` `{ topicSlug, override? }`

**Components:** `syllabus-grid.tsx`, `readiness-bar.tsx`, `topic-status-pill.tsx`.

**Tests:** threshold edges, zero-division safe, override doesn't pollute stats.

---

## Execution Order (recommended)

1. Mistakes (3) + Revision (4) — highest ROI, reuses `attempts`, unlocks retention.
2. Time analytics (5) + Syllabus (9) — read-only, no new flows, makes Progress honest.
3. Custom builder (2) -> Mocks (1) — builder validates runner; mocks reuse builder.
4. Trends (6) + Sheets (8) — content + analytics, parallelizable.
5. Variants (7) — needs most prompt + safety work, do last.

Each PR: migration + lib + API + UI + tests + docs update in `docs/`. Gate merges on `lint/typecheck/test/build + ownership tests + 429 tests`.
