import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getProgress } from "./progress";
import { isValidUsername, usernameCandidate } from "./username";

export type Profile = {
  user: {
    id: string;
    name: string | null;
    username: string;
    email: string | null;
    image: string | null;
    createdAt: Date;
  };
  progress: Awaited<ReturnType<typeof getProgress>>;
};

/**
 * Public profile for /u/[username]. Returns null for malformed handles
 * and unknown users alike — the page maps both to notFound() so handle
 * enumeration learns nothing beyond what a 404 already says.
 */
export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const handle = username.toLowerCase();
  if (!isValidUsername(handle)) return null;
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      email: users.email,
      image: users.image,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.username, handle))
    .limit(1);
  const row = rows[0];
  if (!row || !row.username) return null;
  return {
    user: {
      id: row.id,
      name: row.name,
      username: row.username,
      email: row.email,
      image: row.image,
      createdAt: row.createdAt,
    },
    progress: await getProgress(row.id),
  };
}

/**
 * Assign a unique handle to a user missing one (backfill + new sign-ups).
 * Retries the candidate with a numeric suffix until the unique index
 * accepts it; the suffix loop is bounded because every attempt either
 * succeeds or proves the candidate taken.
 */
export async function ensureUsername(
  userId: string,
  name: string | null,
  email: string | null,
): Promise<string> {
  const base = usernameCandidate(name, email);
  const existing = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (existing[0]?.username) return existing[0].username;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 0 ? "" : `_${attempt + 1}`;
    const candidate = `${base.slice(0, 30 - suffix.length)}${suffix}`;
    try {
      // No .returning(): the Neon HTTP driver path used in production
      // does not support it on updates (see lib/attempts.ts convention).
      await db
        .update(users)
        .set({ username: candidate, updatedAt: new Date() })
        .where(eq(users.id, userId));
      return candidate;
    } catch {
      // Unique violation: another user holds this handle, try the next.
    }
  }
  throw new Error("Could not assign a username.");
}
