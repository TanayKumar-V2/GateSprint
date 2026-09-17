import "server-only";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { logAuthEvent } from "./security/auth-events";
import { ensureUsername } from "./profile";

/** True when Google sign-in can actually work (no hard-coded fallbacks). */
export function isSignInConfigured(): boolean {
  return Boolean(
    process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Works behind localhost and Vercel's proxy; callback URL is derived
  // from the request host. Keep NEXT_PUBLIC_APP_URL accurate for links.
  trustHost: true,
  adapter: DrizzleAdapter(
    db as unknown as Parameters<typeof DrizzleAdapter>[0],
    {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    },
  ),
  // Database sessions: every request re-checks the sessions table, so a
  // revoked session stops working immediately.
  session: { strategy: "database" },
  providers: [
    Google({
      // Prompt picker every time so shared devices don't silently reuse
      // the last Google account.
      authorization: { params: { prompt: "select_account" } },
    }),
    // NOTE: no Credentials provider on purpose. This Auth.js version only
    // mints JWT sessions for credentials logins and never persists them
    // to the database strategy this app requires (instant revocation).
    // Email+password auth instead verifies via lib/password and opens a
    // real database session in components/auth/sign-in-actions.ts.
  ],
  callbacks: {
    session({ session, user }) {
      // Expose the stable user id to server components and route handlers.
      // Ownership checks must use this, never anything from the client.
      session.user.id = user.id;
      // Profile handle for the dashboard nav. Null only for rows created
      // before handles existed and missed the backfill — callers fall back
      // to ensureUsername so the link never dead-ends.
      session.user.username = (user as { username?: string | null }).username ?? null;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // Every account needs a stable profile handle from day one.
      // Failures must never block sign-up — rerun
      // db/backfill-usernames.ts to assign handles to any rows missed.
      // ensureUsername is idempotent, so replays are safe.
      try {
        if (user?.id) await ensureUsername(user.id, user.name ?? null, user.email ?? null);
      } catch {
        // Backfilled lazily; see getProfileByUsername callers.
      }
    },    async signIn({ user, account }) {
      // Privacy: provider + success only. No emails, tokens, or profiles.
      logAuthEvent({
        type: "sign-in",
        ok: true,
        provider: account?.provider ?? "unknown",
        userId: user?.id,
      });
    },
    async signOut(message) {
      logAuthEvent({
        type: "sign-out",
        ok: true,
        userId:
          "session" in message ? message.session?.userId ?? null : null,
      });
    },
  },
  pages: {
    signIn: "/sign-in",
    // Keep the default error page; the sign-in screen maps common codes
    // to generic, non-enumerating messages.
  },
});
