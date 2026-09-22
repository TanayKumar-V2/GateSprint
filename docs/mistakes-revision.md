# Mistakes + Revision (extension 3 + 4)

## Mistake book

- Derived state: `lib/attempts.ts` calls `recordMiss()` on every newly
  recorded incorrect attempt (deduped retries skip it). Nothing else creates
  `mistakes` rows.
- `GET /api/mistakes?tag=&resolved=&page&limit` — owner-scoped list with
  prompt snippet, miss count, tag, resolve state, `correctStreak`, and
  `suggestResolve` (streak ≥ 2, unresolved only).
- `PATCH /api/mistakes/[questionId]` — `{ tag?, resolved? }`. Wrong-owner
  and missing rows both return privacy-preserving 404.
- `POST /api/mistakes/[questionId]/reattempt` — returns `{ practicePath }`,
  no mutation.
- UI: `/mistakes` (filters + `MistakeTable` + `MistakeRowActions`).
  Tag changes and resolve toggles PATCH and refresh.

## Revision queue (v1, computed on read)

- No new table. `lib/revision.ts` merges `attempts + bookmarks + mistakes`
  per user, one item per question.
- Intervals (`lib/revision-rules.ts`, pure + unit-tested):
  - open mistake → 1d / 3d / 7d / 14d by `missCount` (capped at 14d);
  - bookmarked → 2d; clean correct → 28d; incorrect without a mistake row → 1d.
- `GET /api/revision?limit=&page=` → `{ due[], upcoming[], stats, note }`.
  `stats` = `{ dueCount, doneToday, weekDone }` (UTC day / trailing 7d).
- `POST /api/revision/complete` → `{ ok, stillDue, stats }`. Completion is
  derived: re-attempting the question is what moves it; no write in v1.
- UI: `/revision` (`RevisionQueue`, `DueCard`, `RevisionWidget`).
  Empty states are honest ("nothing due", never fake 0%).

## Limits

- `mistakes-list`, `mistakes-patch`, `revision-list`: 60/min per user,
  cheap (fail-open when Redis is down), `429 + Retry-After` on excess.

## Verify

- `npm test` (includes `tests/mistakes-revision.test.ts`: interval math,
  validation, pagination caps, empty-state defaults).
- `npm run typecheck`, `npm run build`.
- Migration `drizzle/0010_mistakes-revision.sql` (new table + enum only,
  expand-and-contract safe). Apply with `npm run db:migrate`.
