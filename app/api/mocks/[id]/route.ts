import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/current-user";
import { getMockSession } from "@/lib/mocks";
import { notFoundPrivate, unauthorized } from "@/lib/api/respond";

/** Runner payload (answers hidden) or finished result. Owner-scoped. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await currentUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFoundPrivate();

  const payload = await getMockSession(userId, id);
  if ("error" in payload) return notFoundPrivate();
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
