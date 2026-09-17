import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MAX_IMAGES_PER_QUESTION, splitValidImages } from "../lib/imports/image-validation";
import { figureUrl } from "../components/questions/question-figures";

// 1x1 transparent PNG.
const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const good = (filename = "Q1-fig1.png") => ({
  filename,
  mime: "image/png",
  width: 120,
  height: 90,
  data: tinyPng,
});

describe("splitValidImages", () => {
  it("accepts well-formed figures", () => {
    const { valid, invalid } = splitValidImages([good()]);
    assert.equal(valid.length, 1);
    assert.equal(invalid, 0);
    assert.equal(valid[0]!.mime, "image/png");
  });
  it("accepts CDN url figures without bytes", () => {
    const { valid, invalid } = splitValidImages([
      { filename: "Q1-fig1.png", mime: "image/png", width: 800, height: 600, url: "https://ik.imagekit.io/test/q1.png" },
    ]);
    assert.equal(valid.length, 1);
    assert.equal(invalid, 0);
    assert.equal(valid[0]!.url, "https://ik.imagekit.io/test/q1.png");
  });
  it("rejects figures with both, neither, or non-http urls", () => {
    const { valid, invalid } = splitValidImages([
      { ...good("both.png"), url: "https://cdn.test/both.png" },
      { filename: "neither.png", mime: "image/png" },
      { filename: "js.png", mime: "image/png", url: "javascript:alert(1)" },
    ]);
    assert.equal(valid.length, 0);
    assert.equal(invalid, 3);
  });
  it("treats missing input as no figures", () => {
    assert.deepEqual(splitValidImages(undefined), { valid: [], invalid: 0 });
    assert.deepEqual(splitValidImages(null), { valid: [], invalid: 0 });
  });
  it("drops bad rows without failing the import", () => {
    const oversized = { ...good("big.png"), data: Buffer.alloc(600 * 1024, 1).toString("base64") };
    const { valid, invalid } = splitValidImages([
      good(),
      { ...good("bad.gif"), mime: "image/gif" },
      { ...good("empty.png"), data: "" },
      oversized,
      "not-an-object",
    ]);
    assert.equal(valid.length, 1);
    assert.equal(invalid, 4);
  });
  it("caps figures per question", () => {
    const many = Array.from({ length: MAX_IMAGES_PER_QUESTION + 2 }, (_, i) => good(`fig${i}.png`));
    const { valid, invalid } = splitValidImages(many);
    assert.equal(valid.length, MAX_IMAGES_PER_QUESTION);
    assert.equal(invalid, 2);
  });
});

describe("figureUrl", () => {
  it("points at the image serving route", () => {
    assert.equal(figureUrl("q1", "img9"), "/api/questions/q1/images/img9");
  });
});
