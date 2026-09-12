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
        .map((seg, j) =>
          j % 2 === 1
            ? seg
            : seg
                .replace(/(?<!\\)\\\(/g, "$")
                .replace(/(?<!\\)\\\)/g, "$")
                // "$$" in a replacement string means one literal "$",
                // so display math needs four.
                .replace(/(?<!\\)\\\[/g, "$$$$")
                .replace(/(?<!\\)\\\]/g, "$$$$"),
        )
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
    <Wrapper className={cn(inline ? "inline" : undefined, className)}>
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
