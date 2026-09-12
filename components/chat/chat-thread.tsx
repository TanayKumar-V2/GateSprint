"use client";

import { memo, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChatMessageBody } from "./message";
import { readUIChunks } from "./stream";

export type ThreadMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  stopped?: boolean;
};

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Settled messages never re-render mid-stream. */
const SettledMessage = memo(function SettledMessage({
  message,
}: {
  message: ThreadMessage;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-xl bg-primary px-4 py-2.5 text-sm leading-7 text-primary-foreground">
          <ChatMessageBody content={message.content} />
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-full">
      <ChatMessageBody content={message.content} />
      {message.stopped ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Stopped — what you see above is saved.
        </p>
      ) : null}
    </div>
  );
});

function isNearBottom(el: HTMLDivElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
}

export function ChatThread({
  sessionId,
  initial,
  autoSend,
}: {
  sessionId: string;
  initial: ThreadMessage[];
  /** Pre-filled first message (e.g. from a suggestion) — sent once on mount. */
  autoSend?: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ThreadMessage[]>(initial);
  // The draft is kept in a ref for logic and mirrored to state for
  // rendering. All updates are plain value writes — nothing nests one
  // state update inside another, so double-invoked updaters can't
  // duplicate messages.
  const draftRef = useRef<ThreadMessage | null>(null);
  const [draft, setDraft] = useState<ThreadMessage | null>(null);
  const writeDraft = (next: ThreadMessage | null) => {
    draftRef.current = next;
    setDraft(next);
  };
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoSentRef = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && isNearBottom(el)) el.scrollTop = el.scrollHeight;
  });

  async function send(text: string, opts: { appendUser: boolean }) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    setError(null);
    if (opts.appendUser) {
      setMessages((m) => [...m, { id: newId(), role: "user", content: trimmed }]);
    }
    const draftId = newId();
    writeDraft({ id: draftId, role: "assistant", content: "" });
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: trimmed }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        let hint = "Mentor is temporarily unavailable. Try again in a bit.";
        try {
          const data = (await res.json()) as { error?: { message?: string } };
          if (data.error?.message) hint = data.error.message;
        } catch {
          // Keep the generic hint.
        }
        setError(hint);
        writeDraft(null);
        return;
      }
      for await (const chunk of readUIChunks(res.body)) {
        const c = chunk as { type?: string; delta?: unknown; errorText?: unknown };
        if (c.type === "text-delta" && typeof c.delta === "string") {
          const current: ThreadMessage | null = draftRef.current;
          if (current) {
            writeDraft({ ...current, content: current.content + c.delta });
          }
        } else if (c.type === "error") {
          throw new Error("Mentor hit a snag mid-reply.");
        }
      }
      const finished = draftRef.current;
      writeDraft(null);
      if (finished) setMessages((m) => [...m, finished]);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        const stopped = draftRef.current;
        writeDraft(null);
        if (stopped) setMessages((m) => [...m, { ...stopped, stopped: true }]);
      } else {
        setError("Something interrupted that reply. Retry below — nothing was lost.");
        const partial = draftRef.current;
        writeDraft(null);
        if (partial && partial.content !== "") {
          setMessages((m) => [...m, partial]);
        }
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      router.refresh();
    }
  }

  // Suggestion entry: send once, even under StrictMode remounts.
  useEffect(() => {
    if (autoSend && !autoSentRef.current && messages.length === 0) {
      autoSentRef.current = true;
      void send(autoSend, { appendUser: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSend]);

  const lastUser = [...messages].reverse().find((m) => m.role === "user");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        role="log"
        aria-live={streaming ? "off" : "polite"}
        aria-label="Conversation"
        tabIndex={0}
        className="flex-1 space-y-6 overflow-y-auto rounded-md py-4"
      >
        {messages.length === 0 && !draft && !streaming ? (
          <p className="text-sm text-muted-foreground">
            Ask anything — a concept, a PYQ option that confuses you, or how
            to approach a topic.
          </p>
        ) : null}
        {messages.map((m) => (
          <SettledMessage key={m.id} message={m} />
        ))}
        {draft ? (
          draft.content === "" ? (
            <p className="text-sm text-muted-foreground" aria-label="Thinking">
              Thinking…
            </p>
          ) : (
            <div className="max-w-full" aria-hidden={streaming}>
              <ChatMessageBody content={draft.content} />
            </div>
          )
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-2 border-t py-3">
        {streaming ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => abortRef.current?.abort()}
          >
            Stop
          </Button>
        ) : (
          <>
            <label htmlFor="composer" className="sr-only">
              Message Mentor
            </label>
            <textarea
              id="composer"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input, { appendUser: true }).then(() => setInput(""));
                }
              }}
              rows={2}
              placeholder="Ask about a concept or a question…"
              className="min-h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <Button
              type="button"
              className="min-h-11"
              disabled={input.trim() === ""}
              onClick={() => {
                const text = input;
                setInput("");
                void send(text, { appendUser: true });
              }}
            >
              Send
            </Button>
            {lastUser ? (
              <Button
                type="button"
                variant="ghost"
                title="Get a fresh reply to the last message (added below, history kept)"
                onClick={() => void send(lastUser.content, { appendUser: false })}
              >
                Retry
              </Button>
            ) : null}
          </>
        )}
      </div>
      <p className="pb-1 text-xs text-muted-foreground">
        Enter to send · Shift+Enter for a new line. Mentor can make mistakes
        — verify against solutions and standard texts.
      </p>
    </div>
  );
}
