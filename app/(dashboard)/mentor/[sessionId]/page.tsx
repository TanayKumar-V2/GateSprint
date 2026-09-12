import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUserId } from "@/lib/current-user";
import {
  getOwnedSession,
  getSessionMessages,
  getSessionSourceInfo,
} from "@/lib/chat";
import { ChatThread } from "@/components/chat/chat-thread";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    <div className="flex min-h-[70vh] flex-col">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="truncate text-lg font-semibold">{session.title}</h2>
        <Link
          href="/mentor"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          All chats
        </Link>
      </div>

      {source ? (
        <aside
          aria-label="Source context"
          className="mb-3 rounded-xl border bg-muted/40 p-3"
        >
          <p className="text-xs font-medium text-muted-foreground">
            {source.kind === "question" ? "Discussing a question" : "Topic revision"}
          </p>
          <p className="mt-0.5 text-sm font-medium">{source.heading}</p>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
            {source.detail}
          </p>
          <Link
            href={source.href}
            className="mt-1 inline-block text-sm underline"
          >
            {source.kind === "question" ? "Back to question →" : "Practice this topic →"}
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
