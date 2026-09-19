/* Batched AI subject/topic repair for the imports route.
 * Pure builders/parsers live here (unit-tested in tests/classify.test.ts);
 * only classifyUnmappedItems touches the network, and the route treats any
 * failure as "classify nothing" so imports still land in quarantine. */

import { generateImportText } from "../ai/model-router";
import type { TaxonomySubject, TaxonomyTopic } from "./normalize";

/** Upper bound per import so one paper fits in a handful of model calls. */
export const MAX_CLASSIFY_ITEMS = 100;
/**
 * Rows per model call. The guided prompt carries ~3.3k tokens of fixed
 * overhead and each row is capped (~500 prompt + ~200 option chars), so 15
 * rows stay comfortably under the 8k TPM free-tier ceiling that a whole
 * 65-question paper (11k+ tokens) blows past.
 */
export const CLASSIFY_BATCH_SIZE = 15;
const BATCH_PAUSE_MS = 6000;
const RETRY_PAUSE_MS = 25000;
const MAX_PROMPT_CHARS = 500;
const MAX_OPTIONS_CHARS = 200;

export type ClassifyInput = {
  externalId: string;
  prompt: string;
  optionsText: string | null;
};

export function toClassifyInput(
  externalId: string,
  prompt: string,
  options: { id: string; text: string }[] | null,
): ClassifyInput {
  const optionsText = options?.length
    ? options.map((option) => `${option.id}: ${option.text}`).join(" | ")
    : null;
  return {
    externalId,
    prompt: prompt.slice(0, MAX_PROMPT_CHARS),
    optionsText:
      optionsText && optionsText.length > MAX_OPTIONS_CHARS
        ? optionsText.slice(0, MAX_OPTIONS_CHARS)
        : optionsText,
  };
}

export function taxonomyBlock(
  subjects: TaxonomySubject[],
  topics: TaxonomyTopic[],
): string {
  return subjects
    .map(
      (subject) =>
        subject.slug +
        ": " +
        topics
          .filter((topic) => topic.subjectId === subject.id)
          .map((topic) => topic.slug)
          .join(","),
    )
    .join("\n");
}

export function buildClassificationPrompt(
  items: ClassifyInput[],
  subjects: TaxonomySubject[],
  topics: TaxonomyTopic[],
): string {
  const rows = items.map((item) => ({
    externalId: item.externalId,
    prompt: item.prompt,
    ...(item.optionsText ? { options: item.optionsText } : {}),
  }));
  return (
    "Classify each GATE CSE question below into the taxonomy. " +
    "Use slugs EXACTLY as listed — never invent new ones. " +
    "When unsure about a question, use null for subject and topic.\n\n" +
    SUBJECT_GUIDE +
    "\n\nConfusable pairs — read the stem, not single keywords:\n" +
    CONFUSABLE_RULES +
    "\n\nTaxonomy (subject-slug: topic-slug, ...):\n" +
    taxonomyBlock(subjects, topics) +
    '\n\nQuestions:\n' +
    JSON.stringify(rows) +
    '\n\nReturn ONLY valid JSON with this exact shape, no markdown fences: {"assignments":[{"externalId":"...","subject":"<slug or null>","topic":"<slug or null>"}]}'
  );
}

