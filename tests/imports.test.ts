import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  answerMatchesOptions,
  comparable,
  dedupeKey,
  extractNumberValue,
  extractOptionLetter,
  extractOptionLetters,
  isQuarantined,
  matchSubject,
  matchTopic,
  normalizeAnswer,
  normalizeConfidence,
  normalizeEnum,
  normalizeOptions,
  normalizePenalty,
  normalizeQuestionNumber,
  normalizeType,
  related,
  same,
  toNumber,
} from "../lib/imports/normalize";

const subjects = [
  { id: "s1", name: "Programming and Data Structures", slug: "programming-data-structures" },
  { id: "s2", name: "Databases", slug: "databases" },
  { id: "s3", name: "Operating Systems", slug: "operating-systems" },
];
const topics = [
  { id: "t1", name: "Trees", slug: "trees", subjectId: "s1" },
  { id: "t2", name: "Normalization", slug: "normal-forms", subjectId: "s2" },
  { id: "t3", name: "CPU Scheduling", slug: "cpu-scheduling", subjectId: "s3" },
];

describe("comparable", () => {
  it("drops filler words so names match slugs", () => {
    assert.equal(comparable("Programming & Data Structures"), "programmingdatastructures");
    assert.equal(comparable("programming-data-structures"), "programmingdatastructures");
    assert.equal(same("Programming & Data Structures", "programming-data-structures"), true);
  });
  it("related needs meaningful overlap", () => {
    assert.equal(related("Databases", "Database Management Systems"), true);
    assert.equal(related("CS", "Mathematics"), false);
    assert.equal(related("", "trees"), false);
  });
});

describe("taxonomy matching", () => {
  it("matches subjects despite filler words", () => {
    assert.equal(matchSubject(subjects, "Programming & Data Structures")?.id, "s1");
    assert.equal(matchSubject(subjects, "programming-data-structures")?.id, "s1");
    assert.equal(matchSubject(subjects, "Astrophysics"), null);
  });
  it("matches topics and honors topic-only aliases", () => {
    assert.equal(matchTopic(topics, "s2", "normalization")?.id, "t2");
    assert.equal(matchTopic(topics, "s1", "trees")?.id, "t1");
    assert.equal(matchTopic(topics, "s1", "scheduling")?.id ?? null, null);
    assert.equal(matchTopic(topics, "s9", "trees"), null);
  });
});

describe("isQuarantined", () => {
  const bucketSubject = { id: "sq", name: "Uncategorized", slug: "uncategorized" };
  const bucketTopic = { id: "tq", name: "Needs Review", slug: "needs-review", subjectId: "sq" };
  it("treats missing or holding-bucket placements as unplaced", () => {
    assert.equal(isQuarantined(null, null), true);
    assert.equal(isQuarantined(subjects[0] ?? null, null), true);
    assert.equal(isQuarantined(bucketSubject, bucketTopic), true);
    assert.equal(
      isQuarantined(subjects[1] ?? null, topics[1] ? { ...topics[1], slug: "needs-review" } : null),
      true,
    );
  });
  it("accepts real taxonomy placements", () => {
    assert.equal(isQuarantined(subjects[0] ?? null, topics[0] ?? null), false);
  });
  it("catches extractor defaults matching the bucket itself", () => {
    const withBucket = [...subjects, bucketSubject];
    const matched = matchSubject(withBucket, "Uncategorized");
    assert.equal(matched?.slug, "uncategorized");
    assert.equal(isQuarantined(matched, bucketTopic), true);
  });
});

describe("toNumber", () => {
  it("coerces numeric strings, preserves empties, rejects junk", () => {
    assert.equal(toNumber("2024"), 2024);
    assert.equal(toNumber("12.5"), 12.5);
    assert.equal(toNumber(2), 2);
    assert.equal(toNumber(""), undefined);
    assert.equal(toNumber(null), null);
    assert.ok(Number.isNaN(toNumber("twelve") as number));
    assert.ok(Number.isNaN(toNumber({}) as number));
  });
});

