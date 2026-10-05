import type { Hex } from "@/lib/engine/types";

/** Shared projection for the Pixi map and the phone's SVG mini-map: flat-top hexes, squashed vertically for a pseudo-3D look. */
export const HEX_SIZE = 46;
export const SQUASH = 0.64;

export function hexCenter(h: Hex, size = HEX_SIZE, squash = SQUASH): { x: number; y: number } {
  return { x: size * 1.5 * h.q, y: size * Math.sqrt(3) * (h.r + h.q / 2) * squash };
}

/** The six corners of a flat-top hex around (0,0). Index 0 is the right corner, going clockwise on screen. */
export function hexCorners(size = HEX_SIZE, squash = SQUASH): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i;
    out.push({ x: size * Math.cos(a), y: size * Math.sin(a) * squash });
  }
  return out;
}

export function hexPoints(cx: number, cy: number, size = HEX_SIZE, squash = SQUASH): string {
  return hexCorners(size, squash)
    .map((c) => `${(cx + c.x).toFixed(1)},${(cy + c.y).toFixed(1)}`)
    .join(" ");
}

/* ---------- colour helpers (0xRRGGBB numbers) ---------- */

export function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

export const lighten = (c: number, t: number): number => mix(c, 0xffffff, t);
export const darken = (c: number, t: number): number => mix(c, 0x000000, t);

/** Deterministic 0..1 hash of two numbers, for per-tile variation that is identical on every client. */
export function hash2(x: number, y: number): number {
  let h = (Math.imul(Math.round(x * 10) | 0, 374761393) + Math.imul(Math.round(y * 10) | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
