import Link from "next/link";

/** Shown to signed-in users who are not admins — a dead end with an
 * explanation, never a redirect back to sign-in (that loops forever). */
export function AdminDenied() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Admins only</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        You are signed in, but this account is not on the admin list. Ask the
        project owner to add your email to ADMIN_EMAILS, then sign in again.
      </p>
      <p className="mt-4 text-sm">
        <Link href="/" className="underline">
          Back to home
        </Link>
      </p>
    </main>
  );
}
