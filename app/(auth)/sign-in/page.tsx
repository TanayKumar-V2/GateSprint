import Link from "next/link";
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

/** Generic messages only — never confirm whether an account exists. */
function errorMessage(code: string | undefined): string | null {
  switch (code) {
    case "OAuthAccountNotLinked":
      return "This email is already linked to a different sign-in method. Use that one instead.";
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
      <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Sign-in isn’t set up yet</CardTitle>
            <CardDescription>
              The Google sign-in keys are missing on this server. Add them
              to the environment and reload — nothing here collects
              credentials.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              <Link href="/" className="underline">
                Back to home
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const failure = errorMessage(params.error);

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Sign in to GATE Mentor</CardTitle>
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
    </main>
  );
}
