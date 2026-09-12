import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/current-user";
import { listQuestions } from "@/lib/questions";
import { badRequest, unauthorized } from "@/lib/api/respond";
import { listQuerySchema } from "@/lib/validation/answers";

/**
 * Published questions with attempt/bookmark flags for the signed-in user.
 * Answers and solutions are never included here.
 */
export async function GET(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = listQuerySchema.safeParse(params);
  if (!parsed.success) return badRequest("Invalid filters.");

  const list = await listQuestions(userId, parsed.data);
  return NextResponse.json(list, {
    headers: { "Cache-Control": "no-store" },
  });
}
