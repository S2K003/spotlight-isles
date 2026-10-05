import { AUDIENCE_STEPS, MANUAL_BAND_ACCURACY, MANUAL_DEFAULT_BAND, MAX_STEPS, MIN_STEPS, PITCH_BANDS, POINTS, STEP_BANDS, TAILWIND_STEPS } from "@/config/balance";
import type { Team, TeamId, TeamRoundResult } from "./types";

/** Team accuracy (0..1) on a question → steps. Even a wrong answer moves 1: nobody is left behind. */
export function stepsFromAccuracy(accuracy: number): number {
  for (const band of STEP_BANDS) if (accuracy >= band.min) return band.steps;
  return MIN_STEPS;
}

/** Points for a question: 10 per step earned, but nothing for getting it completely wrong. */
export function pointsFromAccuracy(accuracy: number): number {
  return accuracy > 0 ? stepsFromAccuracy(accuracy) * POINTS.perStep : 0;
}

/** Pitch star average (1–5) → steps for the speaking team. Speaking always earns at least 1. */
export function stepsFromPitch(overall: number): number {
  for (const band of PITCH_BANDS) if (overall >= band.min) return band.steps;
  return MIN_STEPS;
}

export function audienceSteps(rated: boolean, fair: boolean): number {
  return fair ? AUDIENCE_STEPS.fair : rated ? AUDIENCE_STEPS.rated : AUDIENCE_STEPS.none;
}

export interface TeamAnswers {
  teamId: TeamId;
  /** Members connected during the phase (anyone who answered counts as connected). */
  members: number;
  correct: number;
}

/**
 * Question round. Accuracy is correct ÷ connected members, so a team of 1 is exactly as strong
 * as a team of 8. There is no speed bonus: teams are meant to talk it through.
 */
export function scoreQuestion(inputs: TeamAnswers[]): TeamRoundResult[] {
  return inputs.map((inp) => {
    const accuracy = inp.members > 0 ? Math.min(1, inp.correct / inp.members) : 0;
    return {
      teamId: inp.teamId,
      members: inp.members,
      correct: inp.correct,
      accuracy,
      steps: stepsFromAccuracy(accuracy),
      points: pointsFromAccuracy(accuracy),
      tailwind: false,
    };
  });
}

/** Manual Mode: the facilitator clicks an accuracy band per team after a show of hands. */
export function scoreManual(bands: (number | null)[]): TeamRoundResult[] {
  return bands.map((b, i) => {
    const accuracy = MANUAL_BAND_ACCURACY[b ?? MANUAL_DEFAULT_BAND];
    return { teamId: i as TeamId, members: 0, correct: 0, accuracy, steps: stepsFromAccuracy(accuracy), points: pointsFromAccuracy(accuracy), tailwind: false };
  });
}

/**
 * After a round's points are known: docked ships don't move, and the team (or tied teams) in last
 * place among those still flying gets a tailwind of +1 step, unless everyone is level.
 * `scores` are the totals AFTER this round's points.
 */
export function applyTailwind(results: TeamRoundResult[], teams: Pick<Team, "id" | "docked">[], scores: number[]): TeamRoundResult[] {
  const flying = teams.filter((t) => t.docked === null).map((t) => t.id);
  const low = Math.min(...flying.map((id) => scores[id]));
  const high = Math.max(...teams.map((t) => scores[t.id]));
  return results.map((r) => {
    if (teams[r.teamId].docked !== null) return { ...r, steps: 0, tailwind: false };
    const tailwind = flying.length > 0 && scores[r.teamId] === low && low < high;
    return { ...r, tailwind, steps: Math.min(MAX_STEPS, r.steps + (tailwind ? TAILWIND_STEPS : 0)) };
  });
}

/**
 * Move order: the team with the most points moves first. Ties are broken by a seeded draw.
 * Docked ships are listed last (they don't move).
 */
export function moveOrder(teams: Pick<Team, "id" | "score" | "docked">[], rng: () => number): TeamId[] {
  const draw = teams.map(() => rng());
  return teams
    .slice()
    .sort((a, b) => Number(a.docked !== null) - Number(b.docked !== null) || b.score - a.score || draw[a.id] - draw[b.id])
    .map((t) => t.id);
}

/** Final ranking by score (ties share a rank; earlier arrival at the Stage, then team id, orders a tie). */
export function rankTeams<T extends Pick<Team, "id" | "score" | "docked">>(teams: T[]): (T & { rank: number })[] {
  const sorted = teams.slice().sort((a, b) => b.score - a.score || (a.docked ?? 99) - (b.docked ?? 99) || a.id - b.id);
  let rank = 0;
  let prev = NaN;
  return sorted.map((t, i) => {
    if (t.score !== prev) {
      rank = i + 1;
      prev = t.score;
    }
    return { ...t, rank };
  });
}
