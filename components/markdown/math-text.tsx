import { Fragment } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { cn } from "@/lib/utils";

/**
 * The model sometimes emits \(...\) / \[...\] delimiters despite being
 * told to use dollar signs. Normalize those to $/$$ so symbols render
 * either way. Code spans and fenced blocks are left untouched so real
 * backslashes in code (regex, escapes) survive verbatim.
 */
export function normalizeMathDelimiters(input: string): string {
  return input
    .split(/(```[\s\S]*?```)/g)
    .map((part, i) => {
      if (i % 2 === 1) return part;
      return part
        .split(/(`[^`\n]*`)/g)
        .map((seg, j) => {
          if (j % 2 === 1) return seg;
          let text = seg
            .replace(/(?<!\\)\\\(/g, "$")
            .replace(/(?<!\\)\\\)/g, "$")
            // "$$" in a replacement string means one literal "$",
            // so display math needs four.
            .replace(/(?<!\\)\\\[/g, "$$$$")
            .replace(/(?<!\\)\\\]/g, "$$$$");

          // Convert common unicode math symbols into LaTeX math equivalents
          text = text
            .replace(/∈/g, "\\in ")
            .replace(/∉/g, "\\notin ")
            .replace(/Ω/g, "\\Omega ")
            .replace(/Θ/g, "\\Theta ")
            .replace(/≤/g, "\\le ")
            .replace(/≥/g, "\\ge ")
            .replace(/≠/g, "\\neq ");

          // Fix PDF extraction artifacts where single variable power digits lack carets (e.g. n2 -> $n^2$)
          text = text.replace(
            /(?<![a-zA-Z0-9$])([nxyzkm])([2-9])(?![a-zA-Z0-9$])/g,
            "$$" + "$1^$2" + "$$",
          );

          // Wrap math expressions containing LaTeX commands missing dollar delimiters (e.g. f \in O(g) -> $f \in O(g)$)
          text = text.replace(
            /(?<!\$)\b([a-zA-Z0-9_()]+(?:\s*(?:\\in|\\Omega|\\Theta|\\notin|\\le|\\ge|\\neq|\\hat|\\bar|\\vec)\s*[a-zA-Z0-9_()]+)+)(?!\$)/g,
            "$$" + "$1" + "$$",
          );

          // Auto-wrap standalone caret expressions (like n^2 or O(n^2)) if not already inside dollar delimiters
          text = text.replace(
            /(?<!\$)\b([O|o|\\]?[a-zA-Z_()]*[a-zA-Z0-9_()]+\^[0-9a-zA-Z_()]+)(?!\$)/g,
            "$$" + "$1" + "$$",
          );

          return text;
        })
        .join("");
    })
    .join("");
}

/**
 * Question/solution text with LaTeX support. `$...$` renders inline math,
 * `$$...$$` renders display math. Raw HTML is never rendered — anything
 * that isn't Markdown or math shows as plain text.
 */
export function MathText({
  text,
  inline = false,
  className,
}: {
  text: string;
  inline?: boolean;
  className?: string;
}) {
  const Wrapper = inline ? "span" : "div";
  return (
    <Wrapper
      className={cn(
        inline ? "inline" : "[&_.katex-display]:overflow-x-auto [&_.katex-display]:py-1",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={
          inline
            ? {
                p: ({ children }) => <Fragment>{children}</Fragment>,
              }
            : undefined
        }
      >
        {normalizeMathDelimiters(text)}
      </ReactMarkdown>
    </Wrapper>
  );
}
