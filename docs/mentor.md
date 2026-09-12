# Mentor

## Prompt

`lib/prompts/mentor-system-prompt.ts` (currently v1.0.0) is the only place
teaching instructions live. Bump the version on any wording change.

Voice: a veteran GATE CSE mentor (1000+ students into IITs/PSUs) tuned for
speed-to-clarity — the crux in the first lines, then the full reasoning.

## Where question context lives (decision)

Source context (question, options, answers, attempt, solution, topic
progress) travels as a delimited block appended to the **system prompt**,
built server-side per generation (`lib/prompts/context-builder.ts`).

It is deliberately NOT stored as a fake user-visible message: that would
duplicate untrusted content into the transcript, confuse history, and
invite injection. The chat UI shows the same linkage separately through
the source panel, which never includes answers.

## Models

Primary `openai/gpt-oss-20b`, one automatic fallback to
`openai/gpt-oss-120b` for availability failures only (unknown model,
overload, 5xx, timeouts) — never for bad input, auth, or app bugs.
`lib/ai/model-router.ts` owns the policy; every assistant message records
`modelUsed` + `fallbackUsed`.

Two behaviors of the installed AI SDK shaped the implementation (verified
live, not assumed): stream consumers never receive provider errors (a dead
model just ends the stream silently), while `generateText` rejects with
the real error. So the router commits on first text and probes failures
with a 1-token call before deciding. Revisit if the SDK is upgraded.

## Budgets and limits

10 sessions/hour, 10 generations/minute, 100/day per user (env-tunable:
`SESSION_HOURLY_LIMIT`, `CHAT_MINUTE_LIMIT`, `CHAT_DAILY_BUDGET`).
Inputs capped at 4000 chars, history at 30 messages, replies at 1500
tokens, provider timeout 45s. Retries reuse the user message row and
append a fresh reply.
