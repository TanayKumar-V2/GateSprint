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
    <div className="overflow-hidden border border-(--crt-line)">
      <div className="flex items-center justify-between bg-(--crt-panel) px-3 py-1.5">
        <span className="crt-micro text-[10px] text-(--crt-dim)">
          {language || "code"}
        </span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto bg-(--crt-bg) p-3 text-[13px] leading-6">
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
        "mentor-prose max-w-3xl text-[15px] leading-7 [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mt-7 [&_h2]:mb-3 [&_h2]:border-b [&_h2]:border-border [&_h2]:pb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_p]:my-3 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_li]:pl-1 [&_strong]:font-semibold [&_blockquote]:my-4 [&_blockquote]:rounded-lg [&_blockquote]:bg-primary/10 [&_blockquote]:px-4 [&_blockquote]:py-2 [&_blockquote]:text-foreground [&_.katex-display]:overflow-x-auto [&_.katex-display]:py-2 [&_table]:my-4 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_tr:nth-child(even)]:bg-muted/30",
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
                <code className="border border-(--crt-line) bg-(--crt-panel) px-1 py-0.5 font-mono text-[0.85em]">
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
