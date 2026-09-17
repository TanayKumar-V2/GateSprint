import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/current-user";
import {
  getOwnedSession,
  getSessionMessages,
  getSessionSourceInfo,
} from "@/lib/chat";
import { ChatThread } from "@/components/chat/chat-thread";

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const userId = await currentUserId();
  if (!userId) redirect("/sign-in");
  const { sessionId } = await params;
  const query = await searchParams;

  const session = await getOwnedSession(userId, sessionId);
  if (!session) notFound();

  const [messages, source] = await Promise.all([
    getSessionMessages(sessionId),
    getSessionSourceInfo(session),
  ]);

  return (
    <div className="flex min-h-[70vh] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-(--crt-line) pb-3">
        <h2 className="crt-micro min-w-0 flex-1 truncate text-[12px] font-bold text-(--crt-ink)">
          <span className="text-(--crt-red)">&gt;</span> {session.title.toUpperCase()}
        </h2>
        <Link
          href="/mentor"
          className="crt-micro shrink-0 text-[11px] text-(--crt-dim) transition-colors hover:text-(--crt-red)"
        >
          [ ALL CHATS ]
        </Link>
      </div>

      {source ? (
        <aside
          aria-label="Source context"
          className="border border-(--crt-line) border-l-4 border-l-(--crt-red) bg-(--crt-bg) p-4"
        >
          <p className="crt-micro text-[10px] text-(--crt-red)">
            {source.kind === "question" ? "BRIEF: QUESTION DOSSIER" : "BRIEF: TOPIC REVISION"}
          </p>
          <p className="mt-1.5 text-sm font-bold uppercase tracking-tight text-(--crt-ink)">{source.heading}</p>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-(--crt-dim)">
            {source.detail}
          </p>
          <Link
            href={source.href}
            className="crt-micro mt-2 inline-block text-[11px] text-(--crt-ink) underline decoration-(--crt-red) decoration-2 underline-offset-4 hover:text-(--crt-red)"
          >
            {source.kind === "question" ? "BACK TO QUESTION >>>" : "PRACTICE THIS TOPIC >>>"}
          </Link>
        </aside>
      ) : null}

      <ChatThread
        sessionId={session.id}
        initial={messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
          }))}
        autoSend={messages.length === 0 ? query.q : undefined}
      />
    </div>
  );
}
