import type { Hex } from "./types";

/**
 * Axial coordinates, flat-top layout. DIRS is the fixed neighbour order used everywhere
 * (pathfinding tie-breaks depend on it). DIRS[i] * radius is corner i of the map.
 */
export const DIRS: Hex[] = [
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
];

export const key = (h: Hex): string => `${h.q},${h.r}`;

export function parseKey(k: string): Hex {
  const [q, r] = k.split(",").map(Number);
  return { q, r };
}

export const add = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });
export const scale = (a: Hex, k: number): Hex => ({ q: a.q * k, r: a.r * k });
export const same = (a: Hex, b: Hex): boolean => a.q === b.q && a.r === b.r;

export function distance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export const ORIGIN: Hex = { q: 0, r: 0 };
export const ring = (h: Hex): number => distance(h, ORIGIN);

export function neighbors(h: Hex): Hex[] {
  return DIRS.map((d) => add(h, d));
}

/** All hexes within `radius` of the origin, in a stable order. */
export function hexDisk(radius: number): Hex[] {
  const out: Hex[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
      out.push({ q, r });
    }
  }
  return out;
}

export function corners(radius: number): Hex[] {
  return DIRS.map((d) => scale(d, radius));
}

/** Flat-top axial → unit pixel coordinates (hex size 1). */
export function hexToUnit(h: Hex): { x: number; y: number } {
  return { x: 1.5 * h.q, y: Math.sqrt(3) * (h.r + h.q / 2) };
}

/**
 * Which of the six 60° wedges a hex falls in. Wedge i is centred on corner i (DIRS[i]).
 * Hexes exactly on a boundary go to the next wedge, which keeps the split rotationally symmetric.
 */
export function wedgeOf(h: Hex): number {
  const { x, y } = hexToUnit(h);
  let deg = (Math.atan2(y, x) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return Math.floor((deg + 1e-6) / 60) % 6;
}
