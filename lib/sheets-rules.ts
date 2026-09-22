/** Sheet context budget: sheet content truncated to fit the input cap. */
export const SHEET_CONTEXT_CHARS = 6000;

export const SHEET_BEGIN = "<sheet-context>";
export const SHEET_END = "</sheet-context>";

/**
 * Delimited + truncated sheet context for the Mentor system prompt.
 * Truncation cuts at a line boundary and marks itself honestly.
 */
export function sheetContextBlock(topicName: string, contentMd: string, budget = SHEET_CONTEXT_CHARS): string {
  const body =
    contentMd.length > budget
      ? `${contentMd.slice(0, budget).split("\n").slice(0, -1).join("\n")}\n…(truncated to input budget)`
      : contentMd;
  return `${SHEET_BEGIN} topic="${topicName}"\n${body}\n${SHEET_END}`;
}

/** UTC calendar day key for the one-revision-per-day rule. */
export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}
