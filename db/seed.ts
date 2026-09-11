import "dotenv/config";
import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  subjects,
  topics,
  questions,
  solutions,
  type QuestionOption,
  type CorrectAnswer,
} from "./schema";

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

type SeedQuestion = {
  key: string;
  subject: string;
  topic: string;
  year: number;
  questionNumber: number;
  type: "mcq" | "msq" | "nat";
  difficulty: "easy" | "medium" | "hard";
  prompt: string;
  options: QuestionOption[] | null;
  correctAnswer: CorrectAnswer;
  marks: number;
  negativeMarks: number;
  solution: string;
};

const opt = (id: string, text: string): QuestionOption => ({ id, text });

const QUESTIONS: SeedQuestion[] = [
  {
    key: "dl-2022-mcq-1",
    subject: "digital-logic",
    topic: "boolean-algebra",
    year: 2022,
    questionNumber: 1,
    type: "mcq",
    difficulty: "easy",
    prompt: "The Boolean expression $(X + Y)(X + Z)$ is equivalent to:",
    options: [
      opt("A", "$X + YZ$"),
      opt("B", "$XY + Z$"),
      opt("C", "$XZ + Y$"),
      opt("D", "$XYZ + X$"),
    ],
    correctAnswer: { kind: "mcq", optionId: "A" },
    marks: 1,
    negativeMarks: 0.33,
    solution:
      "Apply the distributive law in its OR-AND form: $(X+Y)(X+Z) = X + YZ$. Sanity check with $X=1$: both sides are $1$. With $X=0$: both sides reduce to $YZ$. Hence option A.",
  },
  {
    key: "algo-2021-mcq-1",
    subject: "algorithms",
    topic: "asymptotic-analysis",
    year: 2021,
    questionNumber: 2,
    type: "mcq",
    difficulty: "easy",
    prompt:
      "Which of the following functions grows the slowest as $n \\to \\infty$?",
    options: [
      opt("A", "$n!$"),
      opt("B", "$2^n$"),
      opt("C", "$n^2$"),
      opt("D", "$n \\log n$"),
    ],
    correctAnswer: { kind: "mcq", optionId: "D" },
    marks: 1,
    negativeMarks: 0.33,
    solution:
      "Growth ordering: $n \\log n \\prec n^2 \\prec 2^n \\prec n!$. The ratio $n^2 / (n \\log n) = n / \\log n \\to \\infty$, and exponentials dominate polynomials. Hence $n \\log n$.",
  },
  {
    key: "os-2020-mcq-1",
    subject: "operating-systems",
    topic: "cpu-scheduling",
    year: 2020,
    questionNumber: 3,
    type: "mcq",
    difficulty: "medium",
    prompt:
      "Three processes arrive for FCFS scheduling: P1 (arrival 0, burst 8), P2 (arrival 1, burst 4), P3 (arrival 2, burst 2). The average waiting time is:",
    options: [
      opt("A", "$4.00$"),
      opt("B", "$5.67$"),
      opt("C", "$6.33$"),
      opt("D", "$7.00$"),
    ],
    correctAnswer: { kind: "mcq", optionId: "B" },
    marks: 2,
    negativeMarks: 0.66,
    solution:
      "FCFS order is P1, P2, P3. Completion times: P1 at 8, P2 at 12, P3 at 14. Waiting = completion − arrival − burst: P1 = 0, P2 = 12−1−4 = 7, P3 = 14−2−2 = 10. Average = 17/3 ≈ 5.67.",
  },
  {
    key: "db-2023-mcq-1",
    subject: "databases",
    topic: "normal-forms",
    year: 2023,
    questionNumber: 4,
    type: "mcq",
    difficulty: "medium",
    prompt:
      "Relation $R(A,B,C,D)$ has functional dependencies $A \\to B$ and $B \\to C$. The highest normal form of $R$ is:",
    options: [
      opt("A", "BCNF"),
      opt("B", "3NF"),
      opt("C", "2NF"),
      opt("D", "1NF"),
    ],
    correctAnswer: { kind: "mcq", optionId: "D" },
    marks: 2,
    negativeMarks: 0.66,
    solution:
      "Closure of $A$ is $\\{A,B,C\\}$; with $D$ untouched, the only key is $AD$. $B \\to C$: $B$ is not a superkey and $C$ is non-prime, so 3NF fails (transitive dependency). $A \\to B$: $B$ is non-prime and depends on a proper part ($A$) of the key $AD$, so 2NF fails (partial dependency). Highest is 1NF.",
  },
  {
    key: "toc-2019-mcq-1",
    subject: "theory-of-computation",
    topic: "regular-languages",
    year: 2019,
    questionNumber: 5,
    type: "mcq",
    difficulty: "medium",
    prompt: "Which of the following languages over $\\{a,b\\}$ is regular?",
    options: [
      opt("A", "$\\{a^n b^n \\mid n \\ge 0\\}$"),
      opt("B", "$\\{a^n b^m \\mid n, m \\ge 0\\}$"),
      opt("C", "$\\{a^n b^n c^n \\mid n \\ge 0\\}$"),
      opt("D", "$\\{ww \\mid w \\in \\{a,b\\}^*\\}$"),
    ],
    correctAnswer: { kind: "mcq", optionId: "B" },
    marks: 1,
    negativeMarks: 0.33,
    solution:
      "Option B is just $a^*b^*$, accepted by a 2-state DFA. A needs unbounded counting (pumping lemma fails), C is not even context-free, and D (squares) is a classic non-regular language.",
  },
  {
    key: "cn-2024-mcq-1",
    subject: "computer-networks",
    topic: "ip-addressing",
    year: 2024,
    questionNumber: 6,
    type: "mcq",
    difficulty: "easy",
    prompt:
      "A subnet uses a /26 prefix. How many usable host addresses does it provide?",
    options: [opt("A", "62"), opt("B", "64"), opt("C", "30"), opt("D", "126")],
    correctAnswer: { kind: "mcq", optionId: "A" },
    marks: 1,
    negativeMarks: 0.33,
    solution:
      "Host bits = 32 − 26 = 6, giving $2^6 = 64$ addresses. Subtract the network and broadcast addresses: 64 − 2 = 62 usable.",
  },
  {
    key: "pds-2022-mcq-1",
    subject: "programming-data-structures",
    topic: "trees",
    year: 2022,
    questionNumber: 7,
    type: "mcq",
    difficulty: "easy",
    prompt:
      "The maximum number of nodes in a binary tree of height $h$ (root at height 0) is:",
    options: [
      opt("A", "$2^h$"),
      opt("B", "$2^{h+1} - 1$"),
      opt("C", "$2^{h-1}$"),
      opt("D", "$h^2$"),
    ],
    correctAnswer: { kind: "mcq", optionId: "B" },
    marks: 1,
    negativeMarks: 0.33,
    solution:
      "A perfect tree has $2^i$ nodes at level $i$. Summing levels $0$ to $h$: $\\sum_{i=0}^{h} 2^i = 2^{h+1} - 1$.",
  },
  {
    key: "ga-2023-mcq-1",
    subject: "general-aptitude",
    topic: "numerical-ability",
    year: 2023,
    questionNumber: 8,
    type: "mcq",
    difficulty: "easy",
    prompt:
      "A train travels from A to B at 60 km/h and returns at 40 km/h. Its average speed for the whole trip is:",
    options: [
      opt("A", "50 km/h"),
      opt("B", "48 km/h"),
      opt("C", "45 km/h"),
      opt("D", "52 km/h"),
    ],
    correctAnswer: { kind: "mcq", optionId: "B" },
    marks: 1,
    negativeMarks: 0.33,
    solution:
      "For equal distances, average speed is the harmonic mean: $2xy/(x+y) = 2·60·40/100 = 48$ km/h. The plain arithmetic mean (50) is the tempting trap.",
  },
  {
    key: "dm-2021-msq-1",
    subject: "discrete-mathematics",
    topic: "graph-theory",
    year: 2021,
    questionNumber: 9,
    type: "msq",
    difficulty: "medium",
    prompt: "Which of the following statements about trees are TRUE?",
    options: [
      opt("A", "A tree with $n$ vertices has exactly $n-1$ edges."),
      opt("B", "Every tree is bipartite."),
      opt("C", "Every tree with $n \\ge 2$ vertices has at least two leaves."),
      opt("D", "Every tree has an Eulerian trail."),
    ],
    correctAnswer: { kind: "msq", optionIds: ["A", "B", "C"] },
    marks: 2,
    negativeMarks: 0,
    solution:
      "A: defining property of trees. B: trees have no odd cycles, so 2-colouring from any root works. C: the endpoints of any longest path are leaves. D is false: a star $K_{1,3}$ has four odd-degree vertices, so no Eulerian trail.",
  },
  {
    key: "coa-2020-msq-1",
    subject: "computer-organization",
    topic: "cache-memory",
    year: 2020,
    questionNumber: 10,
    type: "msq",
    difficulty: "hard",
    prompt: "Which of the following statements about caches are TRUE?",
    options: [
      opt("A", "A write-back cache needs a dirty bit per block."),
      opt("B", "Write-through caches never stall the CPU on a write."),
      opt("C", "A fully associative cache has no conflict misses."),
      opt("D", "Raising associativity always reduces hit time."),
    ],
    correctAnswer: { kind: "msq", optionIds: ["A", "C"] },
    marks: 2,
    negativeMarks: 0,
    solution:
      "A: the dirty bit tracks whether a block must be written back on eviction. C: any block can sit anywhere, so misses are only compulsory/capacity. B is false (writes still pay memory latency without a buffer), D is false (more comparators slow the hit path).",
  },
  {
    key: "em-2022-msq-1",
    subject: "engineering-mathematics",
    topic: "probability",
    year: 2022,
    questionNumber: 11,
    type: "msq",
    difficulty: "medium",
    prompt:
      "A fair coin is tossed 3 times. Which events have probability exactly $1/2$?",
    options: [
      opt("A", "At most two heads."),
      opt("B", "An odd number of heads."),
      opt("C", "The first toss is a head."),
      opt("D", "All three tosses agree."),
    ],
    correctAnswer: { kind: "msq", optionIds: ["B", "C"] },
    marks: 2,
    negativeMarks: 0,
    solution:
      "B: P(1 head) + P(3 heads) = 3/8 + 1/8 = 1/2. C: symmetry gives 1/2 regardless of other tosses. A is 7/8 (only HHH excluded), D is 2/8 = 1/4.",
  },
  {
    key: "cd-2023-msq-1",
    subject: "compiler-design",
    topic: "parsing",
    year: 2023,
    questionNumber: 12,
    type: "msq",
    difficulty: "medium",
    prompt: "Which of the following statements about parsing are TRUE?",
    options: [
      opt("A", "Every LL(1) grammar is unambiguous."),
      opt("B", "Every regular grammar is LL(1)."),
      opt("C", "Canonical LR(1) parsers accept a larger class than SLR parsers."),
      opt("D", "An ambiguous grammar can be LR(1)."),
    ],
    correctAnswer: { kind: "msq", optionIds: ["A", "C"] },
    marks: 2,
    negativeMarks: 0,
    solution:
      "A: a single predictive choice per input forces one parse tree. C: LR(1) items carry lookaheads, strictly generalizing SLR follow sets. B is false (left-recursive regular grammars are not LL(1)), D is false (LR(1) implies unambiguity).",
  },
  {
    key: "pds-2024-msq-1",
    subject: "programming-data-structures",
    topic: "stacks-queues",
    year: 2024,
    questionNumber: 13,
    type: "msq",
    difficulty: "easy",
    prompt:
      "Values 1, 2, 3 are pushed in order onto a single stack, interleaved with pops. Which pop sequences are achievable?",
    options: [
      opt("A", "3 2 1"),
      opt("B", "1 2 3"),
      opt("C", "2 1 3"),
      opt("D", "3 1 2"),
    ],
    correctAnswer: { kind: "msq", optionIds: ["A", "B", "C"] },
    marks: 1,
    negativeMarks: 0,
    solution:
      "A: push all, pop all. B: push-pop-push-pop-push-pop. C: push 1, push 2, pop 2, pop 1, push 3, pop 3. D is impossible: popping 3 then 1 leaves 2 buried under nothing — 2 must emerge before 1 once 3 is gone.",
  },
  {
    key: "dl-2021-nat-1",
    subject: "digital-logic",
    topic: "sequential-circuits",
    year: 2021,
    questionNumber: 14,
    type: "nat",
    difficulty: "medium",
    prompt: "The minimum number of flip-flops needed for a mod-6 counter is ___.",
    options: null,
    correctAnswer: { kind: "nat", value: 3, tolerance: 0 },
    marks: 2,
    negativeMarks: 0,
    solution:
      "3 flip-flops give $2^3 = 8$ states, enough to encode 6; 2 flip-flops give only 4 states. So the minimum is 3.",
  },
  {
    key: "coa-2022-nat-1",
    subject: "computer-organization",
    topic: "pipelining",
    year: 2022,
    questionNumber: 15,
    type: "nat",
    difficulty: "medium",
    prompt:
      "A 5-stage pipeline executes 100 instructions with no stalls, one cycle per stage. The total number of cycles is ___.",
    options: null,
    correctAnswer: { kind: "nat", value: 104, tolerance: 0 },
    marks: 2,
    negativeMarks: 0,
    solution:
      "The first instruction fills the pipe in 5 cycles; each of the remaining 99 finishes one cycle later: 5 + 99 = 104.",
  },
  {
    key: "algo-2020-nat-1",
    subject: "algorithms",
    topic: "divide-and-conquer",
    year: 2020,
    questionNumber: 16,
    type: "nat",
    difficulty: "medium",
    prompt:
      "Let $T(n) = 2T(n/2) + n$ with $T(1) = 1$. Then $T(16)$ equals ___.",
    options: null,
    correctAnswer: { kind: "nat", value: 80, tolerance: 0 },
    marks: 2,
    negativeMarks: 0,
    solution:
      "Unfold: each level contributes $n$ work across $\\log_2 16 = 4$ levels, plus $16$ leaves of cost 1: $4·16 + 16 = 80$. (Master theorem case 2 with the base term.)",
  },
  {
    key: "em-2019-nat-1",
    subject: "engineering-mathematics",
    topic: "linear-algebra",
    year: 2019,
    questionNumber: 17,
    type: "nat",
    difficulty: "easy",
    prompt:
      "The sum of the eigenvalues of the matrix $\\begin{bmatrix}2 & 1\\\\ 0 & 3\\end{bmatrix}$ is ___.",
    options: null,
    correctAnswer: { kind: "nat", value: 5, tolerance: 0 },
    marks: 1,
    negativeMarks: 0,
    solution:
      "Eigenvalue sum equals the trace: $2 + 3 = 5$. (Individually they are 2 and 3 since the matrix is upper triangular.)",
  },
  {
    key: "dm-2024-nat-1",
    subject: "discrete-mathematics",
    topic: "propositional-logic",
    year: 2024,
    questionNumber: 18,
    type: "nat",
    difficulty: "medium",
    prompt:
      "Over variables $p, q, r$, the number of satisfying assignments of $(p \\lor q) \\land (\\lnot p \\lor r)$ is ___.",
    options: null,
    correctAnswer: { kind: "nat", value: 4, tolerance: 0 },
    marks: 2,
    negativeMarks: 0,
    solution:
      "Case $p = 0$: need $q = 1$, $r$ free → 2 assignments. Case $p = 1$: need $r = 1$, $q$ free → 2 assignments. Total 4 of 8.",
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, {
    schema: { subjects, topics, questions, solutions },
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
    const topicId = new Map(
      topicRows.map((r) => [`${r.subjectId}:${r.slug}`, r.id]),
    );

    // Questions + solutions (lookup by authored key fields, update on rerun).
    let upserted = 0;
    for (const q of QUESTIONS) {
      const sid = subjectId.get(q.subject);
      if (!sid) throw new Error(`Unknown subject ${q.subject}`);
      const tid = topicId.get(`${sid}:${q.topic}`);
      if (!tid) throw new Error(`Unknown topic ${q.topic}`);

      const existing = await db
        .select({ id: questions.id })
        .from(questions)
        .where(
          and(
            eq(questions.year, q.year),
            eq(questions.questionNumber, q.questionNumber),
            eq(questions.type, q.type),
            eq(questions.subjectId, sid),
          ),
        )
        .limit(1);

      let questionId: string;
      const values = {
        subjectId: sid,
        topicId: tid,
        year: q.year,
        questionNumber: q.questionNumber,
        type: q.type,
        difficulty: q.difficulty,
        prompt: q.prompt,
        options: q.options,
        correctAnswer: q.correctAnswer,
        marks: q.marks,
        negativeMarks: q.negativeMarks,
        sourceLabel: `GATE ${q.year}`,
        isPublished: true,
        updatedAt: new Date(),
      } as const;

      if (existing[0]) {
        questionId = existing[0].id;
        await db
          .update(questions)
          .set(values)
          .where(eq(questions.id, questionId));
      } else {
        const inserted = await db
          .insert(questions)
          .values(values)
          .returning({ id: questions.id });
        questionId = inserted[0]!.id;
      }

      await db
        .insert(solutions)
        .values({
          questionId,
          content: q.solution,
          solutionType: "curated",
        })
        .onConflictDoUpdate({
          target: [solutions.questionId, solutions.solutionType],
          set: { content: q.solution, updatedAt: new Date() },
        });
      upserted += 1;
    }

    console.log(
      `Seeded ${subjectRows.length} subjects, ${topicRows.length} topics, ${upserted} questions with solutions.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
