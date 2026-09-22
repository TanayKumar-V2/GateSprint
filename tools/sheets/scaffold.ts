/**
 * Sheet scaffold pipeline (human-in-the-loop).
 *
 * Generates a Markdown DRAFT for one topic from its published questions and
 * curated solutions — structure only, for a human to rewrite into a dense
 * one-shot sheet. NEVER writes to the database: an admin reviews the draft
 * and publishes it with PUT /api/admin/sheets/[topicId].
 *
 * Usage: npx tsx tools/sheets/scaffold.ts <topic-slug> [--subject <slug>]
 */
import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { questions, solutions, subjects, topics } from "@/db/schema";

const rawSlug = process.argv[2];
const subjectFlag = process.argv.indexOf("--subject");
const subjectSlug = subjectFlag >= 0 ? process.argv[subjectFlag + 1] : undefined;

if (!rawSlug || !/^[a-z0-9-]+$/.test(rawSlug)) {
  console.error("Usage: npx tsx tools/sheets/scaffold.ts <topic-slug> [--subject <slug>]");
  process.exit(1);
}
const slug: string = rawSlug;

async function main() {
  const subjectRows = subjectSlug
    ? await db.select().from(subjects).where(eq(subjects.slug, subjectSlug)).limit(1)
    : [];
  const topicRows = await db
    .select({
      id: topics.id,
      slug: topics.slug,
      name: topics.name,
      subjectId: topics.subjectId,
      subjectName: subjects.name,
      subjectSlug: subjects.slug,
    })
    .from(topics)
    .innerJoin(subjects, eq(topics.subjectId, subjects.id))
    .where(
      subjectRows[0]
        ? and(eq(topics.slug, slug), eq(topics.subjectId, subjectRows[0].id))
        : eq(topics.slug, slug),
    );
  if (topicRows.length !== 1) {
    console.error(`Expected exactly 1 topic for slug "${slug}", found ${topicRows.length}.`);
    process.exit(1);
  }
  const topic = topicRows[0]!;

  const qs = await db
    .select({
      year: questions.year,
      type: questions.type,
      difficulty: questions.difficulty,
      prompt: questions.prompt,
      marks: questions.marks,
      solution: solutions.content,
    })
    .from(questions)
    .leftJoin(
      solutions,
      and(eq(solutions.questionId, questions.id), eq(solutions.solutionType, "curated")),
    )
    .where(and(eq(questions.topicId, topic.id), eq(questions.isPublished, true)))
    .orderBy(questions.year);

  const lines = [
    `<!-- DRAFT for ${topic.subjectName} / ${topic.name}. Human review required.`,
    `     Publish with: PUT /api/admin/sheets/<topicId> {"contentMd": "..."} -->`,
    ``,
    `# ${topic.name} — one-shot sheet (DRAFT)`,
    ``,
    `## Formulas`,
    ``,
    `- [ ] Fill in: the 5–10 formulas worth memorizing for ${topic.name}.`,
    ``,
    `## Traps`,
    ``,
    `- [ ] Fill in: the distractors GATE reuses here, and why each is tempting.`,
    ``,
    `## 5 PYQ patterns`,
    ``,
  ];
  for (const q of qs.slice(0, 12)) {
    const prompt = q.prompt.replace(/\s+/g, " ").slice(0, 220);
    lines.push(`- GATE ${q.year} [${q.type}/${q.difficulty}/${q.marks}M]: ${prompt}${q.solution ? "" : " (no solution yet)"}`);
  }
  if (qs.length === 0) lines.push("- (no published questions in this topic yet)");
  lines.push("", `## Recall checklist`, "", `- [ ] Fill in: 3 questions the student should answer cold.`, "");

  const md = lines.join("\n");
  await mkdir("tools/sheets/drafts", { recursive: true });
  const path = `tools/sheets/drafts/${topic.subjectSlug}--${topic.slug}.md`;
  await writeFile(path, md);
  console.log(`Draft for ${topic.subjectName} / ${topic.name} (${qs.length} PYQs) -> ${path}`);
  console.log("Review it, rewrite it dense, then publish via PUT /api/admin/sheets/[topicId].");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
