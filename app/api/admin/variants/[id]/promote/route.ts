import { NextResponse } from "next/server";
import { promoteVariant } from "@/lib/variants";
import { adminAccess } from "@/lib/admin";
import { badRequest, forbidden, notFoundPrivate, unauthorized } from "@/lib/api/respond";
import { isAllowedOrigin } from "@/lib/security/origin";
import { assertContentType } from "@/lib/security/request-guards";
import { variantPromoteSchema } from "@/lib/validation/extension";

/** Admin-only: copy a vetted variant into the bank as UNPUBLISHED. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await adminAccess();
  if (access.status === "signed-out") return unauthorized("Admin sign-in required.");
  if (access.status === "denied") return forbidden("Admin access required.");
  if (!isAllowedOrigin(request)) return forbidden();

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFoundPrivate();

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
  const parsed = variantPromoteSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid taxonomy target.");

  const result = await promoteVariant(id, parsed.data);
  if ("error" in result) {
    if (result.error === "not_found") return notFoundPrivate();
    return badRequest("Topic must belong to the subject.");
  }
  return NextResponse.json(
    { ok: true, questionId: result.questionId },
    { headers: { "Cache-Control": "no-store" } },
  );
}