describe("normalizePenalty", () => {
  it("stores penalty magnitudes, preserving empties and junk", () => {
    assert.equal(normalizePenalty(-0.33), 0.33);
    assert.equal(normalizePenalty("-0.33"), 0.33);
    assert.equal(normalizePenalty(0.33), 0.33);
    assert.equal(normalizePenalty(0), 0);
    assert.equal(normalizePenalty(null), null);
    assert.equal(normalizePenalty(""), undefined);
    assert.ok(Number.isNaN(normalizePenalty("a third") as number));
  });
});

describe("normalizeEnum", () => {
  it("lowercases model output", () => {
    assert.equal(normalizeEnum("MCQ"), "mcq");
    assert.equal(normalizeEnum(" Medium "), "medium");
  });
});

describe("normalizeOptions", () => {
  it("accepts arrays and records, uppercases ids", () => {
    assert.deepEqual(normalizeOptions([{ id: "a", text: "x" }]), [{ id: "A", text: "x" }]);
    assert.deepEqual(normalizeOptions({ a: "x", b: "y" }), [
      { id: "A", text: "x" },
      { id: "B", text: "y" },
    ]);
    assert.equal(normalizeOptions(null), null);
    assert.equal(normalizeOptions(undefined), undefined);
  });
  it("repairs messy model ids instead of failing validation", () => {
    assert.deepEqual(normalizeOptions([{ id: "(A)", text: "x" }, { id: "Option B", text: "y" }]), [
      { id: "A", text: "x" },
      { id: "B", text: "y" },
    ]);
    assert.deepEqual(normalizeOptions([{ id: 1, text: "x" }, { id: 2, text: "y" }]), [
      { id: "A", text: "x" },
      { id: "B", text: "y" },
    ]);
    assert.deepEqual(normalizeOptions([{ id: "???", text: "x" }, { text: "y" }]), [
      { id: "A", text: "x" },
      { id: "B", text: "y" },
    ]);
  });
});

describe("extractOptionLetter(s)", () => {
  it("pulls single letters from noisy model output", () => {
    assert.equal(extractOptionLetter("(A)"), "A");
    assert.equal(extractOptionLetter("A."), "A");
    assert.equal(extractOptionLetter("Option B"), "B");
    assert.equal(extractOptionLetter("ans: c"), "C");
    assert.equal(extractOptionLetter(1), "A");
    assert.equal(extractOptionLetter(""), null);
    assert.equal(extractOptionLetter("?"), null);
  });
  it("splits plural answers on any separator", () => {
    assert.deepEqual(extractOptionLetters("A,C"), ["A", "C"]);
    assert.deepEqual(extractOptionLetters("A; C"), ["A", "C"]);
    assert.deepEqual(extractOptionLetters("A and C"), ["A", "C"]);
    assert.deepEqual(extractOptionLetters(["(A)", "Option C"]), ["A", "C"]);
    assert.deepEqual(extractNumberValue("≈ 12.5"), 12.5);
  });
});

describe("normalizeType", () => {
  it("maps loose model labels to mcq/msq/nat", () => {
    assert.equal(normalizeType("Single Choice"), "mcq");
    assert.equal(normalizeType("multiple-choice"), "msq");
    assert.equal(normalizeType("Numerical"), "nat");
    assert.equal(normalizeType("MCQ"), "mcq");
  });
});

