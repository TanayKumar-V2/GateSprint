import "server-only";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { logAuthEvent } from "./security/auth-events";

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
  ],
  callbacks: {
    session({ session, user }) {
      // Expose the stable user id to server components and route handlers.
      // Ownership checks must use this, never anything from the client.
      session.user.id = user.id;
      return session;
    },
  },
  events: {
    async signIn({ user, account }) {
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
