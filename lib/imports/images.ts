import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { questionImages } from "@/db/schema";
import type { ValidImage } from "./image-validation";

export { MAX_IMAGES_PER_QUESTION, MAX_IMAGE_BYTES, ALLOWED_IMAGE_MIME, FIGURE_PLACEHOLDER_TEXT, splitValidImages, wantsFigures } from "./image-validation";
export type { ValidImage } from "./image-validation";

export function imageUrl(questionId: string, imageId: string): string {
  return `/api/questions/${questionId}/images/${imageId}`;
}

/* Figure persistence for PDF-extracted diagrams (see tools/extract).
 *
 * Diagrams are stored as base64 TEXT — never a binary column — so the Neon
 * HTTP and node-postgres drivers behave identically. Served through
 * /api/questions/[questionId]/images/[imageId]. Pure validation lives in
 * ./image-validation so it stays unit-testable.
 */

export async function saveQuestionImages(
  questionId: string,
  images: ValidImage[],
): Promise<{ id: string; position: number }[]> {
  const saved: { id: string; position: number }[] = [];
  // One row per statement: keeps both database drivers' typings happy and
  // figure counts per question tiny (<= MAX_IMAGES_PER_QUESTION).
  for (const [position, image] of images.entries()) {
    const rows = await db
      .insert(questionImages)
      .values({
        questionId,
        position,
        filename: image.filename,
        mime: image.mime,
        width: image.width ?? null,
        height: image.height ?? null,
        dataBase64: image.data ?? null,
        url: image.url ?? null,
      })
      .returning();
    if (rows[0]) saved.push({ id: rows[0].id, position: rows[0].position });
  }
  return saved;
}

export type ImageMeta = { id: string; position: number };

/** Metadata (no bytes) for a batch of questions, keyed by question id. */
export async function listImagesForQuestions(questionIds: string[]): Promise<Map<string, ImageMeta[]>> {
  const map = new Map<string, ImageMeta[]>();
  if (questionIds.length === 0) return map;
  const rows = await db
    .select({ id: questionImages.id, questionId: questionImages.questionId, position: questionImages.position })
    .from(questionImages)
    .where(inArray(questionImages.questionId, questionIds));
  for (const row of rows) {
    const list = map.get(row.questionId) ?? [];
    list.push({ id: row.id, position: row.position });
    map.set(row.questionId, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.position - b.position);
  return map;
}
