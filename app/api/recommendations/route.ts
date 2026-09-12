import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUserId } from "@/lib/current-user";
import { getRecommendations } from "@/lib/progress";
import { badRequest, unauthorized } from "@/lib/api/respond";

const querySchema = z.object({
  subject: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  topic: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(25).default(10),
});

/**
 * Explainable next steps: every item carries its reason, and everything
 * comes from published questions and the current user's own data.
 */
export async function GET(request: Request) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = querySchema.safeParse(params);
  if (!parsed.success) return badRequest("Invalid filters.");

  const recs = await getRecommendations(userId, parsed.data);
  return NextResponse.json(recs, {
    headers: { "Cache-Control": "no-store" },
  });
}
