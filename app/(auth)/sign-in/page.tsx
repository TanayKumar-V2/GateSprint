import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, isSignInConfigured, signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PasswordAuthForms } from "@/components/auth/password-forms";

/** Auth gate — useful to humans, noise to crawlers. */
export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

/** Generic messages only — never confirm whether an account exists. */
function errorMessage(code: string | undefined): string | null {
  switch (code) {
    case "OAuthAccountNotLinked":
      return "This email is already linked to a different sign-in method. Use that one instead.";
    case "CredentialsSignin":
      return "Wrong email or password.";
    case "OAuthCallback":
    case "Callback":
    case "AccessDenied":
    default:
      return code
        ? "Sign-in didn't complete. Please try again."
        : null;
  }
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  if (session?.user) redirect(params.callbackUrl ?? "/practice");

  if (!isSignInConfigured()) {
    return (
      <main className="surface-grid flex min-h-dvh w-full flex-col items-center justify-center gap-6 px-4 py-16">
        <Card className="w-full max-w-md border-border shadow-xl shadow-foreground/10">
          <CardHeader>
            <CardTitle>Google sign-in isn’t set up yet</CardTitle>
            <CardDescription>
              The Google sign-in keys are missing on this server. Email
              sign-in below still works.
            </CardDescription>
          </CardHeader>
        </Card>
        <EmailBackstopPanel />
      </main>
    );
  }

  const failure = errorMessage(params.error);

  return (
    <main className="surface-grid flex min-h-dvh w-full flex-col items-center justify-center gap-6 px-4 py-16">
      <Card className="w-full max-w-md border-border shadow-xl shadow-foreground/10">
        <CardHeader>
          <CardTitle>Sign in to Gate Sprint</CardTitle>
          <CardDescription>
            One account keeps your attempts, bookmarks, and Mentor chats in
            sync.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {failure ? (
            <p role="alert" className="text-sm leading-6 text-destructive">
              {failure}
            </p>
          ) : null}
          <form
            action={async () => {
              "use server";
              await signIn("google", {
                redirectTo: params.callbackUrl ?? "/practice",
              });
            }}
          >
            <Button type="submit" className="w-full">
              Continue with Google
            </Button>
          </form>
          <p className="text-sm leading-6 text-muted-foreground">
            Google shares only your name, email, and avatar.{" "}
            <Link href="/" className="underline">
              Back to home
            </Link>
          </p>
        </CardContent>
      </Card>
      <EmailBackstopPanel />
    </main>
  );
}

/** Email auth on the backstop page, in its own CRT compartment. */
function EmailBackstopPanel() {
  return (
    <div className="crt-landing w-full max-w-md border-2 border-(--crt-ink) bg-(--crt-bg) text-(--crt-ink)">
      <p className="crt-micro border-b border-(--crt-line) px-5 py-2.5 text-[10px] text-(--crt-dim)">
        [ EMAIL AUTH {"///"} BACKUP TERMINAL ]
      </p>
      <div className="px-5 py-5">
        <PasswordAuthForms />
      </div>
    </div>
  );
}
