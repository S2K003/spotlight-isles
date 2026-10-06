import { RUBRIC } from "@/config/rubric";
import type { CriterionKey, Tile } from "@/lib/engine/types";

/** Tile colours shared by the Pixi map and the phone's SVG mini-map (no Pixi import here). */
export function tileColors(tile: Pick<Tile, "type" | "region">): { top: number; side: number; accent: number } {
  if (tile.type === "stage") return { top: 0xffe7a3, side: 0xb8862b, accent: 0xfff6d0 };
  if (tile.type === "plaza") return { top: 0xe4dccf, side: 0xa59b90, accent: 0xffffff };
  const r = RUBRIC[tile.region as CriterionKey];
  if (tile.type === "water") return { top: 0x2f8fdf, side: 0x1b5fa0, accent: 0xbfe9ff };
  return { top: r.tile, side: r.side, accent: r.accent };
}

export const toCss = (n: number): string => `#${n.toString(16).padStart(6, "0")}`;
