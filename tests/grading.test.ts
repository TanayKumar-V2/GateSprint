import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildGradePrompt, GRADE_SYSTEM, hasSolution, parseAiGrade, parseAiGradeDetailed, sameCorrectAnswer, type AiGradeSuccess } from "../lib/ai/grade-validation";
import { resolveSolutionCache, type SolutionState } from "../lib/ai/solution-cache";

const options = [
  { id: "A", text: "40" },
  { id: "B", text: "42" },
  { id: "C", text: "44" },
  { id: "D", text: "46" },
];

describe("solution cache", () => {
  const grade: AiGradeSuccess = { verdict: "correct", correctAnswer: { kind: "mcq", optionId: "B" }, explanation: "Multiplying 6 by 7 gives 42, so option B is correct." };

  it("generates and persists once, then serves the same solution", async () => {
    let state: SolutionState = { correctAnswer: null, solution: "Solution pending." };
    let calls = 0;
    const deps = {
      load: async () => state,
      generate: async () => { calls++; return grade; },
      save: async (value: SolutionState) => { state = value; },
    };
    assert.equal((await resolveSolutionCache(deps)).generated, true);
    assert.equal((await resolveSolutionCache(deps)).generated, false);
    assert.equal(calls, 1);
    assert.equal(state.solution, grade.explanation);
  });

  it("fills a missing solution without changing the saved answer", async () => {
    const state = { correctAnswer: grade.correctAnswer, solution: null };
    const result = await resolveSolutionCache({ load: async () => state, generate: async (answer) => { assert.deepEqual(answer, grade.correctAnswer); return grade; }, save: async () => {} });
    assert.equal(result.solution, grade.explanation);
    assert.deepEqual(result.correctAnswer, state.correctAnswer);
  });

  it("does not overwrite a curated solution", async () => {
    const state = { correctAnswer: grade.correctAnswer, solution: "Official working." };
    const result = await resolveSolutionCache({ load: async () => state, generate: async () => { throw new Error("Must not generate"); }, save: async () => { assert.fail("Must not save"); } });
    assert.equal(result.solution, state.solution);
    assert.equal(result.error, undefined);
  });

  it("does not save failures, cannot_judge, or conflicting answers", async () => {
    for (const generate of [
      async () => { throw new Error("Offline"); },
      async () => ({ verdict: "cannot_judge" as const, explanation: "Missing diagram." }),
      async () => ({ ...grade, correctAnswer: { kind: "mcq" as const, optionId: "A" } }),
    ]) {
      const result = await resolveSolutionCache({ load: async () => ({ correctAnswer: grade.correctAnswer, solution: null }), generate, save: async () => { assert.fail("Must not save invalid result"); } });
      assert.ok(result.error);
      assert.equal(result.solution, null);
    }
  });

  it("propagates persistence failures instead of claiming a cache hit", async () => {
    await assert.rejects(resolveSolutionCache({ load: async () => ({ correctAnswer: null, solution: null }), generate: async () => grade, save: async () => { throw new Error("Database unavailable"); } }), /Database unavailable/);
  });

  it("recognizes placeholders and compares answer sets", () => {
    for (const content of [null, undefined, "", "  ", "Solution pending.", " solution pending ", "Solution pending admin review."]) assert.equal(hasSolution(content), false);
    assert.equal(hasSolution(grade.explanation), true);
    assert.equal(sameCorrectAnswer({ kind: "msq", optionIds: ["A", "C"] }, { kind: "msq", optionIds: ["C", "A"] }), true);
    assert.equal(sameCorrectAnswer({ kind: "nat", value: 42, tolerance: 0 }, { kind: "nat", value: 43, tolerance: 0 }), false);
  });

  it("builds a student-independent prompt with an optional reference", () => {
    const input = { type: "mcq" as const, prompt: "What is 6 times 7?", options, figureCount: 0 };
    assert.doesNotMatch(buildGradePrompt(input), /student|selected|submitted/i);
    assert.match(buildGradePrompt({ ...input, correctAnswer: grade.correctAnswer }), /Known correct answer/);
    assert.match(GRADE_SYSTEM, /reusable, natural worked solution/);
    assert.match(GRADE_SYSTEM, /must not mention a student/);
  });

  it("accepts longer worked solutions but enforces the length limit", () => {
    assert.ok(parseAiGrade(JSON.stringify({ ...grade, explanation: "x".repeat(3000) }), "mcq", options));
    assert.equal(parseAiGrade(JSON.stringify({ ...grade, explanation: "x".repeat(12001) }), "mcq", options), null);
  });
});

