import type { TeamId } from "@/lib/engine/types";

export interface TeamDef {
  id: TeamId;
  name: string;
  /** CSS colour. Each team also has a unique emblem shape so identity never relies on colour alone. */
  color: string;
  /** A lighter tint of the team colour for text on the dark UI (the ship colours themselves can be dark). */
  text: string;
  emblem: string;
  shape: "star" | "bolt" | "wave" | "triangle" | "circle" | "diamond";
  emoji: string;
}

/**
 * The six colours were chosen by searching candidate palettes for the largest minimum pairwise
 * difference under simulated protanopia, deuteranopia and tritanopia (see tests/colors.test.ts,
 * which fails if a change brings any pair too close). They differ in lightness as well as hue,
 * and the emblem shape is the primary identifier on ships, tiles and the scoreboard.
 */
export const TEAM_DEFS: TeamDef[] = [
  { id: 0, name: "Group 1", color: "#FFC21A", text: "#FFC21A", emblem: "★", shape: "star", emoji: "☄️" },
  { id: 1, name: "Group 2", color: "#8B5CF6", text: "#B9A2FF", emblem: "⚡", shape: "bolt", emoji: "⚡" },
  { id: 2, name: "Group 3", color: "#00E5FF", text: "#00E5FF", emblem: "〰", shape: "wave", emoji: "🌊" },
  { id: 3, name: "Group 4", color: "#DC2626", text: "#FF7070", emblem: "▲", shape: "triangle", emoji: "🔥" },
  { id: 4, name: "Group 5", color: "#0F766E", text: "#3DD6B0", emblem: "●", shape: "circle", emoji: "🌿" },
  { id: 5, name: "Group 6", color: "#F472B6", text: "#F9A8D4", emblem: "◆", shape: "diamond", emoji: "💎" },
];

export const TEAM_IDS: TeamId[] = [0, 1, 2, 3, 4, 5];

export function cssToNum(css: string): number {
  return parseInt(css.replace("#", ""), 16);
}
