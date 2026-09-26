import { Fragment } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { cn } from "@/lib/utils";

function mapNonMathSegments(text: string, transform: (plain: string) => string): string {
  return text
    .split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g)
    .map((chunk, index) => (index % 2 === 1 ? chunk : transform(chunk)))
    .join("");
}

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

          // Repair Form Feed (0x0C / \u000c) / Unicode arrow artifacts and tab/backspace control characters from unescaped JSON
          text = text
            .replace(/[\x0c\u000c\u2b06\u2191⬆]\s*(rac|orall|lat)/g, "\\f$1")
            .replace(/\x08(ar|egin|end|eta|ox|inom|ullet)/g, "\\b$1")
            .replace(/\x09(ext|heta|imes|au|an|ilde|o|riangle|op)/g, "\\t$1");

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
          // Tightened to require space or punctuation around it to avoid matching inside identifiers
          text = mapNonMathSegments(text, (s) =>
            s.replace(
              /(?<=\s|^|\b)(n|x|y|z|k|m)([2-9])(?=\s|[.,;:]|$)/g,
              "$$" + "$1^$2" + "$$",
            ),
          );

          // Auto-wrap fraction expressions like U=\frac{a}{b} or \frac{a}{b} if not already inside dollar delimiters
          text = mapNonMathSegments(text, (s) =>
            s.replace(
              /(?:^|(?<=[^a-zA-Z0-9\\]))([a-zA-Z0-9_()]*[=+\-*\/]?\s*\\frac\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}[a-zA-Z0-9_()*+\-\/=]*)/g,
              "$$" + "$1" + "$$",
            ),
          );

          // Auto-wrap subscript expressions like T_{tx}, T_{prop}, x_{1} if not already inside dollar delimiters
          text = mapNonMathSegments(text, (s) =>
            s.replace(
              /\b([a-zA-Z][a-zA-Z0-9]*_\{[^{}]+\})/g,
              "$$" + "$1" + "$$",
            ),
          );

          // Wrap math expressions containing LaTeX commands missing dollar delimiters (e.g. f \in O(g) -> $f \in O(g)$)
          text = mapNonMathSegments(text, (s) =>
            s.replace(
              /\b([a-zA-Z0-9_()]+(?:\s*(?:\\in|\\Omega|\\Theta|\\notin|\\le|\\ge|\\neq|\\hat|\\bar|\\vec)\s*[a-zA-Z0-9_()]+)+)/g,
              "$$" + "$1" + "$$",
            ),
          );

          // Auto-wrap standalone caret expressions (like n^2 or O(n^2)) if not already inside dollar delimiters
          text = mapNonMathSegments(text, (s) =>
            s.replace(
              /\b([O|o|\\]?[a-zA-Z_()]*[a-zA-Z0-9_()]+\^[0-9a-zA-Z_()]+)/g,
              "$$" + "$1" + "$$",
            ),
          );

          // Linkify [Figure N] markers
          text = text.replace(/\[Figure (\d+)\]/g, "[Figure $1](#figure-$1)");

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
        rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false, errorColor: "#e61919" }]]}
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
