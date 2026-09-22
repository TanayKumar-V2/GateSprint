import { rankQuestions, type RankableQuestion } from "./recommend-rules";
import { clampInt } from "./time";

export const FULL_MOCK_QUESTIONS = 65;
export const FULL_MOCK_SECONDS = 10800;
export const FULL_MOCK_MARKS = 100;
export const BUILDER_MIN_QUESTIONS = 5;
export const BUILDER_MAX_QUESTIONS = 50;
export const MIN_DURATION_SECONDS = 300;
export const MAX_DURATION_SECONDS = 10800;
const PER_QUESTION_SECONDS = FULL_MOCK_SECONDS / FULL_MOCK_QUESTIONS;

/** Deterministic string hash for shuffle seeds. */
export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32 PRNG — deterministic per seed, no Math.random in sampling. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(list: T[], seed: number): T[] {
  const out = [...list];
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export type PoolQuestion = RankableQuestion & { id: string };

/**
 * Pick `count` questions: exclude recently-used ids when the pool allows,
 * seeded-shuffle for variety, then rank easy->hard for the paper order.
 * Returns null when the pool is too small (caller maps to 422 + count).
 */
export function sampleQuestions<T extends PoolQuestion>(
  pool: T[],
  count: number,
  opts: { excludeIds?: Set<string>; seed?: number } = {},
): T[] | null {
  const exclude = opts.excludeIds ?? new Set<string>();
  const fresh = pool.filter((q) => !exclude.has(q.id));
  const source = fresh.length >= count ? fresh : pool;
  if (source.length < count) return null;
  const shuffled = seededShuffle(source, opts.seed ?? 1);
  return rankQuestions(shuffled.slice(0, count));
}

/**
 * Default pace: 2 min per MCQ, 3 min per MSQ/NAT. Clamped to 5min..3h so an
 * absurd mix never produces an unusable paper ("invalid time clamped").
 * Falls back to ~2.5 min/Q when the mix is unknown.
 */
export function suggestTime(
  totalQuestions: number,
  mix: { mcq: number; msq: number; nat: number },
): number {
  const known = mix.mcq + mix.msq + mix.nat;
  const seconds =
    known > 0 ? mix.mcq * 120 + (mix.msq + mix.nat) * 180 : totalQuestions * 150;
  return clampInt(seconds, MIN_DURATION_SECONDS, MAX_DURATION_SECONDS);
}

/** Scale a full-length duration down to a capped paper, same per-Q pace. */
export function scaleDuration(questionCount: number): number {
  return clampInt(
    Math.round(questionCount * PER_QUESTION_SECONDS),
    MIN_DURATION_SECONDS,
    MAX_DURATION_SECONDS,
  );
}
