import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  missingYears,
  regressionSlope,
  shareOf,
  topicTrend,
  trendLabel,
  zeroFillYears,
} from "../lib/trends-rules";
import { sheetContextBlock, SHEET_CONTEXT_CHARS, utcDay } from "../lib/sheets-rules";
import { sheetContentSchema, trendsQuerySchema } from "../lib/validation/extension";

describe("regressionSlope / trendLabel", () => {
  it("detects rising and falling series", () => {
    const rising = [
      { year: 2020, marks: 4 },
      { year: 2021, marks: 5 },
      { year: 2022, marks: 6 },
      { year: 2023, marks: 8 },
      { year: 2024, marks: 9 },
    ];
    const { slope, label } = topicTrend(rising);
    assert.ok(slope > 0);
    assert.equal(label, "rising");
    assert.equal(
      topicTrend(rising.map((p) => ({ ...p, marks: 20 - p.marks }))).label,
      "falling",
    );
  });

  it("calls small wiggles stable and needs 2+ points", () => {
    assert.equal(trendLabel(0.4), "stable");
    assert.equal(trendLabel(-0.4), "stable");
    assert.equal(regressionSlope([]), 0);
    assert.equal(regressionSlope([{ year: 2024, marks: 5 }]), 0);
    assert.equal(topicTrend([]).label, "stable");
  });

  it("shares never divide by zero and always total honestly", () => {
    assert.equal(shareOf(0, 0), 0);
    assert.equal(shareOf(25, 100), 0.25);
  });
});

describe("zeroFillYears / missingYears", () => {
  it("fills empty years with zeros so gaps render", () => {
    const filled = zeroFillYears(
      [{ year: 2022, marks: 6, count: 3 }],
      2020,
      2024,
    );
    assert.deepEqual(
      filled.map((y) => y.year),
      [2020, 2021, 2022, 2023, 2024],
    );
    assert.equal(filled[0]?.marks, 0);
    assert.equal(filled[2]?.count, 3);
  });

  it("flags bank gaps for the coverage warning", () => {
    assert.deepEqual(
      missingYears(
        [
          { year: 2022, count: 3 },
          { year: 2024, count: 1 },
        ],
        2022,
        2024,
      ),
      [2023],
    );
    assert.deepEqual(missingYears([], 2020, 2021), [2020, 2021]);
  });
});

describe("sheetContextBlock", () => {
  it("delimits the sheet so prompts stay separated", () => {
    const block = sheetContextBlock("Trees", "# Trees\n- preorder");
    assert.ok(block.startsWith("<sheet-context>"));
    assert.ok(block.endsWith("</sheet-context>"));
    assert.ok(block.includes('topic="Trees"'));
  });

  it("truncates to the input cap and says so", () => {
    const big = `# T\n${"formula line\n".repeat(2000)}`;
    assert.ok(big.length > SHEET_CONTEXT_CHARS);
    const block = sheetContextBlock("T", big, 500);
    assert.ok(block.length < big.length);
    assert.ok(block.includes("truncated to input budget"));
    assert.ok(block.endsWith("</sheet-context>"));
  });

  it("keys revision days in UTC", () => {
    assert.equal(utcDay(new Date("2026-09-17T23:30:00Z")), "2026-09-17");
  });
});

describe("trends/sheets validation", () => {
  it("bounds the trend window", () => {
    assert.equal(trendsQuerySchema.safeParse({}).success, true);
    assert.equal(trendsQuerySchema.safeParse({ fromYear: "2018" }).success, true);
    assert.equal(trendsQuerySchema.safeParse({ fromYear: "1800" }).success, false);
  });

  it("requires real sheet content for admin publish", () => {
    assert.equal(sheetContentSchema.safeParse({ contentMd: "short" }).success, false);
    assert.equal(sheetContentSchema.safeParse({ contentMd: "# Real sheet\n- a\n- b" }).success, true);
  });
});
