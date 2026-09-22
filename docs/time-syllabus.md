# Time analytics + Syllabus (extension 5 + 9)

Both read-only honest views over `attempts`. No new flows, no fake stats.

## Time analytics

- `lib/time-analytics-rules.ts` (pure + unit-tested): `median`,
  `percentile` (p90), `average`, `summarize` (aggregate-only shape
  `{ avg, median, p90, n }` — no user rows), `classifyAttempt`.
- Thresholds (`lib/constants.ts`, env-tunable, shown in UI tooltips):
  - rushed: wrong + under `TIME_RUSHED_SECONDS` (30s);
  - overtime: wrong + past `max(TIME_OVERTIME_MIN_SECONDS, 3× peer median)`;
  - slow_correct: right + past `max(180s, 2× median)` — revision candidate.
- `lib/time-analytics.ts`: `getTimeBySubject`, `getTimeByTopic`,
  `getQuestionMedians` (global anonymized aggregates via `inArray` batches —
  never another user's rows), `flagAttempts`, `getTimeAnalytics`.
  Null `timeTakenSeconds` are skipped everywhere, never treated as 0.
- `GET /api/progress/time?subject=` → `{ bySubject[], byTopic[], flags[] }`
  (30/min per user, `no-store`).
- UI: `/progress/time` (tab next to Overview) with avg/median cards, topic
  breakdown, static SVG scatter (`TimeScatter`, lanes correct/wrong, exact
  values in `TimeTable`), pace-flag table with your-time-vs-median.

## Syllabus tracker

- `lib/syllabus-rules.ts` (pure + unit-tested): `topicStatus` —
  not-started at 0 attempts; exam-ready at 5+ attempts AND 80%+ accuracy AND
  80%+ coverage; else in-progress. Zero-question topics never divide by zero
  and never fake ready. Thresholds env-tunable in `lib/constants.ts`.
- `lib/syllabus.ts`: `getSyllabus` (subjects → topics with accuracy,
  attempts, coverage, override, practice/revise paths; overall readiness
  `{ examReadyTopics, totalTopics, pct }`), `setTopicOverride`,
  `resolveTopicId` (topic slug + optional subject slug disambiguation).
- `GET /api/syllabus` (30/min) and `PATCH /api/syllabus/topic`
  `{ topicSlug, subjectSlug?, override: "skipped" | "focus" | null }`.
  Overrides are display badges only — stats always recompute from attempts.
- UI: `/syllabus` (`ReadinessBar`, `SyllabusGrid`, `TopicStatusPill`,
  `TopicOverrideToggle`). Rules printed in the page header tooltip.

## Limits

- `progress-time`, `syllabus`: 30/min per user; `syllabus-patch`: 60/min.
  Cheap (fail-open), `429 + Retry-After` on excess.

## Verify

- `npm test` (includes `tests/time-syllabus.test.ts`: null-time handling,
  empty medians, flag boundary edges, threshold edges, zero-division safe,
  override-can't-pollute-stats, validation).
- `npm run typecheck`, `npm run build`.
- Migration `drizzle/0011_syllabus-overrides.sql` (new table + enum only).
  Apply with `npm run db:migrate`.
