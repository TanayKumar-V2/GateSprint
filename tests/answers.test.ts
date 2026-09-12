import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  gradeMcq,
  gradeMsq,
  gradeNat,
  questionFilterSchema,
  submittedAnswerSchema,
} from "../lib/validation/answers";

describe("grading", () => {
  it("grades MCQ by exact option", () => {
    assert.equal(gradeMcq("A", "A"), true);
    assert.equal(gradeMcq("B", "A"), false);
    assert.equal(gradeMcq(" a ", "a"), true);
  });
  it("grades MSQ as a set, ignoring order and repeats", () => {
    assert.equal(gradeMsq(["B", "A"], ["A", "B"]), true);
    assert.equal(gradeMsq(["A", "A", "B"], ["A", "B"]), true);
    assert.equal(gradeMsq(["A"], ["A", "B"]), false);
    assert.equal(gradeMsq(["A", "B", "C"], ["A", "B"]), false);
    assert.equal(gradeMsq([], ["A"]), false);
  });
  it("grades NAT within absolute tolerance", () => {
    assert.equal(gradeNat(104, 104, 0), true);
    assert.equal(gradeNat(5.674, 5.67, 0.01), true);
    assert.equal(gradeNat(5.7, 5.67, 0.01), false);
    assert.equal(gradeNat(NaN, 5, 1), false);
  });
});

describe("input schemas", () => {
  it("accepts one shape per question type", () => {
    assert.ok(submittedAnswerSchema.safeParse({ optionId: "A" }).success);
    assert.ok(submittedAnswerSchema.safeParse({ optionIds: ["A", "C"] }).success);
    assert.ok(submittedAnswerSchema.safeParse({ value: 3.14 }).success);
    assert.ok(!submittedAnswerSchema.safeParse({ optionIds: [] }).success);
    assert.ok(!submittedAnswerSchema.safeParse({ value: Number.NaN }).success);
  });
  it("caps list pagination", () => {
    const parsed = questionFilterSchema.parse({});
    assert.equal(parsed.page, 1);
    assert.equal(parsed.limit, 20);
    assert.ok(!questionFilterSchema.safeParse({ limit: 500 }).success);
  });
});