const SUBJECT_GUIDE = `Subject guide (GATE CSE) — pick the subject first, then the most specific topic under it:
- general-aptitude: verbal-ability (vocabulary, analogies, synonyms/antonyms, sentence ordering, passage inference); numerical-ability (arithmetic, percentages, profit-loss, sequences, set word problems, charts); logical-reasoning (puzzles, blood relations, seating, grid logic); spatial-reasoning (cubes, folding, cuts, visualization).
- engineering-mathematics: calculus (limits, continuity, integrals, extrema); linear-algebra (matrices, rank, eigenvalues); probability (dice, urns, distributions, expectation).
- discrete-mathematics: propositional-logic / predicate-logic (logical formulas, proofs); combinatorics (counting, recurrence-free enumeration); graph-theory (graphs, trees-as-graphs, coloring, spanning properties); sets-relations-functions (posets, relations, linear extensions); algebraic-structures (groups, rings, modular arithmetic).
- digital-logic: boolean-algebra (K-maps, minterms, SOP/POS minimization); computer-arithmetic (IEEE 754, radix conversion, overflow); sequential-circuits (flip-flops, counters, state machines).
- computer-organization: instruction-set-architecture (formats, opcodes, addressing modes); pipelining (hazards, speedup); cache-memory; virtual-memory (page tables, TLB, address-translation structures); interrupts-and-io (DMA, interrupts); datapath-and-control.
- programming-data-structures: programming-in-c (C code output, pointers, snippets to complete); trees; stacks-queues; heaps; hashing; linked-lists.
- algorithms: asymptotic-analysis; divide-and-conquer (recurrences); dynamic-programming (LIS/LCS-style optima); sorting; graph-traversal; shortest-paths; minimum-spanning-trees (only when an MST/shortest-path ALGORITHM is the point).
- theory-of-computation: regular-languages (DFA/NFA, regex, pumping); context-free-languages (grammars, ambiguity, PDA).
- compiler-design: compiler-phases (matching phases to artifacts); lexical-analysis; parsing (LL/LR/SLR tables and items); syntax-directed-translation (attribute grammars); intermediate-code (triples, quadruples); code-optimization; symbol-tables.
- operating-systems: processes (context switch, states, fork); cpu-scheduling; synchronization (semaphores, monitors, interleavings); deadlocks (Banker's algorithm, resource-allocation graphs); secondary-storage (disks, seek/latency arithmetic); virtual-memory (page replacement, thrashing, per-process allocation).
- databases: er-model (entities, weak sets); relational-algebra; sql; normal-forms / functional-dependencies; transactions (ACID, schedules, serializability, 2PL, locking); indexing; file-organization (heap/sorted files, scan cost).
- computer-networks: network-models (OSI/layering questions); data-link-layer (framing, CSMA/CD, sliding window); network-layer (IP headers, TTL, fragmentation, routing, MAC-vs-IP on a path); ip-addressing (CIDR, subnets, host counts); transport-layer (TCP, congestion window); application-layer (HTTP, DNS).`;

const CONFUSABLE_RULES = `- "Deadlock" with transactions, schedules, locks, or 2PL -> databases/transactions. "Deadlock" with Banker's algorithm, safe sequences, or resource-allocation graphs -> operating-systems/deadlocks.
- Verbal analogies, synonyms, antonyms, idioms, sentence order -> general-aptitude/verbal-ability, never logical-reasoning.
- Page-table/TLB/page-size arithmetic and address-translation structures -> computer-organization/virtual-memory. Page replacement, thrashing, allocation -> operating-systems/virtual-memory.
- Spanning-tree parity, cycles, chromatic number, adjacency-matrix graph properties -> discrete-mathematics/graph-theory, not algorithms.
- Posets, relations, functions, "number of orders/extensions" -> discrete-mathematics/sets-relations-functions, not combinatorics.
- Min-replacements-to-sort / longest sorted subsequence -> algorithms/dynamic-programming, not sorting.
- Triples/quadruples/address code -> compiler-design/intermediate-code. Phase-to-artifact matching -> compiler-design/compiler-phases.
- C code output, pointer arithmetic, completing a C snippet -> programming-data-structures/programming-in-c even when the snippet implements an algorithm.
- Heap/sorted-file scan efficiency -> databases/file-organization, not indexing. SQL text -> databases/sql; relational operators -> databases/relational-algebra.
- CIDR/subnet/host-count -> computer-networks/ip-addressing. TTL/checksum/fragmentation, router-modified fields, dest-MAC-vs-dest-IP -> computer-networks/network-layer.
- Semaphores, wait/signal interleavings, possible print outcomes -> operating-systems/synchronization, not deadlocks (unless the question asks about deadlock freedom).
- Disk RPM/seek/transfer arithmetic -> operating-systems/secondary-storage. TCP window/timeout arithmetic -> computer-networks/transport-layer. CSMA/CD frame-size arithmetic -> computer-networks/data-link-layer.`;

