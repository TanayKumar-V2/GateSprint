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

export type RawOption = { id?: unknown; text?: unknown };

/** Accept [{id, text}] or {"A": "..."} record shapes. */
export function normalizeOptions(value: unknown): { id: string; text: string }[] | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value.map((item) => {
      const row = (item ?? {}) as Record<string, unknown>;
      return { id: String(row.id ?? "").trim().toUpperCase(), text: String(row.text ?? "") };
    });
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).map(([id, text]) => ({
      id: id.trim().toUpperCase(),
      text: String(text ?? ""),
    }));
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

/** Accept "A,C" strings for MSQ and default a missing NAT tolerance to 0. */
export function normalizeAnswer(value: unknown): Record<string, unknown> | unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const answer = { ...(value as Record<string, unknown>) };
  if (typeof answer.kind === "string") answer.kind = answer.kind.trim().toLowerCase();
  if (typeof answer.optionId === "string") answer.optionId = answer.optionId.trim().toUpperCase();
  if (typeof answer.optionIds === "string") {
    answer.optionIds = (answer.optionIds as string)
      .split(",")
      .map((part) => part.trim().toUpperCase())
      .filter(Boolean);
  } else if (Array.isArray(answer.optionIds)) {
    answer.optionIds = (answer.optionIds as unknown[]).map((part) =>
      String(part ?? "").trim().toUpperCase(),
    );
  }
  if (answer.kind === "nat") {
    const coerced = toNumber(answer.value);
    if (coerced !== undefined) answer.value = coerced;
    const tolerance = toNumber(answer.tolerance);
    answer.tolerance = tolerance === null || tolerance === undefined ? 0 : tolerance;
  }
  return answer;
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
