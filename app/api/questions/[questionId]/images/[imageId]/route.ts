import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { questionImages, questions } from "@/db/schema";
import { adminAccess } from "@/lib/admin";
import { notFoundPrivate } from "@/lib/api/respond";

/** Serve a question figure. Published questions are public; drafts need admin.
 * CDN-backed figures redirect; byte-backed figures stream with immutable caching. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ questionId: string; imageId: string }> },
) {
  const { questionId, imageId } = await params;
  const rows = await db
    .select({
      mime: questionImages.mime,
      dataBase64: questionImages.dataBase64,
      url: questionImages.url,
      isPublished: questions.isPublished,
    })
    .from(questionImages)
    .innerJoin(questions, eq(questionImages.questionId, questions.id))
    .where(
      and(
        eq(questionImages.id, imageId),
        eq(questionImages.questionId, questionId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return notFoundPrivate();
  if (!row.isPublished) {
    const access = await adminAccess();
    if (access.status !== "ok") return notFoundPrivate();
  }
  if (row.url) return NextResponse.redirect(row.url);
  if (!row.dataBase64) return notFoundPrivate();
  let bytes: Buffer;
  try {
    bytes = Buffer.from(row.dataBase64, "base64");
  } catch {
    return notFoundPrivate();
  }
  if (bytes.length === 0) return notFoundPrivate();
  const body = new Uint8Array(bytes);
  return new NextResponse(body, {
    headers: {
      "Content-Type": row.mime,
      "Content-Length": String(body.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
