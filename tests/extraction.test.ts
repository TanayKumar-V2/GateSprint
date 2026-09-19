import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  countQuestionMarkers,
  extractionKey,
  mergeExtractions,
  parseExtractionJson,
} from "../lib/imports/extraction";

describe("countQuestionMarkers", () => {
  it("counts Q.<n> line starts as probable questions", () => {
    const text = [
      "Q.1 – Q.5 Carry ONE mark Each",
      "Q.1 If x then y?",
      "(A) 1",
      "Q.2 Two wizards try",
      "General Aptitude (GA)",
    ].join("\n");
    // Header line plus two starts.
    assert.equal(countQuestionMarkers(text), 3);
  });

  it("ignores option markers and prose mentions", () => {
    assert.equal(countQuestionMarkers("(A) phased\n(B) phrased\n"), 0);
  });
});

describe("parseExtractionJson", () => {
  it("parses complete payloads without flagging truncation", () => {
    const parsed = parseExtractionJson(
      '{"questions":[{"externalId":"X-Q1","questionNumber":1}]}',
    );
    assert.equal(parsed.truncated, false);
    assert.equal(parsed.questions.length, 1);
  });

  it("accepts bare arrays", () => {
    const parsed = parseExtractionJson('[{"questionNumber":2}]');
    assert.equal(parsed.truncated, false);
    assert.equal(parsed.questions.length, 1);
  });

  it("flags salvaged fragments as truncated", () => {
    const parsed = parseExtractionJson(
      '{"questions":[{"externalId":"X-Q1","questionNumber":1},{"externalId":"X-Q2",',
    );
    assert.equal(parsed.truncated, true);
    assert.equal(parsed.questions.length, 1);
  });

  it("flags unparseable output as truncated with nothing recovered", () => {
    const parsed = parseExtractionJson("not json at all");
    assert.equal(parsed.truncated, true);
    assert.deepEqual(parsed.questions, []);
  });
});

describe("mergeExtractions", () => {
  it("unions by question number without doubling", () => {
    const primary = [
      { questionNumber: 1, prompt: "First?" },
      { questionNumber: 2, prompt: "Second?" },
    ];
    const fallback = [
      { questionNumber: 2, prompt: "Second, rephrased?" },
      { questionNumber: 3, prompt: "Third?" },
    ];
    const merged = mergeExtractions(primary, fallback);
    assert.equal(merged.length, 3);
    assert.deepEqual(
      merged.map((q) => (q as { questionNumber: number }).questionNumber),
      [1, 2, 3],
    );
  });

  it("keeps keyless stragglers for save-time dedup", () => {
    const merged = mergeExtractions([], [{ prompt: "Mystery?" }]);
    assert.equal(merged.length, 1);
  });
});

describe("extractionKey", () => {
  it("prefers numbers, then ids, then prompt heads", () => {
    assert.equal(extractionKey({ questionNumber: 7 }), "qn:7");
    assert.equal(extractionKey({ externalId: "X-Q1" }), "ext:X-Q1");
    assert.equal(
      extractionKey({ prompt: "  Hello world  " }),
      "prompt:Hello world",
    );
    assert.equal(extractionKey(null), null);
    assert.equal(extractionKey("junk"), null);
  });
});
