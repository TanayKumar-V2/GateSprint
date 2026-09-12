import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { questions, solutions, subjects, topics, type CorrectAnswer } from "@/db/schema";
import { currentAdmin } from "@/lib/admin";
import { badRequest, forbidden, notFoundPrivate, unauthorized } from "@/lib/api/respond";
import { isAllowedOrigin } from "@/lib/security/origin";

const payload = z.object({
  subjectId: z.string().uuid(), topicId: z.string().uuid(), year: z.number().int().min(1990).max(2100),
  questionNumber: z.number().int().min(1).nullable(), type: z.enum(["mcq", "msq", "nat"]), difficulty: z.enum(["easy", "medium", "hard"]),
  prompt: z.string().trim().min(1).max(12000), options: z.array(z.object({ id: z.string().regex(/^[A-Z]$/), text: z.string().trim().min(1).max(1000) })).nullable(),
  correctAnswer: z.unknown(), marks: z.number().positive().max(20), negativeMarks: z.number().min(0).max(20), sourceLabel: z.string().trim().max(200).nullable(), externalId: z.string().trim().max(200).nullable().optional(), sourcePage: z.number().int().positive().nullable().optional(), extractionConfidence: z.number().min(0).max(1).nullable().optional(), solution: z.string().trim().min(1).max(16000), isPublished: z.boolean(),
});

async function guard(request: Request) {
  if (!(await currentAdmin())) return unauthorized("Admin sign-in required.");
  if (!isAllowedOrigin(request)) return forbidden();
  return null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ questionId: string }> }) {
  const blocked = await guard(request);
  if (blocked) return blocked;
  const { questionId } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return badRequest("Send valid JSON."); }
  const parsed = payload.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Invalid question.");
  const data = parsed.data;
  if (data.type === "nat" && data.options !== null) return badRequest("NAT questions cannot have options.");
  if (data.type !== "nat" && (!data.options || data.options.length < 2)) return badRequest("MCQ and MSQ questions need options.");
  const topic = await db.select({ id: topics.id }).from(topics).innerJoin(subjects, eq(topics.subjectId, subjects.id)).where(and(eq(topics.id, data.topicId), eq(subjects.id, data.subjectId))).limit(1);
  if (!topic[0]) return badRequest("Topic does not belong to the selected subject.");
  const updated = await db.update(questions).set({ ...data, correctAnswer: data.correctAnswer as CorrectAnswer, externalId: data.externalId ?? null, sourcePage: data.sourcePage ?? null, extractionConfidence: data.extractionConfidence ?? null, updatedAt: new Date() }).where(eq(questions.id, questionId)).returning();
  if (!updated[0]) return notFoundPrivate();
  await db.insert(solutions).values({ questionId, content: data.solution, solutionType: "curated" }).onConflictDoUpdate({ target: [solutions.questionId, solutions.solutionType], set: { content: data.solution, updatedAt: new Date() } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ questionId: string }> }) {
  const blocked = await guard(request);
  if (blocked) return blocked;
  const { questionId } = await params;
  const deleted = await db.delete(questions).where(eq(questions.id, questionId)).returning();
  if (!deleted[0]) return notFoundPrivate();
  return NextResponse.json({ ok: true });
}
