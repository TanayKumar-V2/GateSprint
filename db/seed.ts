import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { subjects, topics } from "./schema";

/* ---------- Subjects (the 12 GATE CS/IT areas) ---------- */

const SUBJECTS: { slug: string; name: string; order: number }[] = [
  { slug: "engineering-mathematics", name: "Engineering Mathematics", order: 1 },
  { slug: "discrete-mathematics", name: "Discrete Mathematics", order: 2 },
  { slug: "digital-logic", name: "Digital Logic", order: 3 },
  {
    slug: "computer-organization",
    name: "Computer Organization and Architecture",
    order: 4,
  },
  {
    slug: "programming-data-structures",
    name: "Programming and Data Structures",
    order: 5,
  },
  { slug: "algorithms", name: "Algorithms", order: 6 },
  { slug: "theory-of-computation", name: "Theory of Computation", order: 7 },
  { slug: "compiler-design", name: "Compiler Design", order: 8 },
  { slug: "operating-systems", name: "Operating Systems", order: 9 },
  { slug: "databases", name: "Databases", order: 10 },
  { slug: "computer-networks", name: "Computer Networks", order: 11 },
  { slug: "general-aptitude", name: "General Aptitude", order: 12 },
];

const TOPICS: { subject: string; slug: string; name: string }[] = [
  { subject: "engineering-mathematics", slug: "linear-algebra", name: "Linear Algebra" },
  { subject: "engineering-mathematics", slug: "probability", name: "Probability" },
  { subject: "discrete-mathematics", slug: "propositional-logic", name: "Propositional Logic" },
  { subject: "discrete-mathematics", slug: "graph-theory", name: "Graph Theory" },
  { subject: "digital-logic", slug: "boolean-algebra", name: "Boolean Algebra" },
  { subject: "digital-logic", slug: "sequential-circuits", name: "Sequential Circuits" },
  { subject: "computer-organization", slug: "cache-memory", name: "Cache Memory" },
  { subject: "computer-organization", slug: "pipelining", name: "Pipelining" },
  { subject: "programming-data-structures", slug: "trees", name: "Trees" },
  { subject: "programming-data-structures", slug: "stacks-queues", name: "Stacks and Queues" },
  { subject: "algorithms", slug: "asymptotic-analysis", name: "Asymptotic Analysis" },
  { subject: "algorithms", slug: "divide-and-conquer", name: "Divide and Conquer" },
  { subject: "theory-of-computation", slug: "regular-languages", name: "Regular Languages" },
  { subject: "theory-of-computation", slug: "context-free-languages", name: "Context-Free Languages" },
  { subject: "compiler-design", slug: "parsing", name: "Parsing" },
  { subject: "operating-systems", slug: "cpu-scheduling", name: "CPU Scheduling" },
  { subject: "databases", slug: "normal-forms", name: "Normalization" },
  { subject: "databases", slug: "indexing", name: "Indexing" },
  { subject: "computer-networks", slug: "ip-addressing", name: "IP Addressing" },
  { subject: "general-aptitude", slug: "numerical-ability", name: "Numerical Ability" },
  { subject: "discrete-mathematics", slug: "combinatorics", name: "Combinatorics" },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, {
    schema: { subjects, topics },
  });

  try {
    // Subjects (idempotent on slug).
    for (const s of SUBJECTS) {
      await db
        .insert(subjects)
        .values({
          slug: s.slug,
          name: s.name,
          displayOrder: s.order,
        })
        .onConflictDoNothing({ target: subjects.slug });
    }
    const subjectRows = await db.select().from(subjects);
    const subjectId = new Map(subjectRows.map((r) => [r.slug, r.id]));

    // Topics (idempotent on subject+slug).
    for (const [i, t] of TOPICS.entries()) {
      const sid = subjectId.get(t.subject);
      if (!sid) throw new Error(`Unknown subject ${t.subject}`);
      await db
        .insert(topics)
        .values({
          subjectId: sid,
          slug: t.slug,
          name: t.name,
          displayOrder: i,
        })
        .onConflictDoNothing();
    }
    const topicRows = await db.select().from(topics);

    // The bank holds only PDF-extracted questions. Demo questions were
    // removed and must never be reseeded — imports arrive through the
    // admin pipeline (or db/import-json.ts), never from this script.

    console.log(
      `Seeded ${subjectRows.length} subjects, ${topicRows.length} topics.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
