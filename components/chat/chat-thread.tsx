"use client";

import { memo, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
        <div className="max-w-[85%] border border-(--crt-edge) bg-(--crt-raised) px-4 py-2.5 text-sm leading-7 text-(--crt-ink)">
          <span aria-hidden="true" className="mr-2 font-mono text-[11px] font-bold text-(--crt-red)">
            USR&gt;
          </span>
          <ChatMessageBody content={message.content} />
        </div>
      </div>
    );
  }
  return (
    <article className="max-w-3xl border border-(--crt-line) bg-(--crt-bg) p-4 sm:p-5">
      <p className="crt-micro mb-3 border-b border-(--crt-line) pb-2 text-[10px] text-(--crt-red)">
        [ MENTOR EXPLANATION ]
      </p>
      <ChatMessageBody content={message.content} className="text-(--crt-ink)" />
      {message.stopped ? (
        <p className="crt-micro mt-2 text-[10px] text-(--crt-dim)">
          STOPPED — WHAT YOU SEE ABOVE IS SAVED.
        </p>
      ) : null}
    </article>
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
        className="flex-1 space-y-6 overflow-y-auto py-4"
      >
        {messages.length === 0 && !draft && !streaming ? (
          <p className="crt-micro max-w-md text-[11px] leading-relaxed text-(--crt-dim)">
            CHANNEL OPEN. ASK ANYTHING — A CONCEPT, A PYQ OPTION THAT CONFUSES
            YOU, OR HOW TO APPROACH A TOPIC.
          </p>
        ) : null}
        {messages.map((m) => (
          <SettledMessage key={m.id} message={m} />
        ))}
        {draft ? (
          draft.content === "" ? (
            <p className="crt-micro text-[11px] text-(--crt-ink)" aria-label="Thinking">
              TRANSMITTING<span className="crt-blink ml-1 inline-block h-3 w-2 bg-(--crt-red) align-middle" />
            </p>
          ) : (
            <article className="max-w-3xl border border-(--crt-line) bg-(--crt-bg) p-4 sm:p-5" aria-hidden={streaming}>
              <p className="crt-micro mb-3 border-b border-(--crt-line) pb-2 text-[10px] text-(--crt-red)">[ MENTOR EXPLANATION ]</p>
              <ChatMessageBody content={draft.content} className="text-(--crt-ink)" />
            </article>
          )
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="crt-micro py-2 text-[11px] text-(--crt-red)">
          !! {error.toUpperCase()}
        </p>
      ) : null}

      <div className="sticky bottom-0 flex min-w-0 items-stretch gap-px border border-(--crt-line) bg-(--crt-line)">
        {streaming ? (
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="crt-btn-line min-h-11 flex-1 border-0"
          >
            ■ STOP
          </button>
        ) : (
          <>
            <label htmlFor="composer" className="sr-only">
              Message Mentor
            </label>
            <span aria-hidden="true" className="hidden items-center bg-(--crt-bg) px-5 font-mono text-[15px] font-bold text-(--crt-red) sm:flex">
              &gt;
            </span>
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
              placeholder="ASK ABOUT A CONCEPT OR A QUESTION…"
              className="crt-field min-h-11 min-w-0 flex-1 border-0 text-base normal-case tracking-normal sm:text-[13px]"
            />
            <button
              type="button"
              className="crt-btn-red max-sm:px-3 min-h-11 shrink-0 border-0"
              disabled={input.trim() === ""}
              onClick={() => {
                const text = input;
                setInput("");
                void send(text, { appendUser: true });
              }}
            >
              SEND
            </button>
            {lastUser ? (
              <button
                type="button"
                title="Get a fresh reply to the last message (added below, history kept)"
                onClick={() => void send(lastUser.content, { appendUser: false })}
                className="crt-btn-line max-sm:px-3 min-h-11 shrink-0 border-0 border-l border-(--crt-line)"
              >
                RETRY
              </button>
            ) : null}
          </>
        )}
      </div>
      <p className="crt-micro mt-3 pb-1 text-[10px] leading-relaxed text-(--crt-dim)">
        ENTER TO SEND · SHIFT+ENTER FOR NEW LINE. MENTOR CAN MAKE MISTAKES
        — VERIFY AGAINST SOLUTIONS AND STANDARD TEXTS.
      </p>
    </div>
  );
}
