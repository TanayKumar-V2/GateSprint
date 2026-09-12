# Sign-in and access control

## How it works

- Google OAuth through Auth.js v5 (`lib/auth.ts`), database sessions stored
  in the `sessions` table via the Drizzle adapter.
- Config: `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.
  Local callback: `http://localhost:3000/api/auth/callback/google` — the
  same URL registered in Google Cloud Console, plus the production URL when
  deployed.
- Every dashboard page sits under `app/(dashboard)/layout.tsx`, which
  redirects signed-out visitors to `/sign-in`. No route guard lives in
  edge middleware on purpose: the database driver used locally
  (`node-postgres`) can't run there.
- `session.user.id` is set server-side in the session callback. Ownership
  checks (`lib/ownership.ts`) always filter by that id — a wrong owner gets
  the same `null` as a missing row, and API responses (`lib/api/respond.ts`)
  use matching 401/403/404 shapes.

## Session and cookie notes

- Cookies are `HttpOnly` + `SameSite=Lax` by default; Auth.js adds the
  `__Secure-` prefix automatically in production (HTTPS).
- Database sessions are re-checked on every request, so signing out (or an
  admin deleting the row) takes effect immediately.
- Google authorization always passes `prompt=select_account` so shared
  devices don't silently reuse the last account.

## Abuse controls

- Sign-in failures are logged as structured events (`area: "auth"`) with
  outcome + provider only — no emails, tokens, or profiles.
- Error text on the sign-in screen is generic and never confirms whether an
  account exists.
- The shared Redis limiter enforces chat budgets; dedicated per-IP
  sign-in throttling is still open — until then, Google's own abuse
  protection plus generic errors are the backstop.

## Local testing without Google keys

If `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` are missing, `/sign-in` shows a
setup hint instead of a broken button. No mock user is ever silently
signed in.

## Rotating credentials

1. Create a new OAuth client (or secret) in Google Cloud Console.
2. Update `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` (and `AUTH_SECRET` if the
   session secret itself is compromised) in Vercel/environment — never in
   the repo.
3. Redeploy, then delete the old client. Existing database sessions stay
   valid unless `AUTH_SECRET` changed, in which case everyone signs in again.
