import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeMockScore,
  isSessionExpired,
  paletteStatus,
  stripQuestionForRunner,
} from "../lib/mocks-rules";
import {
  BUILDER_MAX_QUESTIONS,
  hashSeed,
  sampleQuestions,
  scaleDuration,
  seededShuffle,
  suggestTime,
} from "../lib/test-builder-rules";
import {
  builderCreateSchema,
  builderPoolQuerySchema,
  mockAnswerSchema,
  mockCreateSchema,
} from "../lib/validation/extension";

const pool = [
  { id: "e1", difficulty: "easy", year: 2024, questionNumber: 1 },
  { id: "e2", difficulty: "easy", year: 2023, questionNumber: 2 },
  { id: "m1", difficulty: "medium", year: 2024, questionNumber: 3 },
  { id: "m2", difficulty: "medium", year: 2022, questionNumber: 4 },
  { id: "h1", difficulty: "hard", year: 2024, questionNumber: 5 },
  { id: "h2", difficulty: "hard", year: 2021, questionNumber: 6 },
] as const;

describe("computeMockScore", () => {
  it("applies negative marking and skips blanks", () => {
    const r = computeMockScore([
      { marks: 2, negativeMarks: 0.66, isCorrect: true },
      { marks: 2, negativeMarks: 0.66, isCorrect: false },
      { marks: 1, negativeMarks: 0.33, isCorrect: null },
      { marks: 1, negativeMarks: 0, isCorrect: false },
    ]);
    assert.equal(r.correct, 1);
    assert.equal(r.incorrect, 2);
    assert.equal(r.skipped, 1);
    assert.equal(r.score, 1.34);
  });

  it("stays at zero with nothing attempted", () => {
    assert.deepEqual(computeMockScore([]), { score: 0, correct: 0, incorrect: 0, skipped: 0 });
  });
});

describe("sampleQuestions", () => {
  it("is deterministic for the same seed", () => {
    const a = sampleQuestions([...pool], 4, { seed: 42 });
    const b = sampleQuestions([...pool], 4, { seed: 42 });
    assert.deepEqual(
      a?.map((q) => q.id),
      b?.map((q) => q.id),
    );
  });

  it("returns easy-first paper order after shuffling the pick", () => {
    const picked = sampleQuestions([...pool], 4, { seed: 7 });
    const order = picked?.map((q) => q.difficulty) ?? [];
    const rank = (d: string) => ({ easy: 0, medium: 1, hard: 2 })[d as "easy"]!;
    assert.deepEqual([...order].sort((x, y) => rank(x) - rank(y)), order);
  });

  it("excludes recent questions when the pool allows, else falls back", () => {
    const exclude = new Set(["e1", "m1"]);
    const picked = sampleQuestions([...pool], 4, { excludeIds: exclude, seed: 3 });
    assert.ok(picked && !picked.some((q) => exclude.has(q.id)));
    // Pool too small even with fallback -> null so the caller returns 422.
    assert.equal(sampleQuestions([...pool], 99, { seed: 3 }), null);
  });

  it("seeded shuffle varies the pick but stays reproducible", () => {
    const ids = (seed: number) => seededShuffle([1, 2, 3, 4, 5, 6, 7, 8], seed).join(",");
    assert.notEqual(ids(1), ids(2));
    assert.equal(ids(1), ids(1));
    assert.equal(typeof hashSeed("user:session"), "number");
  });
});

describe("suggestTime / scaleDuration", () => {
  it("paces 2 min per MCQ and 3 min per MSQ/NAT", () => {
    assert.equal(suggestTime(10, { mcq: 10, msq: 0, nat: 0 }), 1200);
    assert.equal(suggestTime(10, { mcq: 0, msq: 6, nat: 4 }), 1800);
  });

  it("clamps absurd mixes into 5min..3h", () => {
    assert.equal(suggestTime(1, { mcq: 1, msq: 0, nat: 0 }), 300);
    assert.equal(suggestTime(65, { mcq: 0, msq: 65, nat: 0 }), 10800);
    assert.ok(scaleDuration(65) <= 10800 && scaleDuration(65) >= 300);
    assert.ok(scaleDuration(BUILDER_MAX_QUESTIONS) < scaleDuration(65));
  });
});

describe("runner secrecy", () => {
  it("never leaks answers or solutions into the runner payload", () => {
    const stripped = stripQuestionForRunner({
      id: "q",
      prompt: "2+2?",
      correctAnswer: { kind: "mcq", optionId: "A" },
      solution: "Because 4.",
    });
    assert.ok(!("correctAnswer" in stripped));
    assert.ok(!("solution" in stripped));
    assert.equal(stripped.prompt, "2+2?");
  });

  it("auto-submit fires only past endsAt", () => {
    const ends = new Date("2026-09-17T12:00:00Z");
    assert.equal(isSessionExpired(ends, new Date("2026-09-17T11:59:59Z")), false);
    assert.equal(isSessionExpired(ends, new Date("2026-09-17T12:00:01Z")), true);
  });

  it("derives palette status from stored state", () => {
    assert.equal(paletteStatus({ hasAnswer: true, markedForReview: true }), "answered_marked");
    assert.equal(paletteStatus({ hasAnswer: true, markedForReview: false }), "answered");
    assert.equal(paletteStatus({ hasAnswer: false, markedForReview: true }), "marked");
    assert.equal(paletteStatus({ hasAnswer: false, markedForReview: false }), "unanswered");
  });
});

describe("mock/builder validation", () => {
  it("rejects out-of-range counts and durations", () => {
    assert.equal(mockCreateSchema.safeParse({ type: "full", totalQuestions: 4 }).success, false);
    assert.equal(mockCreateSchema.safeParse({ type: "full", totalQuestions: 66 }).success, false);
    assert.equal(mockCreateSchema.safeParse({ type: "nope" }).success, false);
    assert.equal(builderCreateSchema.safeParse({ totalQuestions: 10 }).success, true);
    assert.equal(builderCreateSchema.safeParse({ totalQuestions: 51 }).success, false);
    assert.equal(
      mockAnswerSchema.safeParse({ itemId: "not-a-uuid", answer: { optionId: "A" } }).success,
      false,
    );
  });

  it("parses comma-separated slug filters", () => {
    const ok = builderPoolQuerySchema.safeParse({ subjects: "algorithms,os", difficulty: "easy" });
    assert.equal(ok.success, true);
    assert.equal(builderPoolQuerySchema.safeParse({ subjects: "Bad Slug!" }).success, false);
  });
});
