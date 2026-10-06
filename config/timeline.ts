/**
 * All durations in seconds. The engine builds the phase list from this file; a test asserts the
 * total is exactly 900 (15:00). Most of the time goes to talking and pitching; choosing a move is
 * quick because the game suggests one.
 */
export const DUR = {
  intro: 40,
  /** Team discusses the question and everyone taps the team's answer. */
  challenge: 45,
  reveal: 10,
  /** Team confirms (or changes) the suggested move. */
  vote: 15,
  /** Ships move one at a time, highest score first. */
  resolve: 10,
  /** The spin picks two teams; both get their topic, choose a speaker and plan. */
  spotReady: 48,
  spotSpeak: 40,
  spotRate: 12,
  spotReveal: 8,
  results: 35,
  debrief: 30,
} as const;

export type RoundKind = "question" | "spotlight";

/** Six rounds: question, pitch, question, pitch, question, pitch. Two teams pitch in each pitch round, so every team pitches exactly once. */
export const ROUNDS: RoundKind[] = ["question", "spotlight", "question", "spotlight", "question", "spotlight"];

export const TOTAL_MS = 900_000;
