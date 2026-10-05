import { RUBRIC } from "@/config/rubric";
import type { CriterionKey, Tile } from "@/lib/engine/types";
import { mix } from "./layout";

/** Tile colours shared by the Pixi map and the phone's SVG mini-map (no Pixi import here). */
export function tileColors(tile: Pick<Tile, "type" | "region">): { top: number; side: number; accent: number } {
  if (tile.type === "stage") return { top: 0xffe7a3, side: 0xb8862b, accent: 0xfff6d0 };
  if (tile.type === "plaza") return { top: 0xe4dccf, side: 0xa59b90, accent: 0xffffff };
  const r = RUBRIC[tile.region as CriterionKey];
  if (tile.type === "water") return { top: 0x2f8fdf, side: 0x1b5fa0, accent: 0xbfe9ff };
  if (tile.type === "fog") return { top: mix(r.tile, 0xb9bfca, 0.55), side: mix(r.side, 0x6f7684, 0.5), accent: 0xe8ecf2 };
  return { top: r.tile, side: r.side, accent: r.accent };
}

export const toCss = (n: number): string => `#${n.toString(16).padStart(6, "0")}`;
