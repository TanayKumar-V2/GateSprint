import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-16">
      <Card>
        <CardHeader>
          <p className="text-sm font-medium text-muted-foreground">404</p>
          <CardTitle>Page not found</CardTitle>
          <CardDescription>
            The page or resource you asked for could not be found. No internal
            details are exposed here by design.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Link href="/" className={cn(buttonVariants())}>
            Home
          </Link>
          <Link
            href="/practice"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Practice
          </Link>
          <Link
            href="/mentor"
            className={cn(buttonVariants({ variant: "ghost" }))}
          >
            Mentor
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
