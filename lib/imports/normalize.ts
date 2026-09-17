/* Pure import normalizers + validators — no database, no I/O.
 * Tested in tests/imports.test.ts. The imports route loads taxonomy rows
 * and applies these; everything that can be decided without the database
 * lives here so model-output quirks are handled in one tested place. */

/** Canonical form for fuzzy matching. Drops filler words so
 * "Programming & Data Structures" matches slug "programming-data-structures". */
export function comparable(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0 && word !== "and" && word !== "the")
    .join("");
}

export function same(value: string, target: string): boolean {
  return comparable(value) === comparable(target);
}

export function related(value: string, target: string): boolean {
  const left = comparable(value);
  const right = comparable(target);
  if (!left || !right) return false;
  if (left === right) return true;
  // Singular forms so "databases" still matches "...management systems".
  const singular = (word: string) =>
    word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word;
  const forms = (word: string) => [word, singular(word)];
  const pairs = forms(left).flatMap((a) => forms(right).map((b) => [a, b] as const));
  const meaningful = pairs.filter(([a, b]) => a.length >= 4 && b.length >= 4);
  if (meaningful.length === 0) return false;
  // Short tokens ("cs") can only match exactly, never by substring.
  if (left.length < 4 || right.length < 4) return false;
  return meaningful.some(
    ([a, b]) => a === b || a.includes(b) || b.includes(a),
  );
}

/** Topic aliases — every value must be a TOPIC slug (never a subject). */
export const topicAliases: Record<string, string> = {
  normalization: "normal-forms",
  normalforms: "normal-forms",
  normalform: "normal-forms",
  scheduling: "cpu-scheduling",
  regulanguage: "regular-languages",
  regularlanguage: "regular-languages",
  contextfreelanguage: "context-free-languages",
  contextfreelanguages: "context-free-languages",
  ipaddressing: "ip-addressing",
};

export type TaxonomySubject = { id: string; name: string; slug: string };
export type TaxonomyTopic = { id: string; name: string; slug: string; subjectId: string };

export function matchSubject(
  subjects: TaxonomySubject[],
  value: string,
): TaxonomySubject | null {
  return (
    subjects.find(
      (row) =>
        same(row.slug, value) || same(row.name, value) || related(row.name, value),
    ) ?? null
  );
}

export function matchTopic(
  topics: TaxonomyTopic[],
  subjectId: string,
  value: string,
): TaxonomyTopic | null {
  const normalized = topicAliases[comparable(value)] ?? value;
  return (
    topics.find(
      (row) =>
        row.subjectId === subjectId &&
        (same(row.slug, normalized) ||
          same(row.name, normalized) ||
          related(row.name, normalized)),
    ) ?? null
  );
}

