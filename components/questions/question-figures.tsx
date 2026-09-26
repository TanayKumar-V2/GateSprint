/* Client-safe (no server imports): usable from server and client components. */

export type FigureMeta = { id: string; position: number };

export function figureUrl(questionId: string, imageId: string): string {
  return `/api/questions/${questionId}/images/${imageId}`;
}

/**
 * Placeholder the PDF extractor writes when an option is image-only.
 * The diagrams may or may not have survived the import — never show this
 * raw marker to students; render a FIGURE tag (and a notice) instead.
 */
export const FIGURE_PLACEHOLDER = "[See figure]";

export function isFigurePlaceholder(text: string): boolean {
  return text.trim() === FIGURE_PLACEHOLDER;
}

/** 1-based `[Figure N]` markers referenced by a prompt, in encounter order. */
export function referencedFigures(prompt: string): number[] {
  const out: number[] = [];
  const re = /\[Figure (\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(prompt)) !== null) {
    const n = Number(m[1]);
    if (!out.includes(n)) out.push(n);
  }
  return out;
}

/** Diagrams extracted from the source PDF, in stored order. */
export function QuestionFigures({
  questionId,
  images,
}: {
  questionId: string;
  images: FigureMeta[];
}) {
  if (images.length === 0) return null;
  return (
    <div className="grid gap-px border border-(--crt-line) bg-(--crt-line)" aria-label="Question figures">
      {images.map((image, index) => (
        <figure id={`figure-${index + 1}`} key={image.id} className="m-0 bg-(--crt-bg) p-3 sm:p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <a href={figureUrl(questionId, image.id)} target="_blank" rel="noopener noreferrer">
            <img
              src={figureUrl(questionId, image.id)}
              alt={`Figure ${index + 1} for this question`}
              loading="lazy"
              className="h-auto max-h-96 w-auto max-w-full border border-(--crt-line) transition-transform hover:scale-[1.02]"
            />
          </a>
          <figcaption className="crt-micro mt-2 text-[10px] text-(--crt-dim)">
            FIGURE {index + 1}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
