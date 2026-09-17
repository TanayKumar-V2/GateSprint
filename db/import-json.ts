import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  subjects,
  topics,
  questions,
  questionImages,
  type CorrectAnswer,
} from "./schema";
import * as fs from "fs";

type ExtractedImage = {
  filename: string;
  mime: string;
  width?: number;
  height?: number;
  url?: string;
  data?: string;
};

type ExtractedQuestion = {
  externalId: string;
  year: number | null;
  questionNumber: number | null;
  subject: string;
  topic: string;
  type: "mcq" | "msq" | "nat";
  difficulty: "easy" | "medium" | "hard";
  prompt: string;
  options: { id: string; text: string }[] | null;
  correctAnswer: CorrectAnswer | null;
  marks: number;
  negativeMarks: number;
  sourceLabel: string;
  sourcePage: number | null;
  confidence: number;
  images: ExtractedImage[];
};

const SUBJECT_MAP: Record<string, string> = {
  "Engineering Mathematics": "engineering-mathematics",
  "Discrete Mathematics": "discrete-mathematics",
  "Digital Logic": "digital-logic",
  "Computer Organization": "computer-organization",
  "Programming and Data Structures": "programming-data-structures",
  Algorithms: "algorithms",
  "Theory of Computation": "theory-of-computation",
  "Compiler Design": "compiler-design",
  "Operating Systems": "operating-systems",
  Databases: "databases",
  "Computer Networks": "computer-networks",
  "General Aptitude": "general-aptitude",
  Uncategorized: "uncategorized",
};

const TOPIC_MAP: Record<string, string> = {
  "Linear Algebra": "linear-algebra",
  Probability: "probability",
  "Propositional Logic": "propositional-logic",
  "Graph Theory": "graph-theory",
  "Boolean Algebra": "boolean-algebra",
  "Sequential Circuits": "sequential-circuits",
  "Cache Memory": "cache-memory",
  Pipelining: "pipelining",
  Trees: "trees",
  "Stacks and Queues": "stacks-queues",
  "Asymptotic Analysis": "asymptotic-analysis",
  "Divide and Conquer": "divide-and-conquer",
  "Regular Languages": "regular-languages",
  "Context-Free Languages": "context-free-languages",
  Parsing: "parsing",
  "CPU Scheduling": "cpu-scheduling",
  Normalization: "normal-forms",
  Indexing: "indexing",
  "IP Addressing": "ip-addressing",
  "Numerical Ability": "numerical-ability",
  Combinatorics: "combinatorics",
  "Needs Review": "needs-review",
};

async function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.error("Usage: npx tsx db/import-json.ts <path-to-questions.json>");
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");

  const rawData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  const extracted: ExtractedQuestion[] = rawData.questions ?? rawData;

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema: { subjects, topics, questions, questionImages } });

  try {
    // Ensure subjects exist
    for (const [name, slug] of Object.entries(SUBJECT_MAP)) {
      await db
        .insert(subjects)
        .values({ slug, name, displayOrder: Object.keys(SUBJECT_MAP).indexOf(name) })
        .onConflictDoNothing({ target: subjects.slug });
    }
    const subjectRows = await db.select().from(subjects);
    const subjectIdBySlug = new Map(subjectRows.map((r) => [r.slug, r.id]));

    // Ensure topics exist
    const uniqueTopics = new Set(extracted.map((q) => `${q.subject}|${q.topic}`));
    let order = 0;
    for (const key of uniqueTopics) {
      const [subjectName, topicName] = key.split("|");
      if (!subjectName || !topicName) throw new Error(`Bad topic key: ${key}`);
      const subjectSlug = SUBJECT_MAP[subjectName];
      if (!subjectSlug) throw new Error(`Unknown subject: ${subjectName}`);
      const topicSlug = TOPIC_MAP[topicName] || topicName.toLowerCase().replace(/\s+/g, "-");
      const subjectId = subjectIdBySlug.get(subjectSlug);
      if (!subjectId) throw new Error(`Unknown subject: ${subjectName}`);

      await db
        .insert(topics)
        .values({
          subjectId,
          slug: topicSlug,
          name: topicName,
          displayOrder: order++,
        })
        .onConflictDoNothing();
    }

    const topicRows = await db.select().from(topics);
    const topicIdBySlug = new Map(topicRows.map((r) => [`${r.subjectId}:${r.slug}`, r.id]));

    // Insert questions
    let inserted = 0;
    for (const q of extracted) {
      const subjectSlug = SUBJECT_MAP[q.subject] || q.subject.toLowerCase().replace(/\s+/g, "-");
      const subjectId = subjectIdBySlug.get(subjectSlug);
      if (!subjectId) {
        console.warn(`Unknown subject "${q.subject}", skipping question ${q.questionNumber}`);
        continue;
      }

      const topicSlug = TOPIC_MAP[q.topic] || q.topic.toLowerCase().replace(/\s+/g, "-");
      const topicId = topicIdBySlug.get(`${subjectId}:${topicSlug}`);
      if (!topicId) {
        console.warn(`Unknown topic "${q.topic}" for subject "${q.subject}", skipping question ${q.questionNumber}`);
        continue;
      }

      const result = await db
        .insert(questions)
        .values({
          subjectId,
          topicId,
          year: q.year || 2024,
          questionNumber: q.questionNumber,
          type: q.type,
          difficulty: q.difficulty,
          prompt: q.prompt,
          options: q.options,
          correctAnswer: q.correctAnswer,
          marks: q.marks,
          negativeMarks: q.negativeMarks,
          sourceLabel: q.sourceLabel,
          externalId: q.externalId,
          sourcePage: q.sourcePage,
          extractionConfidence: q.confidence,
          isPublished: true,
        })
        .returning({ id: questions.id });

      const questionId = result[0]?.id;
      if (!questionId) throw new Error(`Insert returned no id for ${q.externalId}`);

      // Insert images
      for (let i = 0; i < q.images.length; i++) {
        const img = q.images[i];
        if (!img) continue;
        await db
          .insert(questionImages)
          .values({
            questionId,
            position: i + 1,
            filename: img.filename,
            mime: img.mime,
            width: img.width || null,
            height: img.height || null,
            dataBase64: img.data || null,
            url: img.url || null,
          });
      }

      inserted++;
      if (inserted % 10 === 0) {
        console.log(`Inserted ${inserted} questions...`);
      }
    }

    console.log(`\n✅ Imported ${inserted} questions from ${jsonPath}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
