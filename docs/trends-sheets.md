# Trends + Sheets (extension 6 + 8)

## Weightage + trend view

- `lib/trends-rules.ts` (pure + tested): least-squares `regressionSlope`,
  `trendLabel` (|slope| ≤ 0.5 marks/yr = stable), `topicTrend` (last 5y),
  `zeroFillYears` (every year in range renders, gaps as 0), `missingYears`
  (the coverage-gap notice), `shareOf` (zero-safe).
- `lib/trends.ts`: `getWeightage({ fromYear = currentYear−10, subject? })`
  → `{ subjects[] (with top-3 topics), topics[] (sorted by marks),
  meta { fromYear, toYear, grandTotalMarks, missingYears, note } }`.
  No new tables — computed from `questions(year, marks, subject, topic,
  published)`. Cached in-memory 1 h (`lib/api/cache.ts`, per-instance)
  plus `Cache-Control: public, s-maxage=3600, stale-while-revalidate=600`.
- `GET /api/trends?fromYear=&subject=` (30/min, auth required, no user
  data inside so edge caching is safe).
- UI: `/trends` (`TrendTable`, `WeightageBar`, `YearSparkline` — static
  SVG, no chart library), subject filter, top-topics-by-marks with
  rising/stable/falling badges + practice links, honest coverage-gap note.
  Disclaimer printed on the page: derived from bank coverage, not the
  official GATE key.

## Formula / one-shot sheets + recall quiz

- `sheets` (one Markdown doc per topic, versioned) + `sheetRevisions`
  (one tick per user/sheet/UTC-day via the `day` column — the drizzle
  equivalent of the spec's `unique(user, sheet, revisedAt::date)`).
- `lib/sheets.ts`: `getSheet` (topic + sheet + `revisedToday`),
  `upsertSheet` (admin, version bump), `markRevised` (idempotent per day),
  `startSheetQuiz` (topic Mentor session + sheet as a delimited, truncated
  system message), `listSheetsIndex`, `resolveTopicBySlug` (exactly-1
  match — never guesses on cross-subject slug collision).
- `lib/chat.ts`: `buildGenerationInput` now appends stored
  `system`-role messages to the system prompt (backward-compatible: none
  existed before). The mentor thread already filters display to
  user/assistant, so sheet context stays hidden from view but reaches the
  model. Truncation budget `SHEET_CONTEXT_CHARS` (6000) in
  `lib/sheets-rules.ts`, cuts at a line boundary and says so.
- API: `GET /api/sheets/[topicSlug]`, `POST .../revise` → `{ sessionId,
  mentorPath }` (10/hour), `POST .../revised` → `{ ok }`,
  `PUT /api/admin/sheets/[topicId]` (admin-guarded via `lib/admin.ts`,
  10–60000 chars of Markdown).
- UI: `/sheets` index (per-topic availability), `/sheets/[topicSlug]`
  (`SheetRenderer` reuses the Markdown/KaTeX renderer, `SheetQuizButton`,
  `SheetRevisedButton`, print-friendly styles + print button). Missing
  sheets get an honest empty state, not a placeholder doc.
- Content pipeline `tools/sheets/scaffold.ts`: drafts a review scaffold
  from a topic's PYQs + curated solutions into `tools/sheets/drafts/`.
  **Never writes the DB** — an admin rewrites it dense and publishes via
  PUT. Never auto-publish AI sheets.

## Limits

- trends 30/min; sheet quiz 10/hour. Cheap fail-open, `429 + Retry-After`.

## Verify

- `npm test` (includes `tests/trends-sheets.test.ts`: trend directions,
  stability epsilon, zero-fill, coverage gaps, context delimiting +
  truncation, UTC day keys, validation bounds).
- `npm run typecheck`, `npm run build`.
- Migration `drizzle/0013_sheets.sql` (2 tables, additive).
  Apply with `npm run db:migrate`.
