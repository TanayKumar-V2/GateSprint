import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildClassificationPrompt,
  chunkItems,
  parseClassificationJson,
  taxonomyBlock,
  toClassifyInput,
} from "../lib/imports/classify";

const subjects = [
  { id: "s1", name: "Databases", slug: "databases" },
  { id: "s2", name: "Operating Systems", slug: "operating-systems" },
];
const topics = [
  { id: "t1", name: "Normalization", slug: "normal-forms", subjectId: "s1" },
  { id: "t2", name: "CPU Scheduling", slug: "cpu-scheduling", subjectId: "s2" },
];

describe("toClassifyInput", () => {
  it("compacts prompts and options for the model call", () => {
    const input = toClassifyInput("Q1", "What is 2PL?", [
      { id: "A", text: "Two-phase locking" },
      { id: "B", text: "Other" },
    ]);
    assert.equal(input.externalId, "Q1");
    assert.equal(input.optionsText, "A: Two-phase locking | B: Other");
  });
  it("truncates long prompts and nulls empty options", () => {
    const long = "x".repeat(2000);
    const input = toClassifyInput("Q2", long, null);
    assert.equal(input.prompt.length, 500);
    assert.equal(input.optionsText, null);
    assert.equal(toClassifyInput("Q3", "p", []).optionsText, null);
  });
});

describe("taxonomyBlock", () => {
  it("lists topic slugs grouped under their subject", () => {
    assert.equal(
      taxonomyBlock(subjects, topics),
      "databases: normal-forms\noperating-systems: cpu-scheduling",
    );
  });
});

describe("buildClassificationPrompt", () => {
  it("embeds taxonomy, rows, and the JSON-only contract", () => {
    const prompt = buildClassificationPrompt(
      [toClassifyInput("Q1", "Explain 2PL.", null)],
      subjects,
      topics,
    );
    assert.ok(prompt.includes("databases: normal-forms"));
    assert.ok(prompt.includes("Q1"));
    assert.ok(prompt.includes('"assignments"'));
    assert.ok(prompt.includes("never invent"));
    assert.ok(prompt.includes("Confusable pairs"));
    assert.ok(prompt.includes("databases/transactions"));
  });
});

describe("chunkItems", () => {
  it("splits batches for the TPM ceiling", () => {
    assert.deepEqual(chunkItems([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
    assert.deepEqual(chunkItems([], 15), []);
    assert.deepEqual(chunkItems([1], 15), [[1]]);
  });
});

describe("parseClassificationJson", () => {
  it("parses fenced assignments and drops bad entries", () => {
    const parsed = parseClassificationJson(
      '```json\n{"assignments":[{"externalId":"Q1","subject":"databases","topic":"normal-forms"},{"externalId":"","subject":"x","topic":"y"},{"externalId":"Q2","subject":"","topic":"  "}]}\n```',
    );
    assert.deepEqual(parsed, [
      { externalId: "Q1", subject: "databases", topic: "normal-forms" },
      { externalId: "Q2", subject: null, topic: null },
    ]);
  });
  it("accepts a bare array and rejects garbage", () => {
    assert.deepEqual(
      parseClassificationJson('[{"externalId":"Q9","subject":null,"topic":null}]'),
      [{ externalId: "Q9", subject: null, topic: null }],
    );
    assert.deepEqual(parseClassificationJson("not json at all"), []);
    assert.deepEqual(parseClassificationJson('{"assignments":"nope"}'), []);
  });
});
