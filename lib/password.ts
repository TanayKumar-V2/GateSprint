import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { BinaryLike, ScryptOptions } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { checkRateLimit } from "./security/rate-limit";

function scryptAsync(
  password: BinaryLike,
  salt: BinaryLike,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derived) => {
      if (err) reject(err);
      else resolve(derived as Buffer);
    });
  });
}
// OWASP-aligned interactive-login parameters.
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEYLEN = 32;

/** scrypt hash in `scrypt$N$r$p$saltHex$keyHex` form. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(password, salt, KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })) as Buffer;
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/** Constant-time comparison. False for malformed hashes and bad passwords. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const saltHex = parts[4] ?? "";
  const keyHex = parts[5] ?? "";
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }
  try {
    const expected = Buffer.from(keyHex, "hex");
    if (expected.length === 0 || saltHex.length === 0) return false;
    const derived = (await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length, {
      N: n,
      r,
      p,
      maxmem: 64 * 1024 * 1024,
    })) as Buffer;
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Credential check for email+password auth. Null for unknown emails,
 * OAuth-only accounts, and bad passwords alike — never enumerate.
 *
 * Per-email brute-force quotas are enforced here, so every password
 * attempt through the app's sign-in/sign-up actions counts against
 * the same bucket.
 */
export async function verifyPasswordSignIn(
  email: string,
  password: string,
): Promise<{ id: string; email: string; name: string | null } | null> {
  const normalized = normalizeEmail(email);
  const { allowed } = await checkRateLimit("password-signin", normalized, 20, 900, {
    expensive: false,
    route: "credentials-authorize",
  });
  if (!allowed) return null;
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);
  const row = rows[0];
  if (!row?.passwordHash) return null;
  if (!(await verifyPassword(password, row.passwordHash))) return null;
  return { id: row.id, email: row.email ?? normalized, name: row.name };
}

/** Insert a password account. Throws on duplicate email (pg 23505). */
export async function createPasswordUser(
  name: string | null,
  email: string,
  passwordHash: string,
): Promise<{ id: string }> {
  const inserted = await db
    .insert(users)
    .values({ name, email, passwordHash })
    .returning();
  return { id: inserted[0]!.id };
}
