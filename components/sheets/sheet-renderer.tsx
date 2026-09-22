import { MathText } from "@/components/markdown/math-text";

/** Curated sheet body: same Markdown + KaTeX renderer as solutions. */
export function SheetRenderer({ contentMd }: { contentMd: string }) {
  return (
    <div className="sheet-body border border-(--crt-line) bg-(--crt-bg) px-4 py-5 sm:px-6 print:border-black print:bg-white">
      <MathText
        text={contentMd}
        className="prose-study text-[15px] leading-8 text-(--crt-ink) print:text-black [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mt-4 [&_li]:my-1 [&_p]:my-2 [&_table]:w-full"
      />
    </div>
  );
}
