"use server";

import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { signIn } from "@/lib/auth";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { ensureUsername } from "@/lib/profile";
import {
  createPasswordUser,
  hashPassword,
  normalizeEmail,
  verifyPasswordSignIn,
} from "@/lib/password";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { logAuthEvent } from "@/lib/security/auth-events";

/**
 * Modal auth path: Google only, always lands in the workspace.
 * The /sign-in route stays as the backstop for guards and OAuth errors.
 */
export async function signInWithGoogle(): Promise<void> {
  await signIn("google", { redirectTo: "/practice" });
}

export type PasswordAuthState = { error?: string };

const passwordSchema = z.object({
  name: z.string().trim().max(60).optional(),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});

// Mirrors the Auth.js default (30 days). Sliding refresh on activity is
// handled by Auth.js itself on subsequent auth() calls.
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "23505"
  );
}

/** Secure-cookie decision, mirroring Auth.js: HTTPS → __Secure- prefix. */
async function sessionCookieSecure(): Promise<boolean> {
  const proto = (await headers()).get("x-forwarded-proto");
  if (proto) return proto === "https";
  return (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://");
}

/**
 * Open a real database session for a verified password user: same row
 * shape and cookie contract Auth.js uses for OAuth logins, so revocation
 * semantics stay identical. Always ends in a redirect to the workspace.
 */
async function openPasswordSession(userId: string): Promise<never> {
  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + SESSION_MAX_AGE_MS);
  await db.insert(sessions).values({ sessionToken, userId, expires });
  const secure = await sessionCookieSecure();
  (await cookies()).set(
    `${secure ? "__Secure-" : ""}authjs.session-token`,
    sessionToken,
    { httpOnly: true, sameSite: "lax", path: "/", secure, expires },
  );
  logAuthEvent({ type: "sign-in", ok: true, provider: "credentials", userId });
  redirect("/practice");
}

/** Email+password sign-in. Wrong credentials stay generic — no enumeration. */
export async function signInWithPassword(
  _prev: PasswordAuthState,
  formData: FormData,
): Promise<PasswordAuthState> {
  const parsed = passwordSchema
    .omit({ name: true })
    .safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) {
    return { error: "Enter a valid email and your password." };
  }
  const verified = await verifyPasswordSignIn(
    normalizeEmail(parsed.data.email),
    parsed.data.password,
  );
  if (!verified) return { error: "Wrong email or password." };
  return openPasswordSession(verified.id);
}

/** Email+password sign-up, then straight into the workspace. */
export async function signUpWithPassword(
  _prev: PasswordAuthState,
  formData: FormData,
): Promise<PasswordAuthState> {
  const parsed = passwordSchema.safeParse({
    name: formData.get("name") || undefined,
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Give a valid email and a password of 8+ characters." };
  }
  const email = normalizeEmail(parsed.data.email);
  const name = parsed.data.name?.trim() || null;

  const { allowed } = await checkRateLimit("password-signup", email, 5, 3600, {
    expensive: false,
    route: "password-signup",
  });
  if (!allowed) return { error: "Too many attempts. Try again later." };

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing[0]) {
    return { error: "An account with this email already exists — sign in instead." };
  }

  let userId: string;
  try {
    const created = await createPasswordUser(name, email, await hashPassword(parsed.data.password));
    // Handles are assigned at sign-up; a failure here must never block
    // registration — the dashboard gate backfills lazily.
    try {
      await ensureUsername(created.id, name, email);
    } catch {
      // Backfilled lazily; see getProfileByUsername callers.
    }
    userId = created.id;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: "An account with this email already exists — sign in instead." };
    }
    return { error: "Couldn't create that account. Try again." };
  }
  // Outside the try: redirect() throws NEXT_REDIRECT to navigate, which
  // must never be mistaken for a failure.
  return openPasswordSession(userId);
}
