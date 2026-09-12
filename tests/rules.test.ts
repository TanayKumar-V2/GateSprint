import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  accuracyOf,
  evaluateWeakTopic,
  pct,
  rankQuestions,
} from "../lib/recommend-rules";

describe("accuracyOf", () => {
  it("returns null with no attempts, never a fake zero", () => {
    assert.equal(accuracyOf(0, 0), null);
    assert.equal(accuracyOf(2, 4), 0.5);
  });
});

describe("evaluateWeakTopic", () => {
  it("flags sustained low accuracy", () => {
    const v = evaluateWeakTopic({ attempts: 5, correct: 2, recentMissStreak: 0 });
    assert.equal(v.weak, true);
    assert.ok((v.reason ?? "").includes("40%"));
  });
  it("flags early repeated misses on small samples", () => {
    const v = evaluateWeakTopic({ attempts: 2, correct: 0, recentMissStreak: 2 });
    assert.equal(v.weak, true);
    assert.ok((v.reason ?? "").includes("early warning"));
  });
  it("stays quiet for healthy and untouched topics", () => {
    assert.equal(evaluateWeakTopic({ attempts: 5, correct: 4, recentMissStreak: 0 }).weak, false);
    assert.equal(evaluateWeakTopic({ attempts: 0, correct: 0, recentMissStreak: 0 }).weak, false);
    assert.equal(evaluateWeakTopic({ attempts: 1, correct: 0, recentMissStreak: 1 }).weak, false);
  });
  it("sits exactly on the boundary correctly", () => {
    assert.equal(evaluateWeakTopic({ attempts: 5, correct: 3, recentMissStreak: 0 }).weak, false);
  });
});

describe("pct", () => {
  it("never prints a percentage without data", () => {
    assert.equal(pct(null), "—");
    assert.equal(pct(0.424), "42%");
  });
});

describe("rankQuestions", () => {
  it("orders gentle first, newest first, stable", () => {
    const ranked = rankQuestions([
      { id: "h", difficulty: "hard", year: 2024, questionNumber: 1 },
      { id: "m-old", difficulty: "medium", year: 2020, questionNumber: 1 },
      { id: "m-new", difficulty: "medium", year: 2024, questionNumber: 1 },
      { id: "e", difficulty: "easy", year: 2019, questionNumber: 9 },
    ]);
    assert.deepEqual(
      ranked.map((q) => q.id),
      ["e", "m-new", "m-old", "h"],
    );
  });
});
