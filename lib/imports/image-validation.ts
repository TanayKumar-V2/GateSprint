import { z } from "zod";

/* Pure figure validation (no database, no I/O) — unit-tested in
 * tests/images.test.ts. Database persistence lives in ./images. */

export const MAX_IMAGES_PER_QUESTION = 8;
export const MAX_IMAGE_BYTES = 512 * 1024;
export const ALLOWED_IMAGE_MIME = ["image/png", "image/jpeg"] as const;

/* Marker the extractor writes for image-only options. Mirrors
 * FIGURE_PLACEHOLDER in components/questions/question-figures.tsx (kept as
 * a separate literal so no zod import leaks into the client bundle; a test
 * pins the two together). */
export const FIGURE_PLACEHOLDER_TEXT = "[See figure]";

/** True when at least one option points at a diagram. */
export function wantsFigures(
  options: { id: string; text: string }[] | null | undefined,
): boolean {
  return (options ?? []).some(
    (option) => option.text.trim() === FIGURE_PLACEHOLDER_TEXT,
  );
}

const imageRecord = z
  .object({
    filename: z.string().trim().min(1).max(200),
    mime: z.enum(ALLOWED_IMAGE_MIME),
    width: z.number().int().positive().max(10000).nullable().optional(),
    height: z.number().int().positive().max(10000).nullable().optional(),
    // Exactly one of inline base64 bytes or a CDN url (ImageKit upload).
    data: z.string().trim().min(1).max(1_000_000).optional(),
    url: z
      .string()
      .trim()
      .url()
      .max(2000)
      .refine((value) => value.startsWith("http://") || value.startsWith("https://"), {
        message: "Figure url must be http(s).",
      })
      .optional(),
  })
  .refine((value) => (value.data ? 1 : 0) + (value.url ? 1 : 0) === 1, {
    message: "Figure needs exactly one of data, url.",
  });

export type ValidImage = z.infer<typeof imageRecord>;

/** Split raw `images` input into savable rows; invalid rows are counted, never thrown. */
export function splitValidImages(value: unknown): { valid: ValidImage[]; invalid: number } {
  if (value === undefined || value === null) return { valid: [], invalid: 0 };
  if (!Array.isArray(value)) return { valid: [], invalid: 1 };
  const valid: ValidImage[] = [];
  let invalid = 0;
  for (const entry of value.slice(0, MAX_IMAGES_PER_QUESTION)) {
    const parsed = imageRecord.safeParse(entry);
    if (!parsed.success) { invalid++; continue; }
    if (parsed.data.data !== undefined) {
      let byteLength = 0;
      try {
        byteLength = Buffer.from(parsed.data.data, "base64").length;
      } catch {
        invalid++;
        continue;
      }
      if (byteLength === 0 || byteLength > MAX_IMAGE_BYTES) { invalid++; continue; }
    }
    valid.push(parsed.data);
  }
  if (value.length > MAX_IMAGES_PER_QUESTION) invalid += value.length - MAX_IMAGES_PER_QUESTION;
  return { valid, invalid };
}
