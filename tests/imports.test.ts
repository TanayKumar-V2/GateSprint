import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  answerMatchesOptions,
  comparable,
  dedupeKey,
  matchSubject,
  matchTopic,
  normalizeAnswer,
  normalizeEnum,
  normalizeOptions,
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
