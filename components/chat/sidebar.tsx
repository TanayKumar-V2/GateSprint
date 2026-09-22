"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
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
    <button type="button" onClick={start} disabled={busy} className="crt-btn-red w-full">
      {busy ? "STARTING…" : `+ ${label.toUpperCase()}`}
    </button>
  );
}

function SessionList({ sessions }: { sessions: SidebarSession[] }) {
  const pathname = usePathname();
  const router = useRouter();
  // Optimistic removal over the server-fed list; router.refresh() syncs
  // truth afterwards. First click arms, second click purges.
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const items = sessions.filter((s) => !removed.has(s.id));

  async function remove(id: string) {
    if (confirmId !== id) {
      setConfirmId(id);
      setFailed(false);
      return;
    }
    setConfirmId(null);
    setRemoved((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/chat/sessions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`delete ${res.status}`);
      if (pathname === `/mentor/${id}`) router.push("/mentor");
      router.refresh();
    } catch {
      setRemoved((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setFailed(true);
    }
  }

  if (items.length === 0) {
    return (
      <p className="crt-micro px-1 py-4 text-[10px] leading-relaxed text-(--crt-dim)">
        {sessions.length === 0
          ? "NO CONVERSATIONS YET. START ONE ABOVE."
          : "PURGING…"}
      </p>
    );
  }
  return (
    <>
      <ul className="flex flex-col" aria-label="Recent sessions">
        {items.map((s) => {
          const active = pathname === `/mentor/${s.id}`;
          const armed = confirmId === s.id;
          return (
            <li key={s.id} className="group flex items-stretch border-b border-(--crt-line)">
              <Link
                href={`/mentor/${s.id}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "crt-micro min-w-0 flex-1 truncate px-3 py-2.5 text-[11px] transition-colors",
                  active
                    ? "bg-(--crt-raised) font-bold text-(--crt-ink)"
                    : "text-(--crt-dim) hover:bg-(--crt-ink) hover:text-(--crt-bg)",
                )}
              >
                {active ? "> " : ""}
                {s.title}
              </Link>
              <button
                type="button"
                onClick={() => void remove(s.id)}
                aria-label={armed ? `Confirm delete ${s.title}` : `Delete ${s.title}`}
                title={armed ? "CLICK AGAIN TO CONFIRM" : "DELETE CHAT"}
                className={cn(
                  "crt-micro shrink-0 px-3 text-[11px] font-bold transition-colors focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-(--crt-red)",
                  armed
                    ? "bg-(--crt-red) text-(--crt-bg) opacity-100"
                    : "text-(--crt-dim) hover:bg-(--crt-red) hover:text-(--crt-bg) md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100",
                )}
              >
                {armed ? "[!] " : "X"}
              </button>
            </li>
          );
        })}
      </ul>
      {failed ? (
        <p role="alert" className="crt-micro px-1 py-2 text-[10px] text-(--crt-red)">
          !! DELETE FAILED — RETRY.
        </p>
      ) : null}
    </>
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
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mentor-sessions"
          className="crt-btn-line"
        >
          {open ? "HIDE CHATS" : "[ MY CHATS ]"}
        </button>
      </div>
      <div
        id="mentor-sessions"
        className={cn(
          "w-full md:block md:w-64 md:shrink-0",
          open ? "block" : "hidden",
        )}
      >
        <aside
          aria-label="Chat sessions"
          className="flex flex-col gap-3 border border-(--crt-line) bg-(--crt-bg) p-3"
        >
          <p className="crt-micro px-1 text-[10px] text-(--crt-dim)">
            [ SESSION-REGISTRY ]
          </p>
          <NewChatButton />
          <nav className="max-h-[40vh] overflow-y-auto border-t border-(--crt-line) md:max-h-[60vh]">
            <SessionList sessions={sessions} />
          </nav>
        </aside>
      </div>
      <section aria-label="Conversation" className="flex min-h-[60vh] min-w-0 flex-1 flex-col border border-(--crt-line) bg-(--crt-bg) p-4 sm:p-5">
        {children}
      </section>
    </div>
  );
}