export type ClassificationAssignment = {
  externalId: string;
  subject: string | null;
  topic: string | null;
};

/** Defensive parse: model-shaped JSON in, validated assignments out. */
export function parseClassificationJson(text: string): ClassificationAssignment[] {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{");
  const arrayStart = cleaned.indexOf("[");
  const open =
    start < 0 ? arrayStart : arrayStart < 0 ? start : Math.min(start, arrayStart);
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (open < 0 || end <= open) return [];
  let data: unknown;
  try {
    data = JSON.parse(cleaned.slice(open, end + 1));
  } catch {
    return [];
  }
  const raw = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { assignments?: unknown }).assignments)
      ? (data as { assignments: unknown[] }).assignments
      : [];
  const assignments: ClassificationAssignment[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.externalId !== "string" || !record.externalId.trim()) continue;
    const subject = record.subject;
    const topic = record.topic;
    assignments.push({
      externalId: record.externalId,
      subject: typeof subject === "string" && subject.trim() ? subject : null,
      topic: typeof topic === "string" && topic.trim() ? topic : null,
    });
  }
  return assignments;
}

const CLASSIFY_SYSTEM =
  "You are a GATE CSE syllabus classifier. Assign each question to its subject and topic using only the taxonomy slugs given in the prompt. Return ONLY the requested JSON — no explanations, no markdown fences.";

/**
 * One model call per batch for every unmapped row (capped). Resolves to
 * assignments keyed by externalId; unknown ids simply have no entry.
 * Never throws: a dead key, rate limit, or bad JSON yields a partial (or
 * empty) map and the caller quarantines the rest — classification never
 * sinks an import.
 */
export async function classifyUnmappedItems(
  items: ClassifyInput[],
  subjects: TaxonomySubject[],
  topics: TaxonomyTopic[],
): Promise<Map<string, ClassificationAssignment>> {
  const byId = new Map<string, ClassificationAssignment>();
  const batches = chunkItems(items.slice(0, MAX_CLASSIFY_ITEMS), CLASSIFY_BATCH_SIZE);
  for (const [index, batch] of batches.entries()) {
    if (index > 0) await pause(BATCH_PAUSE_MS);
    try {
      for (const assignment of parseClassificationJson(
        await generateImportText({
          system: CLASSIFY_SYSTEM,
          prompt: buildClassificationPrompt(batch, subjects, topics),
          maxOutputTokens: 4000,
        }),
      )) {
        if (!byId.has(assignment.externalId)) byId.set(assignment.externalId, assignment);
      }
    } catch (error) {
      if (!isRateLimitError(error)) break;
      // One retry after a breather, then keep whatever succeeded so far.
      await pause(RETRY_PAUSE_MS);
      try {
        for (const assignment of parseClassificationJson(
          await generateImportText({
            system: CLASSIFY_SYSTEM,
            prompt: buildClassificationPrompt(batch, subjects, topics),
            maxOutputTokens: 4000,
          }),
        )) {
          if (!byId.has(assignment.externalId)) byId.set(assignment.externalId, assignment);
        }
      } catch {
        break;
      }
    }
  }
  return byId;
}

export function chunkItems<T>(items: T[], size: number): T[][] {
  if (size <= 0) return items.length > 0 ? [items] : [];
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size));
  }
  return chunks;
}

function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("rate limit") || message.includes("rate_limit")) return true;
    const status =
      error && typeof error === "object" && "statusCode" in error
        ? (error as { statusCode?: unknown }).statusCode
        : undefined;
    if (status === 429 || status === 413) return true;
  }
  return false;
}

const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
