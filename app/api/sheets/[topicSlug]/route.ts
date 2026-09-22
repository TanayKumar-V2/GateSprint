import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/current-user";
import { getSheet } from "@/lib/sheets";
import { notFoundPrivate, unauthorized } from "@/lib/api/respond";

/** Curated sheet for one topic, if an admin has published it. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ topicSlug: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const { topicSlug } = await params;
  const result = await getSheet(userId, topicSlug);
  if ("error" in result) return notFoundPrivate();
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
