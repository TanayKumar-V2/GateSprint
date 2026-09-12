import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { APICallError } from "ai";
import {
  classifyFailure,
  fallbackEnabled,
  fallbackModelId,
  primaryModelId,
  shouldFallback,
} from "../lib/ai/model-router";

function apiError(status: number, message: string): APICallError {
  return new APICallError({ message, statusCode: status, url: "https://api.groq.com/x", requestBodyValues: {} });
}

describe("classifyFailure", () => {
  it("treats provider model-not-found as fallback-eligible", () => {
    assert.equal(classifyFailure(apiError(404, "model openai/gpt-oss-20b not found")), "model-unavailable");
  });
  it("treats overload and server errors as fallback-eligible", () => {
    assert.equal(classifyFailure(apiError(429, "rate limit exceeded")), "overloaded");
    assert.equal(classifyFailure(apiError(503, "overloaded")), "overloaded");
    assert.equal(classifyFailure(apiError(500, "internal error")), "server-error");
  });
  it("treats timeouts and network errors as overload", () => {
    assert.equal(classifyFailure(new Error("fetch failed")), "overloaded");
    assert.equal(classifyFailure(new Error("The operation timed out")), "overloaded");
    assert.equal(classifyFailure(Object.assign(new Error("x"), { name: "TimeoutError" })), "overloaded");
  });
  it("never falls back for bad input, auth, or app bugs", () => {
    assert.equal(classifyFailure(apiError(400, "invalid request")), "invalid-request");
    assert.equal(classifyFailure(apiError(422, "unprocessable")), "invalid-request");
    assert.equal(classifyFailure(apiError(401, "invalid api key")), "auth-error");
    assert.equal(classifyFailure(apiError(403, "forbidden")), "auth-error");
    assert.equal(classifyFailure(new Error("something odd")), "app-error");
  });
  it("treats aborts as cancellation, not failure", () => {
    assert.equal(classifyFailure(Object.assign(new Error("aborted"), { name: "AbortError" })), "cancelled");
  });
});

describe("shouldFallback", () => {
  it("retries once for availability failures only", () => {
    for (const kind of ["model-unavailable", "overloaded", "server-error"] as const) {
      assert.equal(shouldFallback(kind), true);
    }
    for (const kind of ["invalid-request", "auth-error", "app-error", "cancelled"] as const) {
      assert.equal(shouldFallback(kind), false);
    }
  });
});

describe("model configuration", () => {
  it("defaults to the planned model ids and enabled fallback", () => {
    const env = { ...process.env };
    delete process.env.GROQ_PRIMARY_MODEL;
    delete process.env.GROQ_FALLBACK_MODEL;
    delete process.env.GROQ_FALLBACK_ENABLED;
    try {
      assert.equal(primaryModelId(), "openai/gpt-oss-20b");
      assert.equal(fallbackModelId(), "openai/gpt-oss-120b");
      assert.equal(fallbackEnabled(), true);
    } finally {
      process.env = env;
    }
  });
});