describe("normalizeAnswer", () => {
  it("splits MSQ strings and defaults NAT tolerance", () => {
    assert.deepEqual(normalizeAnswer({ kind: "MSQ", optionIds: "A,C" }), {
      kind: "msq",
      optionIds: ["A", "C"],
    });
    assert.deepEqual(normalizeAnswer({ kind: "nat", value: 12.5 }), {
      kind: "nat",
      value: 12.5,
      tolerance: 0,
    });
    assert.deepEqual(normalizeAnswer({ kind: "nat", value: "12.5" }), {
      kind: "nat",
      value: 12.5,
      tolerance: 0,
    });
    assert.equal((normalizeAnswer({ kind: "mcq", optionId: "b" }) as { optionId: string }).optionId, "B");
  });
  it("repairs the shapes that used to skip entire imports", () => {
    // Previously: correctAnswer.optionId "must match pattern /^[A-Z]$/".
    assert.deepEqual(normalizeAnswer({ kind: "mcq", optionId: "(A)" }, "mcq"), { kind: "mcq", optionId: "A" });
    assert.deepEqual(normalizeAnswer({ kind: "mcq", optionId: "Option A" }, "mcq"), { kind: "mcq", optionId: "A" });
    assert.deepEqual(normalizeAnswer({ kind: "mcq", optionId: "1" }, "mcq"), { kind: "mcq", optionId: "A" });
    // Previously: correctAnswer "Invalid input" for non-object answers.
    assert.deepEqual(normalizeAnswer("A", "mcq"), { kind: "mcq", optionId: "A" });
    assert.deepEqual(normalizeAnswer("A,C", "msq"), { kind: "msq", optionIds: ["A", "C"] });
    assert.deepEqual(normalizeAnswer({ answer: "C" }, "mcq"), { kind: "mcq", optionId: "C" });
    assert.deepEqual(normalizeAnswer({ optionId: "B" }, "mcq"), { kind: "mcq", optionId: "B" });
    assert.deepEqual(normalizeAnswer({ kind: "nat", value: "12.5-13.5" }, "nat"), { kind: "nat", value: 13, tolerance: 0.5 });
  });
  it("returns null for missing keys so imports become review drafts", () => {
    assert.equal(normalizeAnswer(null, "mcq"), null);
    assert.equal(normalizeAnswer(undefined, "mcq"), null);
    assert.equal(normalizeAnswer("", "mcq"), null);
    assert.equal(normalizeAnswer("?", "mcq"), null);
    assert.equal(normalizeAnswer({ kind: "mcq", optionId: "?" }, "mcq"), null);
    assert.equal(normalizeAnswer({}, "mcq"), null);
  });
});

describe("answerMatchesOptions", () => {
  const options = [{ id: "A" }, { id: "B" }, { id: "C" }, { id: "D" }];
  it("rejects answers pointing outside the options", () => {
    assert.equal(answerMatchesOptions({ kind: "mcq", optionId: "E" }, options), false);
    assert.equal(answerMatchesOptions({ kind: "mcq", optionId: "A" }, options), true);
    assert.equal(answerMatchesOptions({ kind: "msq", optionIds: ["A", "Z"] }, options), false);
    assert.equal(answerMatchesOptions({ kind: "msq", optionIds: ["A", "C"] }, options), true);
    assert.equal(answerMatchesOptions({ kind: "mcq", optionId: "A" }, null), false);
    assert.equal(answerMatchesOptions({ kind: "nat" }, null), true);
  });
});

describe("dedupeKey", () => {
  it("ignores case and whitespace", () => {
    assert.equal(dedupeKey("  What is  X? "), dedupeKey("what is x?"));
  });
});

describe("normalizeQuestionNumber", () => {
  it("reads numbers out of noisy model output", () => {
    assert.equal(normalizeQuestionNumber("Q12"), 12);
    assert.equal(normalizeQuestionNumber("12."), 12);
    assert.equal(normalizeQuestionNumber(7), 7);
    assert.equal(normalizeQuestionNumber(null), null);
    assert.equal(normalizeQuestionNumber(""), undefined);
    assert.ok(Number.isNaN(normalizeQuestionNumber("twelve") as number));
  });
});

describe("normalizeConfidence", () => {
  it("maps words and percents, never returns junk", () => {
    assert.equal(normalizeConfidence("high"), 0.9);
    assert.equal(normalizeConfidence("low"), 0.2);
    assert.equal(normalizeConfidence(85), 0.85);
    assert.equal(normalizeConfidence(0.7), 0.7);
    assert.equal(normalizeConfidence("nonsense"), null);
    assert.equal(normalizeConfidence(null), null);
  });
});
