import { Fragment } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { cn } from "@/lib/utils";

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
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={
          inline
            ? {
                p: ({ children }) => <Fragment>{children}</Fragment>,
              }
            : undefined
        }
      >
        {text}
      </ReactMarkdown>
    </Wrapper>
  );
}
