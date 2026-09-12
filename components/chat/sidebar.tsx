"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SidebarSession = {
  id: string;
  title: string;
  updatedAt: Date;
};

export function NewChatButton({ label = "New chat" }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function start() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { session: { id: string } };
      router.push(`/mentor/${data.session.id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" onClick={start} disabled={busy} className="w-full">
      {busy ? "Starting…" : label}
    </Button>
  );
}

function SessionList({ sessions }: { sessions: SidebarSession[] }) {
  const pathname = usePathname();
  if (sessions.length === 0) {
    return (
      <p className="px-2 py-4 text-sm text-muted-foreground">
        No conversations yet. Start one above.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1" aria-label="Recent sessions">
      {sessions.map((s) => {
        const active = pathname === `/mentor/${s.id}`;
        return (
          <li key={s.id}>
            <Link
              href={`/mentor/${s.id}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "block truncate rounded-md px-3 py-2 text-sm hover:bg-muted",
                active ? "bg-muted font-medium" : "text-muted-foreground",
              )}
            >
              {s.title}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function MentorShell({
  sessions,
  children,
}: {
  sessions: SidebarSession[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
      <div className="md:hidden">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mentor-sessions"
        >
          {open ? "Hide chats" : "My chats"}
        </Button>
      </div>
      <aside
        id="mentor-sessions"
        aria-label="Chat sessions"
        className={cn(
          "flex w-full flex-col gap-3 rounded-xl border p-3 md:block md:w-64 md:shrink-0",
          open ? "block" : "hidden",
        )}
      >
        <NewChatButton />
        <nav className="max-h-[40vh] overflow-y-auto md:max-h-[60vh]">
          <SessionList sessions={sessions} />
        </nav>
      </aside>
      <section aria-label="Conversation" className="flex min-h-[60vh] min-w-0 flex-1 flex-col">
        {children}
      </section>
    </div>
  );
}