/** Coerce the numbers models love to send as strings. null/"" stay empty. */
export function toNumber(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return value as null | undefined;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    if (value.trim() === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

export function normalizeEnum(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : (value as string);
}

/** Map the many ways models label question types to mcq/msq/nat. */
export function normalizeType(value: unknown): string {
  if (typeof value !== "string") return value as string;
  const key = value.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (["mcq", "single", "singlechoice", "objective", "chooseone", "onecorrect", "singlecorrect"].includes(key)) return "mcq";
  if (["msq", "multiple", "multiplechoice", "multi", "multiselect", "multipleselect", "more thanone", "morethanone", "multiplecorrect"].includes(key)) return "msq";
  if (["nat", "numeric", "numerical", "numericalanswer", "fill", "fillin", "integer", "decimal", "subjective"].includes(key)) return "nat";
  return value.trim().toLowerCase();
}

/** Map loose difficulty words to easy/medium/hard. */
export function normalizeDifficulty(value: unknown): string {
  if (typeof value !== "string") return value as string;
  const key = value.trim().toLowerCase();
  if (["easy", "easier", "easiest", "simple", "basic"].includes(key)) return "easy";
  if (["medium", "moderate", "average", "mid", "intermediate"].includes(key)) return "medium";
  if (["hard", "harder", "hardest", "difficult", "tough", "challenging", "complex"].includes(key)) return "hard";
  return key;
}

function letterFromNumber(value: number): string | null {
  if (!Number.isInteger(value) || value < 1 || value > 26) return null;
  return String.fromCharCode(64 + value);
}

const MISSING_TOKENS = new Set(["", "?", "-", "N/A", "NA", "NONE", "UNKNOWN", "NULL", "NOTGIVEN", "NOTKNOWN"]);

/**
 * Pull a single option letter out of messy model output such as
 * "(A)", "A.", "Option B", "ans: c", "1" (=A), or "a".
 * Returns null when no single letter can be identified confidently.
 */
export function extractOptionLetter(raw: unknown): string | null {
  if (typeof raw === "number") return letterFromNumber(raw);
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text) return null;
  const upper = text.toUpperCase();
  if (/^[A-Z]$/.test(upper)) return upper;
  if (/^\d{1,2}$/.test(upper)) return letterFromNumber(Number(upper));
  // Single letters standing alone as words: "OPTION A", "ANSWER: C".
  // (The O in "OPTION" is inside a word, so it cannot false-match.)
  const words: string[] = upper.match(/\b[A-Z]\b/g) ?? [];
  const distinct = [...new Set(words)];
  if (distinct.length === 1) return distinct[0]!;
  if (distinct.length > 1) return null; // plural — let extractOptionLetters handle it
  // snake/kebab keys the word-boundary scan misses: "option_a" -> A, "choice1" -> A.
  const parts = upper.split(/[_\-\s]+/).filter(Boolean);
  if (parts.length > 1) {
    const last = parts[parts.length - 1]!;
    if (/^[A-Z]$/.test(last)) return last;
    if (/^\d{1,2}$/.test(last)) {
      const mapped = letterFromNumber(Number(last));
      if (mapped) return mapped;
    }
    const trailing = last.match(/([A-Z])[^A-Z]*$/);
    if (trailing && last.length <= 8) return trailing[1]!;
  }
  const leadingNumber = upper.match(/^\(?\s*(\d{1,2})\s*[.)\]:-]/);
  if (leadingNumber) {
    const mapped = letterFromNumber(Number(leadingNumber[1]));
    if (mapped) return mapped;
  }
  const leadingLetter = upper.match(/^\(?\s*([A-Z])\s*[.)\]:-]/);
  if (leadingLetter) return leadingLetter[1]!;
  return null;
}

/**
 * Pull every option letter out of messy model output: arrays, "A,C",
 * "A; C", "A and C", "AC", "Option A and Option C", [1, 3] (=A,C).
 */
export function extractOptionLetters(raw: unknown): string[] {
  if (raw === null || raw === undefined) return [];
  if (typeof raw === "number") {
    const single = letterFromNumber(raw);
    return single ? [single] : [];
  }
  if (Array.isArray(raw)) {
    const out: string[] = [];
    for (const item of raw) {
      for (const letter of extractOptionLetters(item)) {
        if (!out.includes(letter)) out.push(letter);
      }
    }
    return out;
  }
  if (typeof raw !== "string") return [];
  const trimmed = raw.trim();
  if (!trimmed || MISSING_TOKENS.has(trimmed.toUpperCase().replace(/[\s_-]+/g, ""))) return [];
  const unified = trimmed.toUpperCase().replace(/\bAND\b|\bOR\b|&|\+|;/g, ",");
  const tokens = unified.split(/[,\s|/]+/).map((t) => t.trim()).filter(Boolean);
  const out: string[] = [];
  const push = (letter: string) => {
    if (/^[A-Z]$/.test(letter) && !out.includes(letter)) out.push(letter);
  };
  for (const token of tokens) {
    if (/^[A-Z]$/.test(token)) { push(token); continue; }
    if (/^\d{1,2}$/.test(token)) {
      const mapped = letterFromNumber(Number(token));
      if (mapped) push(mapped);
      continue;
    }
    // Bundled letters without separators ("AC", "ABC"). Restricted to A-F so
    // ordinary words ("OPTION") are ignored rather than shredded.
    if (/^[A-F]{2,6}$/.test(token)) {
      for (const char of token) push(char);
      continue;
    }
    const single = extractOptionLetter(token);
    if (single) { push(single); continue; }
    // Last resort for tokens like "(A-C)": harvest standalone letters.
    for (const char of token.match(/\b[A-Z]\b/g) ?? []) push(char);
  }
  return out;
}

