import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeMathDelimiters } from "../components/markdown/math-text";

describe("normalizeMathDelimiters", () => {
  it("converts paren and bracket delimiters to dollars", () => {
    assert.equal(normalizeMathDelimiters("a \\(\\lambda\\) b"), "a $\\lambda$ b");
    assert.equal(normalizeMathDelimiters("a \\[x^2\\] b"), "a $$x^2$$ b");
  });
  it("leaves escaped backslashes alone", () => {
    assert.equal(normalizeMathDelimiters("a \\\\(x\\\\) b"), "a \\\\(x\\\\) b");
  });
  it("never touches code", () => {
    const fence = "```python\nre.match(\"\\(a\\)\", s)\n```";
    assert.equal(normalizeMathDelimiters(fence), fence);
    assert.equal(normalizeMathDelimiters("use `\\(x\\)` here"), "use `\\(x\\)` here");
  });
  it("leaves dollar math untouched", () => {
    assert.equal(normalizeMathDelimiters("a $x^2$ b"), "a $x^2$ b");
  });
});
