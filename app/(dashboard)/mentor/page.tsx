import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { subjects, topics } from "@/db/schema";
import { currentUserId } from "@/lib/current-user";
import { listSessions } from "@/lib/chat";
import { EmptyMentor } from "@/components/chat/empty-mentor";
import { RevisionStarter } from "@/components/chat/revision-starter";
import { redirect } from "next/navigation";

export default async function MentorPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; topic?: string }>;
}) {
  const userId = await currentUserId();
  if (!userId) redirect("/sign-in");
  const params = await searchParams;

  let revision: { subjectName: string; topicName: string; topicId: string } | null = null;
  if (params.subject && params.topic) {
    const rows = await db
      .select({
        topicId: topics.id,
        topicName: topics.name,
        subjectName: subjects.name,
      })
      .from(topics)
      .innerJoin(subjects, eq(topics.subjectId, subjects.id))
      .where(
        and(eq(topics.slug, params.topic), eq(subjects.slug, params.subject)),
      )
      .limit(1);
    if (rows[0]) {
      revision = {
        subjectName: rows[0].subjectName,
        topicName: rows[0].topicName,
        topicId: rows[0].topicId,
      };
    }
  }

  const recentSessions = await listSessions(userId, 3);

  return (
    <div className="flex flex-col gap-4">
      {revision ? (
        <RevisionStarter
          subjectName={revision.subjectName}
          topicName={revision.topicName}
          topicId={revision.topicId}
        />
      ) : null}
      <EmptyMentor recentSessions={recentSessions} />
    </div>
  );
}
