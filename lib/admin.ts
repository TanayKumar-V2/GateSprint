import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { questions, solutions, subjects, topics } from "@/db/schema";
import { auth } from "@/lib/auth";
import { listImagesForQuestions } from "@/lib/imports/images";

const DEFAULT_ADMIN_EMAILS = ["tanayk1807@gmail.com"];

export function adminEmails(): string[] {
  const configured = process.env.ADMIN_EMAILS
    ?.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return configured && configured.length > 0
    ? configured
    : DEFAULT_ADMIN_EMAILS;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email && adminEmails().includes(email.toLowerCase()));
}

export async function currentAdmin() {
  const session = await auth();
  const user = session?.user;
  return user && isAdminEmail(user.email) ? user : null;
}

export type AdminUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

/** Distinguishes "signed out" from "signed in but not an admin" so pages
 * can redirect the former and show an access-denied state to the latter
 * instead of bouncing them between sign-in and admin forever. */
export async function adminAccess(): Promise<
  { status: "ok"; user: AdminUser } | { status: "signed-out" } | { status: "denied" }
> {
  const session = await auth();
  if (!session?.user) return { status: "signed-out" };
  if (!isAdminEmail(session.user.email)) return { status: "denied" };
  return { status: "ok", user: session.user };
}

export async function listAdminQuestions() {
  const rows = await db
    .select({
      id: questions.id,
      year: questions.year,
      questionNumber: questions.questionNumber,
      type: questions.type,
      difficulty: questions.difficulty,
      prompt: questions.prompt,
      options: questions.options,
      correctAnswer: questions.correctAnswer,
      marks: questions.marks,
      negativeMarks: questions.negativeMarks,
      sourceLabel: questions.sourceLabel,
      externalId: questions.externalId,
      sourcePage: questions.sourcePage,
      extractionConfidence: questions.extractionConfidence,
      isPublished: questions.isPublished,
      subjectId: subjects.id,
      subjectName: subjects.name,
      subjectSlug: subjects.slug,
      topicId: topics.id,
      topicName: topics.name,
      topicSlug: topics.slug,
      solution: solutions.content,
    })
    .from(questions)
    .innerJoin(subjects, eq(questions.subjectId, subjects.id))
    .innerJoin(topics, eq(questions.topicId, topics.id))
    .leftJoin(
      solutions,
      and(eq(solutions.questionId, questions.id), eq(solutions.solutionType, "curated")),
    )
    .orderBy(desc(questions.updatedAt));
  const imageMap = await listImagesForQuestions(rows.map((row) => row.id));
  return rows.map((row) => ({
    ...row,
    images: imageMap.get(row.id) ?? [],
  }));
}

export async function listAdminTaxonomy() {
  const [subjectRows, topicRows] = await Promise.all([
    db.select({ id: subjects.id, name: subjects.name, slug: subjects.slug }).from(subjects).orderBy(subjects.displayOrder),
    db.select({ id: topics.id, name: topics.name, slug: topics.slug, subjectId: topics.subjectId }).from(topics).orderBy(topics.displayOrder),
  ]);
  return { subjects: subjectRows, topics: topicRows };
}
