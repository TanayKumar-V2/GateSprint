import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  average,
  classifyAttempt,
  FLAG_LABEL,
  median,
  percentile,
  summarize,
} from "../lib/time-analytics-rules";
import { topicStatus } from "../lib/syllabus-rules";
import {
  syllabusTopicPatchSchema,
  timeQuerySchema,
} from "../lib/validation/extension";

describe("median / percentile / average", () => {
  it("returns null on empty, never a fake zero", () => {
    assert.equal(median([]), null);
    assert.equal(percentile([], 0.9), null);
    assert.equal(average([]), null);
  });

  it("handles even and odd samples", () => {
    assert.equal(median([30, 90, 60]), 60);
    assert.equal(median([30, 90]), 60);
    assert.equal(percentile([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 0.9), 90);
  });

  it("ignores non-finite values and null times", () => {
    assert.equal(median([Number.NaN, 50, Infinity]), 50);
    const s = summarize([45, null, undefined, 75]);
    assert.equal(s.n, 2);
    assert.equal(s.median, 60);
  });

  it("aggregate shape carries counts but no user rows", () => {
    const s = summarize([10, 20, 30]);
    assert.deepEqual(Object.keys(s).sort(), ["avg", "median", "n", "p90"]);
    assert.equal(s.n, 3);
  });
});

describe("classifyAttempt", () => {
  it("flags rushed wrong answers under 30s", () => {
    assert.equal(classifyAttempt({ yourSeconds: 12, medianSeconds: 90, isCorrect: false }), "rushed");
    assert.equal(classifyAttempt({ yourSeconds: 29, medianSeconds: null, isCorrect: false }), "rushed");
  });

  it("sits exactly on the rushed boundary correctly", () => {
    assert.equal(classifyAttempt({ yourSeconds: 30, medianSeconds: 90, isCorrect: false }), "ok");
  });

  it("flags overtime wrong answers past max(180s, 3x median)", () => {
    // median 60 -> threshold max(180, 180) = 180
    assert.equal(classifyAttempt({ yourSeconds: 200, medianSeconds: 60, isCorrect: false }), "overtime");
    assert.equal(classifyAttempt({ yourSeconds: 179, medianSeconds: 60, isCorrect: false }), "ok");
    // median 100 -> threshold max(180, 300) = 300
    assert.equal(classifyAttempt({ yourSeconds: 301, medianSeconds: 100, isCorrect: false }), "overtime");
    assert.equal(classifyAttempt({ yourSeconds: 250, medianSeconds: 100, isCorrect: false }), "ok");
    // no peer data -> falls back to 180s floor
    assert.equal(classifyAttempt({ yourSeconds: 200, medianSeconds: null, isCorrect: false }), "overtime");
  });

  it("flags slow correct answers as revision candidates", () => {
    assert.equal(classifyAttempt({ yourSeconds: 400, medianSeconds: 100, isCorrect: true }), "slow_correct");
    assert.equal(classifyAttempt({ yourSeconds: 120, medianSeconds: 100, isCorrect: true }), "ok");
  });

  it("never flags a fast correct answer", () => {
    assert.equal(classifyAttempt({ yourSeconds: 5, medianSeconds: 90, isCorrect: true }), "ok");
  });

  it("labels every flag for the UI", () => {
    assert.equal(FLAG_LABEL.rushed, "Too fast + wrong");
    assert.equal(FLAG_LABEL.overtime, "Overtime + wrong");
    assert.equal(FLAG_LABEL.slow_correct, "Slow + correct");
    assert.equal(FLAG_LABEL.ok, "On pace");
  });
});

describe("topicStatus", () => {
  it("stays not-started with zero attempts (zero-division safe)", () => {
    assert.equal(
      topicStatus({ attempts: 0, correct: 0, attemptedQuestions: 0, totalQuestions: 0 }).valueOf(),
      "not-started",
    );
    assert.equal(topicStatus({ attempts: 0, correct: 0, attemptedQuestions: 0, totalQuestions: 10 }), "not-started");
  });

  it("requires 5+ attempts at 80%+ accuracy and 80%+ coverage for ready", () => {
    assert.equal(topicStatus({ attempts: 5, correct: 4, attemptedQuestions: 8, totalQuestions: 10 }), "exam-ready");
    // accuracy edge: 3/5 = 60% stays in progress
    assert.equal(topicStatus({ attempts: 5, correct: 3, attemptedQuestions: 8, totalQuestions: 10 }), "in-progress");
    // coverage edge: 7/10 = 70% stays in progress
    assert.equal(topicStatus({ attempts: 5, correct: 5, attemptedQuestions: 7, totalQuestions: 10 }), "in-progress");
    // volume edge: 4 perfect attempts on full coverage still in progress
    assert.equal(topicStatus({ attempts: 4, correct: 4, attemptedQuestions: 10, totalQuestions: 10 }), "in-progress");
  });

  it("treats empty topics as never-ready (no division by zero)", () => {
    assert.equal(topicStatus({ attempts: 9, correct: 9, attemptedQuestions: 0, totalQuestions: 0 }), "in-progress");
  });

  it("is a pure function of attempts: overrides cannot pollute it", () => {
    const base = { attempts: 6, correct: 5, attemptedQuestions: 9, totalQuestions: 10 };
    assert.equal(topicStatus(base), "exam-ready");
    assert.equal(topicStatus({ ...base }), "exam-ready");
  });
});

describe("time/syllabus validation", () => {
  it("accepts an optional subject slug on time queries", () => {
    assert.equal(timeQuerySchema.safeParse({}).success, true);
    assert.equal(timeQuerySchema.safeParse({ subject: "algorithms" }).success, true);
    assert.equal(timeQuerySchema.safeParse({ subject: "Bad Slug!" }).success, false);
  });

  it("requires a topic slug and a valid override value", () => {
    assert.equal(
      syllabusTopicPatchSchema.safeParse({ topicSlug: "trees", override: "focus" }).success,
      true,
    );
    assert.equal(
      syllabusTopicPatchSchema.safeParse({ topicSlug: "trees", override: null }).success,
      true,
    );
    assert.equal(
      syllabusTopicPatchSchema.safeParse({ topicSlug: "trees", override: "done" }).success,
      false,
    );
    assert.equal(syllabusTopicPatchSchema.safeParse({ override: "focus" }).success, false);
  });
});
