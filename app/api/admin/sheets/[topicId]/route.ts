import { NextResponse } from "next/server";
import { upsertSheet } from "@/lib/sheets";
import { adminAccess } from "@/lib/admin";
import { badRequest, forbidden, notFoundPrivate, unauthorized } from "@/lib/api/respond";
import { isAllowedOrigin } from "@/lib/security/origin";
import { assertContentType } from "@/lib/security/request-guards";
import { sheetContentSchema } from "@/lib/validation/extension";

/** Admin-only sheet publish (human-reviewed content only — never AI output). */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ topicId: string }> },
) {
  const access = await adminAccess();
  if (access.status === "signed-out") return unauthorized("Admin sign-in required.");
  if (access.status === "denied") return forbidden("Admin access required.");
  if (!isAllowedOrigin(request)) return forbidden();

  const { topicId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(topicId)) return notFoundPrivate();

  try {
    assertContentType(request);
  } catch {
    return badRequest("Send JSON.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Send valid JSON.");
  }
  const parsed = sheetContentSchema.safeParse(body);
  if (!parsed.success) return badRequest("Sheet needs 10–60000 characters of Markdown.");

  const result = await upsertSheet(access.user.id, topicId, parsed.data.contentMd);
  if ("error" in result) return notFoundPrivate();
  return NextResponse.json(
    { ok: true, version: result.version },
    { headers: { "Cache-Control": "no-store" } },
  );
}
