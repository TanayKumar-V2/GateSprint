import { Fragment, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { CopyButton } from "./copy-button";
import { cn } from "@/lib/utils";
import { normalizeMathDelimiters } from "@/components/markdown/math-text";

function CodeBlock({ language, code }: { language: string; code: string }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between bg-muted px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          {language || "code"}
        </span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto bg-muted/40 p-3 text-[13px] leading-6">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}

/**
 * Chat message body: Markdown, LaTeX math, and fenced code with language
 * labels and copy buttons. Raw HTML is never rendered.
 */
export function ChatMessageBody({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-sm leading-7 [&_p]:my-2 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-x-auto [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_td]:align-top",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          pre: ({ children }) => <Fragment>{children}</Fragment>,
          code: ({ className: cls, children }) => {
            const text = String(children ?? "").replace(/\n$/, "");
            const match = /language-(\w+)/.exec(cls ?? "");
            // Inline code stays inline; fenced blocks get the full treatment.
            if (!match || !text.includes("\n")) {
              return (
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
                  {children as ReactNode}
                </code>
              );
            }
            return <CodeBlock language={match[1] ?? ""} code={text} />;
          },
        }}
      >
        {normalizeMathDelimiters(content)}
      </ReactMarkdown>
    </div>
  );
}
