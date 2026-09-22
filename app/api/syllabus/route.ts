import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/current-user";
import { getSyllabus } from "@/lib/syllabus";
import { unauthorized } from "@/lib/api/respond";
import { checkRateLimit, rateLimitedResponse } from "@/lib/security/rate-limit";

/** Derived syllabus readiness: attempts in, status pills out. No manual ticks. */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const limited = await checkRateLimit("syllabus", userId, 30, 60, {
    expensive: false,
    route: "GET /api/syllabus",
  });
  if (!limited.allowed) return rateLimitedResponse(limited.retryAfterSeconds);

  const syllabus = await getSyllabus(userId);
  return NextResponse.json(syllabus, {
    headers: { "Cache-Control": "no-store" },
  });
}
