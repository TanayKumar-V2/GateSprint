# Running Gate Sprint

## Backups

- **Neon**: enable point-in-time restore / scheduled backups in the Neon
  console before launch. Before any destructive migration: snapshot, run
  `db:migrate` against a staging branch first, keep the previous Vercel
  deployment while you verify.
- **What restores what**: the database holds everything (questions,
  attempts, chats). No app-local state exists, so redeploying Vercel is
  always safe; only the database needs a recovery plan.

## Rotating secrets

1. `AUTH_SECRET`: generate a new value, update Vercel, redeploy. Everyone
   is signed out once — that is expected.
2. `AUTH_GOOGLE_*`: add the new OAuth client/secret alongside the old one
   in Google Cloud Console, update Vercel, verify login, then delete the
   old client.
3. `GROQ_API_KEY`: create the new key, update Vercel, verify one Mentor
   reply, delete the old key. A wrong key surfaces as failed generations
   (never fallback-masked — auth errors don't trigger fallback).
4. `UPSTASH_*`: rotate in Upstash, update Vercel. Until the new values
   land, AI generation fail-closes (503s) while reads keep working.

## Incident checklist

- **Cost spike / abuse**: tighten `CHAT_MINUTE_LIMIT` / `CHAT_DAILY_BUDGET`
  via env redeploy (no code change). Look for `rate-limited` and
  `provider-fallback` security events to find the accounts.
- **Groq outage**: the fallback covers primary-only outages automatically.
  If both models are down, students get a friendly retry message and no
  data is lost. Set `GROQ_FALLBACK_ENABLED=false` only to diagnose, then
  turn it back on.
- **Suspected data exposure**: rotate `AUTH_SECRET` (invalidates all
  sessions), review `ownership-denied` events, check Vercel + Neon access
  logs. The app never logs chat content, keys, or raw identifiers, so
  application logs are safe to share with investigators after redacting
  the hashed identity prefixes.
- **Bad deploy**: Vercel keeps every deployment — instant rollback from
  the dashboard. Database migrations are additive, so rolling back app
  code never breaks the schema.

## Watching it day to day

- Security events (`area: "security"`) cover rate limits, auth failures,
  ownership denials, provider failures/fallbacks, and rejected requests.
- Alert thresholds to start with: >50 rate-limit hits/hour from one
  hashed identity, any `provider-failure` burst, or fallback active for
  more than 30 minutes (means the primary may be down, not spiky).
