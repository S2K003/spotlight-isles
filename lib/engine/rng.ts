export type Rng = () => number;

/** mulberry32: small, fast, deterministic PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash of a string to a 32-bit unsigned int. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A fresh RNG derived from the game seed and a label. Deriving streams by label (instead of
 * advancing one shared stream) keeps every draw reproducible after a host reload.
 */
export function rngFor(seed: number, label: string): Rng {
  return mulberry32((seed ^ hashString(label)) >>> 0);
}

export function randInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n);
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[randInt(rng, items.length)];
}

export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function weightedPick<T>(rng: Rng, items: readonly { weight: number; value: T }[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let x = rng() * total;
  for (const item of items) {
    x -= item.weight;
    if (x < 0) return item.value;
  }
  return items[items.length - 1].value;
}

const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O

export function makeRoomCode(rng: Rng = Math.random): string {
  let s = "";
  for (let i = 0; i < 4; i++) s += CODE_LETTERS[Math.floor(rng() * CODE_LETTERS.length)];
  return s;
}

export function normalizeRoomCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/0/g, "Q")
    .replace(/[^A-Z]/g, "")
    .slice(0, 4);
}
