# Variant questions / Quiz-me (extension 7)

Closes the loop inside Mentor: explain → fresh similar questions → retest
without leaving chat.

## Generation

- `lib/prompts/variant-prompt.ts`: strict JSON-only contract — same
  topic/concept/difficulty as the source, never a repeat, 2–4 options for
  MCQ/MSQ, NAT tolerance included, `$`/`$$` math.
- `lib/ai/variant-router.ts`: one-shot generation with the **same policy
  as chat** (primary first, exactly one fallback, availability failures
  only — never bad input/auth/app bugs).
- `lib/variants.ts` `requestVariants`: ownership check → session must be
  question- or topic-sourced (server reloads `buildQuestionContext` /
  `buildTopicContext`, never client text) → generate → `extractJsonArray`
  → **every variant shape-validated BEFORE any persist** (dangling option
  ids, kind mismatches, NAT options/tolerance rejected) → persist valid
  ones → save an assistant summary message so the set counts against the
  daily chat budget. Zero valid → friendly error, nothing saved.
- `POST /api/chat/sessions/[sessionId]/variants` `{ count 1-3, difficulty? }` →
  `{ variants: [{ id, prompt, type, options }] }` — **no answers in list
  payloads** (shape pinned by a test). Budgets: shared `chat-generate`
  minute bucket + daily model budget + 5 variant-sets/hour. `GET` on the
  same path lists existing sets.
- UI: `VariantSection` (question/topic sessions only) with
  `GenerateVariantsButton` + `VariantQuiz` cards. Typing `/quiz` in chat
  routes through the same endpoint; cards refresh via event. Every card
  carries AI-GENERATED · UNREVIEWED until a correct retest flips it.

## Retest

- `POST /api/variants/[id]/answer` `{ answer }` → `{ isCorrect,
  correctAnswer }`. Owner-scoped, option-existence checked, graded via
  `gradeMcq/Msq/Nat`. Keys are revealed with the verdict here — variants
  are instant retests, not exams. First correct grading path marks
  `verified=true`.
- `EXPLAIN` on a card dispatches `mentor:explain`; the chat thread sends
  it as the next user message (decoupled siblings, one listener).
- Admin: `promoteVariant` copies a vetted variant into `questions` as
  **unpublished** (`PUT`-style review still happens on the admin page).
  Exposed as `POST /api/admin/variants/[id]/promote` (admin-guarded,
  taxonomy-validated). No auto-publish path exists.

## Limits

- Shared chat minute bucket (expensive fail-closed) + daily budget +
  5 sets/hour; answer grading 60/min cheap fail-open.

## Verify

- `npm test` (includes `tests/variants.test.ts`: fence/prose-tolerant
  parse + friendly nulls, malformed rejection pre-persist, list-projection
  secrecy, endpoint validation bounds).
- `npm run typecheck`, `npm run build`.
- Migration `drizzle/0014_variants.sql` (1 table + index, additive).
  Apply with `npm run db:migrate`.
