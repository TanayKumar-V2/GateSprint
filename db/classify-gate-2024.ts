import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { questions, subjects, topics } from "./schema";

/**
 * One-shot classification + publish for the GATE 2024 CS (Set 2) import.
 *
 * The extractor stores no subject/topic, so the import pipeline parks those
 * rows under Uncategorized / Needs Review. This script moves each of the 65
 * quarantined 2024 questions to its real subject/topic (creating the missing
 * topics) and publishes it.
 *
 * Mirrors db/classify-gate-2020.ts. Safe to rerun: it only touches year-2024
 * rows still sitting in the quarantine bucket, so already-classified
 * questions (and other years) are never overwritten.
 */

const NEW_TOPICS: { subject: string; slug: string; name: string }[] = [
  { subject: "databases", slug: "er-model", name: "ER Model" },
  { subject: "databases", slug: "file-organization", name: "File Organization" },
  { subject: "compiler-design", slug: "compiler-phases", name: "Compiler Phases" },
  { subject: "compiler-design", slug: "intermediate-code", name: "Intermediate Code Generation" },
  { subject: "algorithms", slug: "dynamic-programming", name: "Dynamic Programming" },
  { subject: "operating-systems", slug: "synchronization", name: "Synchronization" },
];

/** GATE 2024 (CS Set 2) question number -> real taxonomy home. */
const CLASSIFICATION: Record<number, { subject: string; topic: string }> = {
  1: { subject: "general-aptitude", topic: "verbal-ability" }, // intensity analogy
  2: { subject: "general-aptitude", topic: "numerical-ability" }, // element permutations
  3: { subject: "general-aptitude", topic: "numerical-ability" }, // branch preference sets
  4: { subject: "general-aptitude", topic: "numerical-ability" }, // logarithm equation
  5: { subject: "general-aptitude", topic: "numerical-ability" }, // number sequence
  6: { subject: "general-aptitude", topic: "verbal-ability" }, // sentence ordering
  7: { subject: "general-aptitude", topic: "numerical-ability" }, // profit and loss
  8: { subject: "general-aptitude", topic: "numerical-ability" }, // power-share pie charts
  9: { subject: "general-aptitude", topic: "spatial-reasoning" }, // cube cuts
  10: { subject: "general-aptitude", topic: "logical-reasoning" }, // 4x4 cross/number grid
  11: { subject: "computer-organization", topic: "interrupts-and-io" }, // DMA transfer rate
  12: { subject: "discrete-mathematics", topic: "propositional-logic" }, // fail-grade proposition
  13: { subject: "programming-data-structures", topic: "programming-in-c" }, // evaluation-order trace
  14: { subject: "digital-logic", topic: "computer-arithmetic" }, // IEEE 754 largest value
  15: { subject: "algorithms", topic: "divide-and-conquer" }, // linear recurrence growth
  16: { subject: "engineering-mathematics", topic: "calculus" }, // definite integral
  17: { subject: "discrete-mathematics", topic: "graph-theory" }, // self-inverse adjacency matrix
  18: { subject: "engineering-mathematics", topic: "probability" }, // six-dice distinct faces
  19: { subject: "databases", topic: "transactions" }, // durability property
  20: { subject: "databases", topic: "er-model" }, // owner and weak entity sets
  21: { subject: "compiler-design", topic: "compiler-phases" }, // phase-to-artifact matching
  22: { subject: "theory-of-computation", topic: "regular-languages" }, // DFA to regex
  23: { subject: "computer-networks", topic: "network-layer" }, // dest IP/MAC leaving host
  24: { subject: "computer-organization", topic: "virtual-memory" }, // MMU responsibilities
  25: { subject: "operating-systems", topic: "processes" }, // context-switch triggers
  26: { subject: "databases", topic: "file-organization" }, // scan-efficient file orgs
  27: { subject: "databases", topic: "transactions" }, // 2PL statements
  28: { subject: "computer-networks", topic: "network-layer" }, // IPv4 fragmentation
  29: { subject: "compiler-design", topic: "syntax-directed-translation" }, // attribute grammars
  30: { subject: "digital-logic", topic: "boolean-algebra" }, // Boolean statements
  31: { subject: "computer-organization", topic: "pipelining" }, // DIV/SUB/ADD hazards
  32: { subject: "computer-networks", topic: "network-layer" }, // router-modified IP fields
  33: { subject: "programming-data-structures", topic: "programming-in-c" }, // strlen-style function
  34: { subject: "discrete-mathematics", topic: "sets-relations-functions" }, // linear extensions of a poset
  35: { subject: "algorithms", topic: "dynamic-programming" }, // min replacements to sort (LNDS)
  36: { subject: "programming-data-structures", topic: "programming-in-c" }, // pointer arithmetic output
  37: { subject: "operating-systems", topic: "cpu-scheduling" }, // arrival/burst schedule
  38: { subject: "computer-networks", topic: "ip-addressing" }, // CIDR range question
  39: { subject: "programming-data-structures", topic: "trees" }, // BST construction
  40: { subject: "compiler-design", topic: "parsing" }, // LL(1) table completion
  41: { subject: "theory-of-computation", topic: "regular-languages" }, // regex for NFA language
  42: { subject: "programming-data-structures", topic: "programming-in-c" }, // subarray C-code completion
  43: { subject: "compiler-design", topic: "intermediate-code" }, // triples completion
  44: { subject: "engineering-mathematics", topic: "probability" }, // mean of product
  45: { subject: "databases", topic: "relational-algebra" }, // cities query
  46: { subject: "operating-systems", topic: "synchronization" }, // semaphore interleavings
  47: { subject: "engineering-mathematics", topic: "linear-algebra" }, // row-swapped matrix
  48: { subject: "programming-data-structures", topic: "stacks-queues" }, // two-stack operations
  49: { subject: "digital-logic", topic: "computer-arithmetic" }, // radix-5 equivalence
  50: { subject: "digital-logic", topic: "boolean-algebra" }, // minterm circuit
  51: { subject: "discrete-mathematics", topic: "graph-theory" }, // even-weight spanning trees
  52: { subject: "theory-of-computation", topic: "context-free-languages" }, // grammar count properties
  53: { subject: "operating-systems", topic: "secondary-storage" }, // disk access time NAT
  54: { subject: "computer-networks", topic: "transport-layer" }, // TCP cwnd after timeout NAT
  55: { subject: "computer-networks", topic: "data-link-layer" }, // CSMA/CD frame size NAT
  56: { subject: "databases", topic: "functional-dependencies" }, // useful FD count NAT
  57: { subject: "computer-organization", topic: "instruction-set-architecture" }, // opcode encoding NAT
  58: { subject: "computer-organization", topic: "pipelining" }, // pipeline speedup NAT
  59: { subject: "algorithms", topic: "minimum-spanning-trees" }, // distinct MST count NAT
  60: { subject: "discrete-mathematics", topic: "graph-theory" }, // chromatic number NAT
  61: { subject: "computer-organization", topic: "instruction-set-architecture" }, // R/I-type formats NAT
  62: { subject: "theory-of-computation", topic: "regular-languages" }, // bounded-length strings NAT
  63: { subject: "discrete-mathematics", topic: "algebraic-structures" }, // self-inverse group elements NAT
  64: { subject: "computer-organization", topic: "virtual-memory" }, // 2-level page table NAT
  65: { subject: "compiler-design", topic: "parsing" }, // SLR GOTO items NAT
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
      .where(and(eq(questions.subjectId, quarantineId), eq(questions.year, 2024)));

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
