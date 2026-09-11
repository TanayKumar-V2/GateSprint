import "server-only";
import { redirect } from "next/navigation";
import { auth } from "./auth";

/** Session user, or null when signed out. */
export async function currentUser() {
  const session = await auth();
  return session?.user ?? null;
}

/** User id, or null when signed out. */
export async function currentUserId(): Promise<string | null> {
  const user = await currentUser();
  return user?.id ?? null;
}

/**
 * Guard for pages: redirects signed-out visitors to sign-in.
 * Returns the signed-in user id.
 */
export async function requireUserId(): Promise<string> {
  const id = await currentUserId();
  if (!id) redirect("/sign-in");
  return id;
}