/** First finite number in free text: "≈ 12.5", "answer 3", "12.5-13.5" -> 12.5. */
export function extractNumberValue(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const match = raw.match(/-?\d+(\.\d+)?([eE][-+]?\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Every finite number in free text, in order. */
export function extractNumbers(raw: unknown): number[] {
  if (typeof raw === "number") return Number.isFinite(raw) ? [raw] : [];
  if (typeof raw !== "string") return [];
  return (raw.match(/-?\d+(\.\d+)?([eE][-+]?\d+)?/g) ?? [])
    .map(Number)
    .filter((n) => Number.isFinite(n));
}

function pickField(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function normalizeKind(raw: unknown): "mcq" | "msq" | "nat" | undefined {
  if (typeof raw !== "string") return undefined;
  const key = raw.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (!key || ["unknown", "null", "none", "?", "n/a", "na"].includes(key)) return undefined;
  if (["mcq", "single", "singlechoice", "objective", "chooseone", "onecorrect", "singlecorrect"].includes(key)) return "mcq";
  if (["msq", "multiple", "multiplechoice", "multi", "multiselect", "multipleselect", "morethanone", "multiplecorrect"].includes(key)) return "msq";
  if (["nat", "numeric", "numerical", "numericalanswer", "fill", "fillin", "integer", "decimal", "subjective"].includes(key)) return "nat";
  return undefined;
}

function coerceNat(valueRaw: unknown, toleranceRaw: unknown): { kind: "nat"; value: number; tolerance: number } | null {
  // A hyphen between two digits is a range separator ("12.5-13.5"), not a
  // minus sign — split it before extracting numbers.
  const ranged = typeof valueRaw === "string"
    ? valueRaw.replace(/[–—]/g, "-").replace(/(\d)\s*-\s*(?=\d)/g, "$1 ")
    : valueRaw;
  const numbers = extractNumbers(ranged);
  if (numbers.length === 0) return null;
  let value = numbers[0]!;
  let tolerance = extractNumberValue(toleranceRaw);
  if (numbers.length >= 2) {
    const [a, b] = [numbers[0]!, numbers[1]!];
    value = (a + b) / 2;
    if (tolerance === null) tolerance = Math.abs(b - a) / 2;
  }
  if (!Number.isFinite(value)) return null;
  if (tolerance === null || !Number.isFinite(tolerance)) tolerance = 0;
  return { kind: "nat", value, tolerance: Math.abs(tolerance) };
}

export type RawOption = { id?: unknown; text?: unknown };

/** Accept [{id, text}] or {"A": "..."} record shapes; tolerate "(A)", "1", "option_a". */
export function normalizeOptions(value: unknown): { id: string; text: string }[] | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const positional = (index: number) => String.fromCharCode(65 + (index % 26));
  if (Array.isArray(value)) {
    const used = new Set<string>();
    return value.map((item, index) => {
      if (typeof item === "string") {
        const id = positional(index);
        used.add(id);
        return { id, text: item };
      }
      const row = (item ?? {}) as Record<string, unknown>;
      const idRaw = pickField(row, ["id", "key", "optionId", "option_id", "choice"]);
      let labelAsId: string | null = null;
      let labelAsText: string | null = null;
      if (typeof row.label === "string" && row.label.trim()) {
        const label = row.label.trim();
        if (label.length <= 3 && extractOptionLetter(label)) labelAsId = label;
        else labelAsText = label;
      }
      let id = extractOptionLetter(idRaw ?? labelAsId) ?? null;
      if (!id || used.has(id)) {
        const fallback = positional(index);
        id = used.has(fallback) ? (extractOptionLetter(idRaw ?? labelAsId) ?? fallback) : fallback;
      }
      used.add(id);
      const textRaw = pickField(row, ["text", "content", "value", "description", "optionText"]);
      return { id, text: String(textRaw ?? labelAsText ?? "") };
    });
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const used = new Set<string>();
    return entries.map(([key, val], index) => {
      let id = extractOptionLetter(key);
      if (!id || used.has(id)) {
        const fallback = positional(index);
        id = used.has(fallback) ? (id ?? fallback) : fallback;
      }
      used.add(id!);
      const text = typeof val === "string"
        ? val
        : val && typeof val === "object"
          ? String(pickField(val as Record<string, unknown>, ["text", "content", "value", "description"]) ?? "")
          : String(val ?? "");
      return { id: id!, text };
    });
  }
  return [];
}

export type RawAnswer = {
  kind?: unknown;
  optionId?: unknown;
  optionIds?: unknown;
  value?: unknown;
  tolerance?: unknown;
};

/**
 * Tolerant answer normalizer for messy model output.
 *
 * Handles "(A)", "Option B", numeric "1"(=A), "A;C", ["A","C"],
 * {answer:"C"} without kind, NAT ranges ("12.5-13.5"), and
 * missing/unknown answers. Returns null when the model gave no usable
 * answer so the caller can save a draft that needs review instead of
 * dropping the whole question. Pass the question `type` as a hint so a
 * kind-less answer ("C") still resolves correctly.
 */
export function normalizeAnswer(value: unknown, typeHint?: unknown): Record<string, unknown> | null | unknown {
  const hint = typeof typeHint === "string" ? normalizeType(typeHint) : undefined;
  const validHint = hint === "mcq" || hint === "msq" || hint === "nat" ? hint : undefined;

  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    if (validHint === "nat" || !validHint) {
      if (!validHint && Number.isInteger(value) && value >= 1 && value <= 4) {
        // Bare 1-4 with no hint is ambiguous; without context it reads as NAT.
        // Callers that know the question type pass a hint to disambiguate.
      }
      if (validHint === "nat" || !Number.isInteger(value) || value < 1 || value > 26) {
        return Number.isFinite(value) ? { kind: "nat", value, tolerance: 0 } : null;
      }
    }
    const letter = letterFromNumber(value);
    if (!letter) return null;
    return validHint === "msq" ? { kind: "msq", optionIds: [letter] } : { kind: "mcq", optionId: letter };
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || MISSING_TOKENS.has(trimmed.toUpperCase().replace(/[\s_-]+/g, ""))) return null;
    if (validHint === "nat") {
      const nat = coerceNat(trimmed, undefined);
      if (nat) return nat;
      const letters = extractOptionLetters(trimmed);
      if (letters.length === 0) return null;
      return letters.length === 1 ? { kind: "mcq", optionId: letters[0] } : { kind: "msq", optionIds: letters };
    }
    const letters = extractOptionLetters(trimmed);
    if (letters.length > 0) {
      if (letters.length === 1) {
        return validHint === "msq"
          ? { kind: "msq", optionIds: letters }
          : { kind: "mcq", optionId: letters[0] };
      }
      return { kind: "msq", optionIds: letters };
    }
    // Numeric answers without letters ("12.5", "12.5 - 13.5").
    const nat = coerceNat(trimmed, undefined);
    if (nat) {
      if (!validHint) return nat;
      // A bare small int for an MCQ/MSQ is almost surely an option index.
      if (Number.isInteger(nat.value)) {
        const letter = letterFromNumber(nat.value);
        if (letter && extractNumbers(trimmed).length === 1) {
          return validHint === "msq" ? { kind: "msq", optionIds: [letter] } : { kind: "mcq", optionId: letter };
        }
      }
      return nat;
    }
    return null;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    const letters = extractOptionLetters(value);
    if (letters.length > 0) {
      if (letters.length === 1) {
        return validHint === "msq"
          ? { kind: "msq", optionIds: letters }
          : { kind: "mcq", optionId: letters[0] };
      }
      return { kind: "msq", optionIds: letters };
    }
    if (validHint === "nat" || !validHint) {
      const numbers = value.flatMap((item) => extractNumbers(item));
      if (numbers.length > 0) return { kind: "nat", value: numbers[0], tolerance: 0 };
    } else {
      const numbers = value.flatMap((item) => (typeof item === "number" ? [item] : extractNumbers(item)));
      const lettersFromNumbers = numbers
        .map(letterFromNumber)
        .filter((letter): letter is string => letter !== null);
      if (lettersFromNumbers.length > 0) {
        const unique = [...new Set(lettersFromNumbers)];
        return unique.length === 1 && validHint !== "msq"
          ? { kind: "mcq", optionId: unique[0] }
          : { kind: "msq", optionIds: unique };
      }
    }
    return null;
  }
  if (typeof value !== "object") return value;

  const record = { ...(value as Record<string, unknown>) };
  let kind = normalizeKind(record.kind ?? record.type ?? record.answerType);
  const singleRaw = pickField(record, ["optionId", "option_id", "correctOption", "correct_option", "choice", "selectedOption", "selected_option", "selected", "correctChoice", "correct_choice", "answer"]);
  const pluralRaw = pickField(record, ["optionIds", "option_ids", "correctOptions", "correct_options", "answers", "choices", "selections", "correctChoices", "correct_choices", "options"]);
  const valueRaw = pickField(record, ["value", "natValue", "nat_value", "numericAnswer", "numeric_answer", "number", "result", "correctValue", "correct_value"]);
  const toleranceRaw = pickField(record, ["tolerance", "tol", "error", "range", "delta", "precision"]);

  if (!kind) {
    const pluralLetters = pluralRaw !== undefined ? extractOptionLetters(pluralRaw) : [];
    const singleLetters = singleRaw !== undefined ? extractOptionLetters(singleRaw) : [];
    if (pluralLetters.length > 1) kind = "msq";
    else if (valueRaw !== undefined && (typeof valueRaw === "number" || (typeof valueRaw === "string" && !/[A-Z]/i.test(valueRaw) && extractNumbers(valueRaw).length > 0))) kind = "nat";
    else if (singleLetters.length > 1) kind = "msq";
    else if (singleLetters.length === 1 || pluralLetters.length === 1) kind = validHint === "msq" ? "msq" : validHint === "nat" ? "nat" : "mcq";
    else kind = validHint;
  }
  if (!kind) return null;

  if (kind === "mcq") {
    const letters = extractOptionLetters(singleRaw ?? pluralRaw);
    if (letters.length === 0 && valueRaw !== undefined) {
      const fromValue = extractOptionLetters(valueRaw);
      if (fromValue.length === 1) return { kind: "mcq", optionId: fromValue[0] };
      if (fromValue.length > 1) return { kind: "msq", optionIds: fromValue };
    }
    if (letters.length === 1) return { kind: "mcq", optionId: letters[0] };
    if (letters.length > 1) return { kind: "msq", optionIds: letters };
    if (valueRaw !== undefined) {
      const nat = coerceNat(valueRaw, toleranceRaw);
      if (nat && validHint === "nat") return nat;
      if (nat && Number.isInteger(nat.value)) {
        const letter = letterFromNumber(nat.value);
        if (letter) return { kind: "mcq", optionId: letter };
      }
    }
    return null;
  }
  if (kind === "msq") {
    const letters = extractOptionLetters(pluralRaw ?? singleRaw);
    if (letters.length > 0) return { kind: "msq", optionIds: letters };
    if (valueRaw !== undefined) {
      const fromValue = extractOptionLetters(valueRaw);
      if (fromValue.length > 0) return { kind: "msq", optionIds: fromValue };
    }
    return null;
  }
  const nat = coerceNat(valueRaw ?? singleRaw ?? pluralRaw, toleranceRaw);
  return nat;
}

/** Question numbers like "Q12" or "12." resolve to 12; null/"" stay empty. */
export function normalizeQuestionNumber(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return value;
  if (typeof value === "number") return Number.isFinite(value) ? Math.trunc(value) : NaN;
  if (typeof value === "string") {
    if (value.trim() === "") return undefined;
    const direct = Number(value);
    if (Number.isFinite(direct)) return Math.trunc(direct);
    const extracted = extractNumberValue(value);
    return extracted === null ? NaN : Math.trunc(extracted);
  }
  return NaN;
}

/**
 * Confidence words, percents, and junk never fail an import: "high" -> 0.9,
 * 85 -> 0.85, unparseable -> null (unknown). Always returns null/undefined
 * or a finite number so the caller can clamp into 0..1.
 */
export function normalizeConfidence(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return value;
  const percent = (n: number) => (n > 1 && n <= 100 ? n / 100 : n);
  if (typeof value === "number") return Number.isFinite(value) ? percent(value) : null;
  if (typeof value === "string") {
    const text = value.trim().toLowerCase();
    if (text === "") return undefined;
    if (["high", "confident", "certain", "sure", "very high"].includes(text)) return 0.9;
    if (["medium", "moderate", "average", "medium confidence", "fair"].includes(text)) return 0.5;
    if (["low", "uncertain", "unsure", "guess", "guessed", "very low"].includes(text)) return 0.2;
    const parsed = extractNumberValue(text);
    return parsed === null ? null : percent(parsed);
  }
  return null;
}

/** Every referenced option id must exist in the question's own options. */
export function answerMatchesOptions(
  answer: { kind: string; optionId?: string; optionIds?: string[] },
  options: { id: string }[] | null,
): boolean {
  if (answer.kind === "nat") return true;
  if (!options || options.length === 0) return false;
  const ids = new Set(options.map((option) => option.id));
  if (answer.kind === "mcq") return typeof answer.optionId === "string" && ids.has(answer.optionId);
  if (answer.kind === "msq")
    return (
      Array.isArray(answer.optionIds) &&
      answer.optionIds.length > 0 &&
      answer.optionIds.every((id) => ids.has(id))
    );
  return false;
}

/** Normalized prompt text for duplicate detection. */
export function dedupeKey(prompt: string): string {
  return prompt.trim().toLowerCase().replace(/\s+/g, " ");
}
