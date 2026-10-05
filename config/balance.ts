import type { CardId } from "@/lib/engine/types";

export const MAP_RADIUS = 6;

/** Tile shares of the whole 127-hex map. */
export const TILE_SHARE = { water: 0.12, fog: 0.08, swamp: 0.05 };

export const CHESTS_AT_START = 6;
export const CHEST_RESPAWN_COUNT = 3;
export const CHEST_RESPAWN_EVERY_ROUNDS = 3;

export const TILE_COST = { land: 1, plaza: 1, swamp: 1, fog: 2 } as const;

/** Accuracy → movement points. */
export const MP_BANDS = [
  { min: 0.8, mp: 3 },
  { min: 0.5, mp: 2 },
  { min: 0.000001, mp: 1 },
];
export const QUICK_DRAW_MIN_ACCURACY = 0.5;
export const QUICK_DRAW_BONUS = 1;
export const MP_MIN = 0;
export const MP_MAX = 5;

/** Representative accuracy for each Manual Mode band (0%, 1–49, 50–79, 80+). */
export const MANUAL_BAND_ACCURACY = [0, 0.3, 0.65, 0.9];
export const MANUAL_DEFAULT_BAND = 2;

export const SPOTLIGHT_MP = [
  { min: 4.2, mp: 4 },
  { min: 3.5, mp: 3 },
  { min: 2.5, mp: 2 },
];
export const SPOTLIGHT_MIN_MP = 1;
export const SPOTLIGHT_AUDIENCE_MP = 2;
export const FAIR_JUDGE_BONUS = 1;
export const FAIR_JUDGE_TOLERANCE = 0.5;
export const SPOTLIGHT_TRIM_MIN_TEAMS = 5;

export const MAX_CARDS = 2;
export const CARD_ODDS: { card: CardId; weight: number }[] = [
  { card: "hook", weight: 3 },
  { card: "rehearsed", weight: 2 },
  { card: "heckler", weight: 2 },
  { card: "micdrop", weight: 2 },
];

export const CARD_INFO: Record<CardId, { name: string; icon: string; text: string }> = {
  hook: { name: "Strong Hook", icon: "🪝", text: "+1 MP next round" },
  rehearsed: { name: "Rehearsed", icon: "🛡️", text: "Your tiles can't be stolen this round" },
  heckler: { name: "Heckler", icon: "📢", text: "Score leader gets −1 MP next round" },
  micdrop: { name: "Mic Drop", icon: "🎤", text: "Claim all 6 tiles around where you land" },
};

export const CLASH_MAX_ITERATIONS = 10;

export const SCORE = { tile: 10, mastery: 50, stage: 100, masteryMinTiles: 5 };

export const FINAL = { questions: 3, passAccuracy: 0.5, claim: 2, claimComeback: 3, comebackTeams: 3 };

export const TOTAL_ROUNDS = 12;
