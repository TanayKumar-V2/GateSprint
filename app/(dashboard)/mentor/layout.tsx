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
    <div className="flex min-h-[70vh] flex-col">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Mentor</h1>
      <MentorShell sessions={sessions}>{children}</MentorShell>
    </div>
  );
}
