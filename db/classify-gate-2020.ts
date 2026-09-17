import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { questions, subjects, topics } from "./schema";

/**
 * One-shot classification + publish for the GATE 2020 CS import.
 *
 * The extractor stores no subject/topic, so the import pipeline parks those
 * rows under Uncategorized / Needs Review as unpublished drafts. This script
 * moves each of the 65 quarantined questions to its real subject/topic
 * (creating missing topics) and publishes it.
 *
 * Safe to rerun: it only touches rows still sitting in the quarantine
 * bucket, so already-classified questions are never overwritten.
 */

const NEW_TOPICS: { subject: string; slug: string; name: string }[] = [
  { subject: "general-aptitude", slug: "verbal-ability", name: "Verbal Ability" },
  { subject: "general-aptitude", slug: "logical-reasoning", name: "Logical Reasoning" },
  { subject: "general-aptitude", slug: "spatial-reasoning", name: "Spatial Reasoning" },
  { subject: "engineering-mathematics", slug: "calculus", name: "Calculus" },
  { subject: "digital-logic", slug: "computer-arithmetic", name: "Computer Arithmetic" },
  { subject: "computer-organization", slug: "instruction-set-architecture", name: "Instruction Set Architecture" },
  { subject: "computer-organization", slug: "virtual-memory", name: "Virtual Memory" },
  { subject: "programming-data-structures", slug: "heaps", name: "Heaps" },
  { subject: "programming-data-structures", slug: "hashing", name: "Hashing" },
  { subject: "programming-data-structures", slug: "linked-lists", name: "Linked Lists" },
  { subject: "programming-data-structures", slug: "programming-in-c", name: "Programming in C" },
  { subject: "algorithms", slug: "shortest-paths", name: "Shortest Paths" },
  { subject: "algorithms", slug: "minimum-spanning-trees", name: "Minimum Spanning Trees" },
  { subject: "algorithms", slug: "graph-traversal", name: "Graph Traversal" },
  { subject: "compiler-design", slug: "lexical-analysis", name: "Lexical Analysis" },
  { subject: "compiler-design", slug: "code-optimization", name: "Code Optimization" },
  { subject: "compiler-design", slug: "syntax-directed-translation", name: "Syntax-Directed Translation" },
  { subject: "operating-systems", slug: "deadlocks", name: "Deadlocks" },
  { subject: "operating-systems", slug: "secondary-storage", name: "Secondary Storage and I/O" },
  { subject: "operating-systems", slug: "processes", name: "Processes" },
  { subject: "databases", slug: "functional-dependencies", name: "Functional Dependencies" },
  { subject: "databases", slug: "relational-algebra", name: "Relational Algebra" },
  { subject: "computer-networks", slug: "transport-layer", name: "Transport Layer" },
  { subject: "computer-networks", slug: "application-layer", name: "Application Layer" },
  { subject: "computer-networks", slug: "data-link-layer", name: "Data Link Layer" },
];

