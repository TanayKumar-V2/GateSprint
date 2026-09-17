import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isValidUsername, usernameCandidate } from "../lib/username";

describe("isValidUsername", () => {
  it("accepts lowercase handles with digits and underscores", () => {
    assert.equal(isValidUsername("tanay_kumar"), true);
    assert.equal(isValidUsername("abc"), true);
    assert.equal(isValidUsername("user_123"), true);
  });
  it("rejects uppercase, spaces, dots, dashes, and bad lengths", () => {
    assert.equal(isValidUsername("Tanay"), false);
    assert.equal(isValidUsername("tanay kumar"), false);
    assert.equal(isValidUsername("tanay.kumar"), false);
    assert.equal(isValidUsername("tanay-kumar"), false);
    assert.equal(isValidUsername("ab"), false);
    assert.equal(isValidUsername("a".repeat(31)), false);
    assert.equal(isValidUsername(""), false);
  });
});

describe("usernameCandidate", () => {
  it("derives a handle from the display name", () => {
    assert.equal(usernameCandidate("Tanay Kumar", null), "tanay_kumar");
  });
  it("falls back to the email local part", () => {
    assert.equal(usernameCandidate(null, "ApiA@x.com"), "apia");
  });
  it("pads tiny inputs so the result stays valid", () => {
    const handle = usernameCandidate("Al", null);
    assert.equal(isValidUsername(handle), true);
  });
  it("falls back to a generic handle with no identity", () => {
    assert.equal(isValidUsername(usernameCandidate(null, null)), true);
  });
});
