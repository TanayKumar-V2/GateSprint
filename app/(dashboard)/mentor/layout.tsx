import { redirect } from "next/navigation";
import { currentUserId } from "@/lib/current-user";
import { listSessions } from "@/lib/chat";
import { MentorShell } from "@/components/chat/sidebar";

export default async function MentorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await currentUserId();
  if (!userId) redirect("/sign-in");

  const sessions = await listSessions(userId);
  return (
    <div className="flex min-h-[70vh] flex-col gap-6">
      <header>
        <p className="crt-micro text-[11px] text-(--crt-red)">[ 02 {"///"} MENTOR-CHANNEL ]</p>
        <h1 className="crt-macro mt-2 text-[clamp(2.2rem,7vw,5.5rem)] text-(--crt-ink)">
          MENTOR<span className="text-(--crt-red)">.</span>
        </h1>
        <p className="crt-micro mt-3 text-[11px] text-(--crt-dim)">
          WORK THROUGH A CONCEPT WITH CONTEXT, NOT A BLANK CHAT BOX.
        </p>
      </header>
      <MentorShell sessions={sessions}>{children}</MentorShell>
    </div>
  );
}