describe("parseAiGrade", () => {
  it("accepts fenced verdicts and validates the answer", () => {
    const grade = parseAiGrade(
      '```json\n{"verdict":"correct","correctAnswer":{"kind":"mcq","optionId":"B"},"explanation":"6x7 is 42."}\n```',
      "mcq",
      options,
    );
    assert.deepEqual(grade, {
      verdict: "correct",
      correctAnswer: { kind: "mcq", optionId: "B" },
      explanation: "6x7 is 42.",
    });
  });
  it("rejects answers pointing outside the options", () => {
    assert.equal(
      parseAiGrade(
        '{"verdict":"incorrect","correctAnswer":{"kind":"mcq","optionId":"E"},"explanation":"No."}',
        "mcq",
        options,
      ),
      null,
    );
  });
  it("defaults NAT tolerance to 0", () => {
    assert.deepEqual(
      parseAiGrade(
        '{"verdict":"incorrect","correctAnswer":{"kind":"nat","value":8},"explanation":"A byte is 8 bits."}',
        "nat",
        null,
      ),
      {
        verdict: "incorrect",
        correctAnswer: { kind: "nat", value: 8, tolerance: 0 },
        explanation: "A byte is 8 bits.",
      },
    );
  });
  it("accepts cannot_judge with an explanation", () => {
    assert.deepEqual(
      parseAiGrade(
        '{"verdict":"cannot_judge","explanation":"The circuit diagram is essential and not visible."}',
        "mcq",
        options,
      ),
      {
        verdict: "cannot_judge",
        explanation: "The circuit diagram is essential and not visible.",
      },
    );
  });
  it("rejects garbage, truncated JSON, and kind mismatches", () => {
    assert.equal(parseAiGrade("not json at all", "mcq", options), null);
    assert.equal(parseAiGrade('{"verdict":"correct",', "mcq", options), null);
    assert.deepEqual(
      parseAiGrade(
        '{"verdict":"correct","correctAnswer":{"kind":"msq","optionIds":["A"]},"explanation":"x"}',
        "mcq",
        options,
      ),
      {
        verdict: "correct",
        correctAnswer: { kind: "msq", optionIds: ["A"] },
        explanation: "x",
      }
    );
    assert.deepEqual(
      parseAiGrade(
        '{"verdict":"correct","correctAnswer":{"kind":"mcq","optionId":"A"},"explanation":"U=\\frac{a}{b}"}',
        "mcq",
        options,
      ),
      {
        verdict: "correct",
        correctAnswer: { kind: "mcq", optionId: "A" },
        explanation: "U=\\frac{a}{b}",
      }
    );
    assert.equal(
      parseAiGrade(
        '{"verdict":"cannot_judge"}',
        "mcq",
        options,
      ),
      null,
    );
  });
  it("normalizes lowercase option ids and verdicts", () => {
    assert.deepEqual(
      parseAiGrade(
        '{"verdict":"Correct","correctAnswer":{"kind":"mcq","optionId":"b"},"explanation":"6x7 is 42."}',
        "mcq",
        options,
      ),
      {
        verdict: "correct",
        correctAnswer: { kind: "mcq", optionId: "B" },
        explanation: "6x7 is 42.",
      },
    );
    assert.deepEqual(
      parseAiGrade(
        '{"verdict":"correct","correctAnswer":{"kind":"msq","optionIds":["a"," c "]},"explanation":"x"}',
        "msq",
        options,
      ),
      {
        verdict: "correct",
        correctAnswer: { kind: "msq", optionIds: ["A", "C"] },
        explanation: "x",
      },
    );
  });
  it("accepts literal newlines and tabs inside the explanation", () => {
    assert.deepEqual(
      parseAiGrade(
        '{"verdict":"correct","correctAnswer":{"kind":"mcq","optionId":"B"},"explanation":"Line one.\nLine two.\tTabbed."}',
        "mcq",
        options,
      ),
      {
        verdict: "correct",
        correctAnswer: { kind: "mcq", optionId: "B" },
        explanation: "Line one.\nLine two.\tTabbed.",
      },
    );
  });
  it("reports specific failure reasons", () => {
    assert.deepEqual(parseAiGradeDetailed("not json at all", "mcq", options), { failure: "no-json-object" });
    assert.deepEqual(parseAiGradeDetailed('{"verdict":"correct",', "mcq", options), { failure: "no-json-object" });
    assert.deepEqual(parseAiGradeDetailed('{"verdict":}', "mcq", options), { failure: "invalid-json" });
    assert.deepEqual(
      parseAiGradeDetailed(
        '{"verdict":"maybe","correctAnswer":{"kind":"mcq","optionId":"B"},"explanation":"x"}',
        "mcq",
        options,
      ),
      { failure: "schema-mismatch" },
    );
    assert.deepEqual(
      parseAiGradeDetailed(
        '{"verdict":"correct","correctAnswer":{"kind":"mcq","optionId":"E"},"explanation":"x"}',
        "mcq",
        options,
      ),
      { failure: "unknown-option" },
    );
  });
});