/** GATE 2020 question number -> real taxonomy home. */
const CLASSIFICATION: Record<number, { subject: string; topic: string }> = {
  1: { subject: "general-aptitude", topic: "verbal-ability" }, // antonym
  2: { subject: "general-aptitude", topic: "spatial-reasoning" }, // tile patterns
  3: { subject: "general-aptitude", topic: "numerical-ability" }, // tournament games
  4: { subject: "general-aptitude", topic: "numerical-ability" }, // credit constraints
  5: { subject: "general-aptitude", topic: "logical-reasoning" }, // implication logic
  6: { subject: "general-aptitude", topic: "verbal-ability" }, // passage inference
  7: { subject: "general-aptitude", topic: "spatial-reasoning" }, // 3D views
  8: { subject: "general-aptitude", topic: "numerical-ability" }, // piecewise graph
  9: { subject: "general-aptitude", topic: "logical-reasoning" }, // javelin ordering puzzle
  10: { subject: "general-aptitude", topic: "numerical-ability" }, // dice probability
  11: { subject: "engineering-mathematics", topic: "probability" }, // Polya's urn
  12: { subject: "discrete-mathematics", topic: "combinatorics" }, // binary matrix parity count
  13: { subject: "engineering-mathematics", topic: "linear-algebra" }, // eigenvalue multiplicity
  14: { subject: "computer-organization", topic: "instruction-set-architecture" }, // addressing modes
  15: { subject: "computer-organization", topic: "instruction-set-architecture" }, // load-store sequence
  16: { subject: "computer-organization", topic: "pipelining" }, // data hazards
  17: { subject: "algorithms", topic: "divide-and-conquer" }, // recurrences
  18: { subject: "computer-networks", topic: "transport-layer" }, // TCP connection
  19: { subject: "computer-networks", topic: "application-layer" }, // HTTP 1.1
  20: { subject: "engineering-mathematics", topic: "linear-algebra" }, // null space / rank
  21: { subject: "digital-logic", topic: "boolean-algebra" }, // Boolean equivalence
  22: { subject: "digital-logic", topic: "computer-arithmetic" }, // sign-magnitude overflow
  23: { subject: "programming-data-structures", topic: "heaps" }, // min-heap leaves
  24: { subject: "programming-data-structures", topic: "hashing" }, // linear probing
  25: { subject: "theory-of-computation", topic: "context-free-languages" }, // grammar ambiguity
  26: { subject: "theory-of-computation", topic: "regular-languages" }, // NFA to DFA states
  27: { subject: "compiler-design", topic: "lexical-analysis" }, // lexical vs syntax errors
  28: { subject: "compiler-design", topic: "parsing" }, // LL(1)
  29: { subject: "operating-systems", topic: "deadlocks" }, // deadlock statements
  30: { subject: "databases", topic: "functional-dependencies" }, // Armstrong axioms
  31: { subject: "databases", topic: "normal-forms" }, // 3NF/BCNF decomposition
  32: { subject: "engineering-mathematics", topic: "calculus" }, // continuity
  33: { subject: "programming-data-structures", topic: "trees" }, // full binary tree height
  34: { subject: "programming-data-structures", topic: "programming-in-c" }, // C scoping trace
  35: { subject: "operating-systems", topic: "deadlocks" }, // deadlock-free resource count
  36: { subject: "digital-logic", topic: "computer-arithmetic" }, // IEEE 754 addition
  37: { subject: "digital-logic", topic: "sequential-circuits" }, // saturating counter
  38: { subject: "computer-organization", topic: "cache-memory" }, // cache TAG bits
  39: { subject: "programming-data-structures", topic: "linked-lists" }, // list size recursion
  40: { subject: "programming-data-structures", topic: "trees" }, // complete BST insertion
  41: { subject: "algorithms", topic: "shortest-paths" }, // bounded-length shortest paths
  42: { subject: "compiler-design", topic: "code-optimization" }, // common subexpressions
  43: { subject: "databases", topic: "relational-algebra" }, // tuple calculus to algebra
  44: { subject: "computer-networks", topic: "transport-layer" }, // TCP slow start
  45: { subject: "computer-networks", topic: "data-link-layer" }, // sliding window sizing
  46: { subject: "engineering-mathematics", topic: "calculus" }, // extrema / differentiability
  47: { subject: "discrete-mathematics", topic: "graph-theory" }, // vertex cover
  48: { subject: "digital-logic", topic: "boolean-algebra" }, // K-map minimization
  49: { subject: "algorithms", topic: "minimum-spanning-trees" }, // MST properties
  50: { subject: "algorithms", topic: "graph-traversal" }, // DFS on a DAG
  51: { subject: "theory-of-computation", topic: "regular-languages" }, // regularity closure
  52: { subject: "theory-of-computation", topic: "context-free-languages" }, // CFG string counts
  53: { subject: "compiler-design", topic: "syntax-directed-translation" }, // SDD attributes
  54: { subject: "computer-organization", topic: "virtual-memory" }, // TLB / cache / page table
  55: { subject: "discrete-mathematics", topic: "graph-theory" }, // 2-colorability
  56: { subject: "computer-networks", topic: "ip-addressing" }, // CIDR allocation
  57: { subject: "discrete-mathematics", topic: "graph-theory" }, // matchings on a path
  58: { subject: "engineering-mathematics", topic: "probability" }, // expected value
  59: { subject: "operating-systems", topic: "secondary-storage" }, // disk transfer time
  60: { subject: "computer-organization", topic: "pipelining" }, // structural hazards
  61: { subject: "programming-data-structures", topic: "programming-in-c" }, // recursion trace
  62: { subject: "programming-data-structures", topic: "trees" }, // BST preorder/postorder
  63: { subject: "operating-systems", topic: "processes" }, // fork() count
  64: { subject: "operating-systems", topic: "cpu-scheduling" }, // FCFS waiting time
  65: { subject: "databases", topic: "functional-dependencies" }, // superkey count
};

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema: { questions, subjects, topics } });

  try {
    const subjectRows = await db.select().from(subjects);
    const subjectId = new Map(subjectRows.map((r) => [r.slug, r.id]));
    for (const t of NEW_TOPICS) {
      const sid = subjectId.get(t.subject);
      if (!sid) throw new Error(`Unknown subject slug: ${t.subject}`);
      await db
        .insert(topics)
        .values({ subjectId: sid, slug: t.slug, name: t.name })
        .onConflictDoNothing();
    }
    const topicRows = await db.select().from(topics);
    const topicId = new Map(
      topicRows.map((r) => [`${r.subjectId}:${r.slug}`, r.id]),
    );

    const quarantineId = subjectId.get("uncategorized");
    if (!quarantineId) {
      console.log("No uncategorized subject — nothing to do.");
      return;
    }
    const quarantined = await db
      .select({
        id: questions.id,
        questionNumber: questions.questionNumber,
        year: questions.year,
      })
      .from(questions)
      .where(eq(questions.subjectId, quarantineId));

    let classified = 0;
    const unmapped: (number | null)[] = [];
    for (const q of quarantined) {
      const mapping =
        q.questionNumber != null ? CLASSIFICATION[q.questionNumber] : undefined;
      if (!mapping) {
        unmapped.push(q.questionNumber);
        continue;
      }
      const sid = subjectId.get(mapping.subject);
      const tid = sid ? topicId.get(`${sid}:${mapping.topic}`) : undefined;
      if (!sid || !tid) throw new Error(`Unresolved mapping for Q${q.questionNumber}`);
      await db
        .update(questions)
        .set({ subjectId: sid, topicId: tid, isPublished: true, updatedAt: new Date() })
        .where(and(eq(questions.id, q.id), eq(questions.subjectId, quarantineId)));
      classified += 1;
      if (classified % 10 === 0) console.log(`Classified ${classified}...`);
    }

    console.log(`\nClassified + published ${classified} questions.`);
    if (unmapped.length > 0) {
      console.log(`Left in quarantine (no mapping): ${unmapped.join(", ")}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Classification failed:", err);
  process.exit(1);
});
