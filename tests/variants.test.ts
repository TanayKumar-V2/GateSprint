import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractJsonArray,
  toListItem,
  validateRawVariant,
} from "../lib/variants-rules";
import { variantAnswerSchema, variantRequestSchema } from "../lib/validation/extension";

const mcq = {
  prompt: "What does a cache miss cost on this pipeline?",
  type: "mcq",
  options: [
    { id: "A", text: "3 cycles" },
    { id: "B", text: "12 cycles" },
    { id: "C", text: "40 cycles" },
  ],
  correctAnswer: { kind: "mcq", optionId: "B" },
  difficulty: "medium",
};

describe("extractJsonArray", () => {
  it("tolerates fences and surrounding prose", () => {
    const raw = 'Here you go:\n```json\n[{"prompt": "Q?", "type": "nat"}]\n```';
    assert.deepEqual(extractJsonArray(raw), [{ prompt: "Q?", type: "nat" }]);
  });

  it("fails friendly on non-JSON output", () => {
    assert.equal(extractJsonArray("Sorry, I cannot do that."), null);
    assert.equal(extractJsonArray('{"not": "an array"}'), null);
    assert.equal(extractJsonArray("[broken"), null);
  });
});

describe("validateRawVariant", () => {
  it("accepts well-formed mcq, msq, and nat variants", () => {
    assert.ok(validateRawVariant(mcq));
    assert.ok(
      validateRawVariant({
        prompt: "Which of these languages are regular over binary alphabets?",
        type: "msq",
        options: [
          { id: "A", text: "0*1*" },
          { id: "B", text: "0^n1^n" },
          { id: "C", text: "(0+1)*" },
        ],
        correctAnswer: { kind: "msq", optionIds: ["A", "C"] },
      }),
    );
    assert.ok(
      validateRawVariant({
        prompt: "Compute the hit ratio for this 4-block cache trace sequence.",
        type: "nat",
        options: null,
        correctAnswer: { kind: "nat", value: 0.75, tolerance: 0.01 },
      }),
    );
  });

  it("rejects malformed variants before they persist", () => {
    // Dangling answer id.
    assert.equal(
      validateRawVariant({ ...mcq, correctAnswer: { kind: "mcq", optionId: "Z" } }),
      null,
    );
    // Kind mismatch.
    assert.equal(
      validateRawVariant({ ...mcq, correctAnswer: { kind: "msq", optionIds: ["A"] } }),
      null,
    );
    // Options on a NAT.
    assert.equal(
      validateRawVariant({
        prompt: "How many cache blocks are needed for this trace pattern?",
        type: "nat",
        options: [{ id: "A", text: "x" }],
        correctAnswer: { kind: "nat", value: 2, tolerance: 0 },
      }),
      null,
    );
    // Negative tolerance.
    assert.equal(
      validateRawVariant({
        prompt: "How many cache blocks are needed for this trace pattern?",
        type: "nat",
        options: null,
        correctAnswer: { kind: "nat", value: 2, tolerance: -1 },
      }),
      null,
    );
    // Too few options, duplicate ids, thin prompt.
    assert.equal(
      validateRawVariant({ ...mcq, options: [{ id: "A", text: "only" }] }),
      null,
    );
    assert.equal(
      validateRawVariant({
        ...mcq,
        options: [
          { id: "A", text: "x" },
          { id: "A", text: "y" },
        ],
      }),
      null,
    );
    assert.equal(validateRawVariant({ ...mcq, prompt: "tiny" }), null);
  });
});

describe("no answer leak in list projection", () => {
  it("drops correctAnswer while keeping card fields", () => {
    const item = toListItem({
      id: "v1",
      prompt: mcq.prompt,
      type: "mcq",
      options: mcq.options,
      difficulty: "medium",
      verified: false,
      createdAt: new Date(),
      correctAnswer: mcq.correctAnswer,
    });
    assert.ok(!("correctAnswer" in item));
    assert.equal(item.prompt, mcq.prompt);
    assert.equal(item.verified, false);
  });
});

describe("variant endpoint validation", () => {
  it("bounds generation count and difficulty", () => {
    assert.equal(variantRequestSchema.safeParse({}).success, true);
    assert.equal(variantRequestSchema.safeParse({ count: 2 }).success, true);
    assert.equal(variantRequestSchema.safeParse({ count: 0 }).success, false);
    assert.equal(variantRequestSchema.safeParse({ count: 4 }).success, false);
    assert.equal(variantRequestSchema.safeParse({ difficulty: "extreme" }).success, false);
  });

  it("requires a shaped answer", () => {
    assert.equal(variantAnswerSchema.safeParse({ answer: { optionId: "A" } }).success, true);
    assert.equal(variantAnswerSchema.safeParse({ answer: {} }).success, false);
    assert.equal(variantAnswerSchema.safeParse({}).success, false);
  });
});
