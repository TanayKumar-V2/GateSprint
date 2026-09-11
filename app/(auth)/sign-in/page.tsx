import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Sign in to GATE Mentor</CardTitle>
          <CardDescription>
            Google sign-in via Auth.js lands in Phase 3. This placeholder
            reserves the route structure.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button disabled aria-disabled="true">
            Continue with Google (Phase 3)
          </Button>
          <p className="text-sm leading-6 text-muted-foreground">
            No credentials are collected on this screen.{" "}
            <Link href="/" className="underline">
              Back to home
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
