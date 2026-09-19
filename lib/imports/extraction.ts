/**
 * Pure helpers for the PDF extraction loop in /api/admin/pdf-import.
 * No I/O, no framework imports — unit-tested in tests/extraction.test.ts.
 */

/** Probable question starts: lines beginning with a Q.<n> marker. */
export function countQuestionMarkers(text: string): number {
  let count = 0;
  for (const line of text.split("\n")) {
    if (/^\s*Q\s*\.?\s*\d{1,3}\b/.test(line)) count++;
  }
  return count;
}

export type ParsedExtraction = {
  questions: unknown[];
  /** True when the model output was cut off mid-JSON (recovered or not). */
  truncated: boolean;
};

/**
 * Parse model JSON like the import route does, but report truncation
 * instead of silently accepting salvaged fragments: a failed top-level
 * parse means the token budget cut the response short.
 */
export function parseExtractionJson(text: string): ParsedExtraction {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const objectStart = cleaned.indexOf("{");
  const arrayStart = cleaned.indexOf("[");
  const start =
    objectStart < 0
      ? arrayStart
      : arrayStart < 0
        ? objectStart
        : Math.min(objectStart, arrayStart);
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (start < 0 || end <= start) return { questions: [], truncated: true };
  try {
    const data: unknown = JSON.parse(cleaned.slice(start, end + 1));
    const questions = Array.isArray(data)
      ? data
      : data && typeof data === "object" && "questions" in data && Array.isArray((data as { questions: unknown }).questions)
        ? (data as { questions: unknown[] }).questions
        : [];
    // A clean parse that ends well before the raw text ended means the
    // model kept writing past our slice — treat as truncated.
    const trailing = cleaned.slice(end + 1).trim();
    return { questions, truncated: trailing.length > 20 };
  } catch {
    return { questions: recoverQuestionObjects(cleaned), truncated: true };
  }
}

function recoverQuestionObjects(text: string): unknown[] {
  const marker = text.indexOf('"questions"');
  const arrayStart = marker >= 0 ? text.indexOf("[", marker) : -1;
  if (arrayStart < 0) return [];
  const recovered: unknown[] = [];
  let objectStart = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = arrayStart + 1; index < text.length; index++) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "{") {
      if (depth === 0) objectStart = index;
      depth++;
    } else if (character === "}" && depth > 0) {
      depth--;
      if (depth === 0 && objectStart >= 0) {
        try {
          recovered.push(JSON.parse(text.slice(objectStart, index + 1)) as unknown);
        } catch {
          // Skip one malformed object.
        }
        objectStart = -1;
      }
    }
  }
  return recovered;
}

/** Merge key: question number wins, then external id, then prompt head. */
export function extractionKey(question: unknown): string | null {
  if (!question || typeof question !== "object" || Array.isArray(question)) {
    return null;
  }
  const record = question as Record<string, unknown>;
  const number = record.questionNumber;
  if (typeof number === "number" && Number.isInteger(number)) {
    return `qn:${number}`;
  }
  if (typeof record.externalId === "string" && record.externalId.trim()) {
    return `ext:${record.externalId.trim()}`;
  }
  if (typeof record.prompt === "string" && record.prompt.trim()) {
    return `prompt:${record.prompt.trim().slice(0, 80)}`;
  }
  return null;
}

/**
 * Union a truncated first pass with its compact retry. Keyless stragglers
 * are kept (save-time prompt dedup is the final guard against doubles).
 */
export function mergeExtractions(
  primary: unknown[],
  fallback: unknown[],
): unknown[] {
  const seen = new Set<string>();
  for (const question of primary) {
    const key = extractionKey(question);
    if (key) seen.add(key);
  }
  const merged = [...primary];
  for (const question of fallback) {
    const key = extractionKey(question);
    if (!key || !seen.has(key)) {
      merged.push(question);
      if (key) seen.add(key);
    }
  }
  return merged;
}
