import "dotenv/config";
import { Pool } from "pg";

// Backfill: give every user missing a handle a unique one, derived from
// name/email the same way lib/profile.ts ensureUsername does for sign-ups.
function candidate(name: string | null, email: string | null): string {
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

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString: url });
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email FROM users WHERE username IS NULL ORDER BY created_at`,
    );
    console.log(`Users missing a username: ${rows.length}`);
    let assigned = 0;
    for (const u of rows as { id: string; name: string | null; email: string | null }[]) {
      const base = candidate(u.name, u.email);
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const suffix = attempt === 0 ? "" : `_${attempt + 1}`;
        const handle = `${base.slice(0, 30 - suffix.length)}${suffix}`;
        try {
          await pool.query(`UPDATE users SET username = $1 WHERE id = $2`, [handle, u.id]);
          console.log(`${u.email ?? u.id} -> @${handle}`);
          assigned += 1;
          break;
        } catch {
          // Taken — try the next suffix.
        }
      }
    }
    console.log(`Assigned ${assigned} usernames.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
