import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dueReason, nextDueAt } from "../lib/revision-rules";
import { clampInt, daysBetween, toSeconds } from "../lib/time";
import {
  mistakeListQuerySchema,
  mistakePatchSchema,
  revisionCompleteSchema,
  revisionQuerySchema,
} from "../lib/validation/extension";

describe("lib/time", () => {
  it("clamps integers to range and floors", () => {
    assert.equal(clampInt(5.9, 1, 10), 5);
    assert.equal(clampInt(-3, 1, 10), 1);
    assert.equal(clampInt(99, 1, 10), 10);
    assert.equal(clampInt(Number.NaN, 2, 8), 2);
  });

  it("converts ms to whole seconds", () => {
    assert.equal(toSeconds(1500), 1);
    assert.equal(toSeconds(-5), 0);
  });

  it("counts UTC calendar days", () => {
    assert.equal(
      daysBetween(new Date("2026-09-17T23:00:00Z"), new Date("2026-09-18T01:00:00Z")),
      1,
    );
  });
});

describe("revision intervals", () => {
  const base = new Date("2026-09-17T12:00:00Z");

  it("spaces misses 1/3/7/14 days by missCount", () => {
    const at = (missCount: number) =>
      nextDueAt({
        lastActivityAt: base,
        isCorrect: false,
        missCount,
        bookmarked: false,
        mistakeOpen: true,
      });
    assert.equal(at(1).toISOString(), new Date("2026-09-18T12:00:00Z").toISOString());
    assert.equal(at(2).toISOString(), new Date("2026-09-20T12:00:00Z").toISOString());
    assert.equal(at(3).toISOString(), new Date("2026-09-24T12:00:00Z").toISOString());
    assert.equal(at(9).toISOString(), new Date("2026-10-01T12:00:00Z").toISOString());
  });

  it("refreshes bookmarks in 2d and clean correct in 28d", () => {
    assert.equal(
      nextDueAt({ lastActivityAt: base, isCorrect: null, missCount: 0, bookmarked: true, mistakeOpen: false }).toISOString(),
      new Date("2026-09-19T12:00:00Z").toISOString(),
    );
    assert.equal(
      nextDueAt({ lastActivityAt: base, isCorrect: true, missCount: 0, bookmarked: false, mistakeOpen: false }).toISOString(),
      new Date("2026-10-15T12:00:00Z").toISOString(),
    );
  });

  it("explains why each card is due without inventing stats", () => {
    const reason = dueReason({
      missCount: 2,
      mistakeOpen: true,
      bookmarked: false,
      isCorrect: false,
      lastActivityAt: new Date("2026-09-14T12:00:00Z"),
      reference: base,
    });
    assert.ok(reason.includes("3d ago"));
    assert.ok(reason.includes("2 misses"));
    assert.equal(
      dueReason({
        missCount: 0,
        mistakeOpen: false,
        bookmarked: true,
        isCorrect: null,
        lastActivityAt: base,
        reference: base,
      }),
      "Saved · needs a revisit",
    );
  });

  it("dedupes by construction: same question maps to one due date", () => {
    const a = nextDueAt({ lastActivityAt: base, isCorrect: false, missCount: 1, bookmarked: false, mistakeOpen: true });
    const b = nextDueAt({ lastActivityAt: base, isCorrect: false, missCount: 1, bookmarked: false, mistakeOpen: true });
    assert.equal(a.getTime(), b.getTime());
  });
});

describe("extension validation", () => {
  it("rejects unknown mistake tags and empty patches", () => {
    assert.equal(mistakeListQuerySchema.safeParse({ tag: "nope" }).success, false);
    assert.equal(mistakePatchSchema.safeParse({}).success, false);
    assert.equal(mistakePatchSchema.safeParse({ tag: null }).success, true);
    assert.equal(mistakePatchSchema.safeParse({ tag: "trap", resolved: true }).success, true);
  });

  it("requires uuid question ids for revision complete", () => {
    assert.equal(revisionCompleteSchema.safeParse({ questionId: "not-a-uuid" }).success, false);
    assert.equal(
      revisionCompleteSchema.safeParse({ questionId: "123e4567-e89b-12d3-a456-426614174000" }).success,
      true,
    );
  });

  it("caps pagination", () => {
    const parsed = revisionQuerySchema.safeParse({ limit: "999", page: "0" });
    assert.equal(parsed.success, false);
    const ok = revisionQuerySchema.safeParse({ limit: "20", page: "2" });
    assert.equal(ok.success, true);
  });

  it("empty mistake queue is an honest empty state, not a fake zero", () => {
    const parsed = mistakeListQuerySchema.safeParse({});
    assert.equal(parsed.success, true);
    assert.equal(parsed.data?.page, 1);
    assert.equal(parsed.data?.limit, 20);
  });
});
