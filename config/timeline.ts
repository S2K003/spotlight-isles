import type { CriterionKey, TeamId } from "@/lib/engine/types";

/** All durations in seconds. The engine builds the phase list from this file; a test asserts the total is 900. */
export const DUR = {
  intro: 40,
  challenge: 20,
  reveal: 6,
  vote: 12,
  resolve: 8,
  spotReady: 5,
  spotSpeak: 20,
  spotRate: 8,
  spotReveal: 6,
  finalBanner: 5,
  finalQ: 12,
  finalReveal: 5,
  finalFlood: 19,
  results: 60,
  debrief: 50,
} as const;

export type RoundDef =
  | { kind: "standard"; criterion: CriterionKey | "random" }
  | { kind: "spotlight"; teams: [TeamId, TeamId] };

export const ROUNDS: RoundDef[] = [
  { kind: "standard", criterion: "structure" },
  { kind: "standard", criterion: "visuals" },
  { kind: "spotlight", teams: [0, 1] },
  { kind: "standard", criterion: "delivery" },
  { kind: "standard", criterion: "engagement" },
  { kind: "spotlight", teams: [2, 3] },
  { kind: "standard", criterion: "timing" },
  { kind: "standard", criterion: "qa" },
  { kind: "spotlight", teams: [4, 5] },
  { kind: "standard", criterion: "random" },
  { kind: "standard", criterion: "random" },
  { kind: "standard", criterion: "random" },
];

export const FINAL_QUESTIONS = 3;
export const TOTAL_MS = 900_000;
