import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { subjects, topics } from "@/db/schema";
import { EmptyMentor } from "@/components/chat/empty-mentor";
import { RevisionStarter } from "@/components/chat/revision-starter";

export default async function MentorPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; topic?: string }>;
}) {
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

  return (
    <div className="flex flex-col gap-4">
      {revision ? (
        <RevisionStarter
          subjectName={revision.subjectName}
          topicName={revision.topicName}
          topicId={revision.topicId}
        />
      ) : null}
      <EmptyMentor />
    </div>
  );
}
