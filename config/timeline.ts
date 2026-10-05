import type { TeamId } from "@/lib/engine/types";

/**
 * All durations in seconds. The engine builds the phase list from this file; a test asserts the
 * total is exactly 900 (15:00). The phases are deliberately long: this game is mostly talking.
 */
export const DUR = {
  intro: 40,
  /** Team discusses the question and everyone taps the team's answer. */
  challenge: 45,
  reveal: 10,
  /** Team agrees where to fly. */
  vote: 35,
  /** Ships move one at a time, highest score first. */
  resolve: 14,
  /** Both pitching teams choose a speaker and plan their pitch. */
  spotReady: 30,
  spotSpeak: 25,
  spotRate: 12,
  spotReveal: 8,
  results: 35,
  debrief: 30,
} as const;

export type RoundDef = { kind: "question" } | { kind: "spotlight"; teams: [TeamId, TeamId] };

/** Six rounds: question, pitch, question, pitch, question, pitch. Every team pitches exactly once. */
export const ROUNDS: RoundDef[] = [
  { kind: "question" },
  { kind: "spotlight", teams: [0, 1] },
  { kind: "question" },
  { kind: "spotlight", teams: [2, 3] },
  { kind: "question" },
  { kind: "spotlight", teams: [4, 5] },
];

export const TOTAL_MS = 900_000;
