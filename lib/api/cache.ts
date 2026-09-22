/** Tiny per-instance TTL cache for global (non-user) aggregates. */

type Entry = { expires: number; value: unknown };

const store = new Map<string, Entry>();

export async function cached<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await compute();
  // Bound memory: evict expired entries on write, cap size.
  for (const [k, e] of store) if (e.expires <= Date.now()) store.delete(k);
  if (store.size > 200) store.delete(store.keys().next().value!);
  store.set(key, { expires: Date.now() + ttlMs, value });
  return value;
}

export function invalidate(prefix: string): void {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
