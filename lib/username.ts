/* Public handle rules for /u/[username] profiles.
 * Pure helpers — no database, no I/O — so they are unit-testable.
 * Uniqueness against the users table lives in lib/profile.ts.
 */

export const USERNAME_RE = /^[a-z0-9_]{3,30}$/;

/** True when the handle may appear in a profile URL. */
export function isValidUsername(value: string): boolean {
  return USERNAME_RE.test(value);
}

/**
 * Best-effort handle from a name or email. Lowercases, swaps separators
 * for underscores, drops anything else, and clamps to 3–30 chars so the
 * result usually passes isValidUsername without further edits.
 */
export function usernameCandidate(name: string | null, email: string | null): string {
  const raw = (name?.trim() || email?.split("@")[0]?.trim() || "user").toLowerCase();
  const slug = raw
    .replace(/[\s.-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
  if (slug.length >= 3) return slug;
  return `${slug || "user"}_user`.slice(0, 30);
}
