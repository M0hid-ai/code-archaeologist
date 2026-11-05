/** Small numeric helpers. */

export function sum(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Increment a counter stored in a Map. */
export function bump<K>(map: Map<K, number>, key: K, by = 1): void {
  map.set(key, (map.get(key) ?? 0) + by);
}

/** Top `n` entries of a counter map, highest first. */
export function top<K>(map: Map<K, number>, n: number): [K, number][] {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

/** Deterministic 32-bit FNV-1a hash, handy for seeded choices and colours. */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Pick an element deterministically from `xs` using `seed`. */
export function pick<T>(xs: readonly T[], seed: string): T {
  return xs[hash32(seed) % xs.length];
}

/** Downsample a series to at most `n` points by summing buckets. */
export function downsample(xs: number[], n: number): number[] {
  if (xs.length <= n) return xs.slice();
  const out = new Array<number>(n).fill(0);
  for (let i = 0; i < xs.length; i++) out[Math.floor((i * n) / xs.length)] += xs[i];
  return out;
}

export function round(x: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}
