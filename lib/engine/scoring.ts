import { GOOD_STEPS, GREAT_STEPS, MIN_STEPS, PITCH_GOOD, PITCH_GREAT, POINTS, QUESTION_PASS } from "@/config/balance";
import type { Team, TeamId, TeamRoundResult } from "./types";

/** Question: if at least half the team chose the best answer, 3 steps; otherwise 2. Nobody is ever stuck. */
export function stepsFromAccuracy(accuracy: number): number {
  return accuracy >= QUESTION_PASS ? GOOD_STEPS : MIN_STEPS;
}

/** Pitch star average (1–5) → steps for the pitching team: great 4, good 3, otherwise 2. */
export function stepsFromPitch(overall: number): number {
  return overall >= PITCH_GREAT ? GREAT_STEPS : overall >= PITCH_GOOD ? GOOD_STEPS : MIN_STEPS;
}

/**
 * In a pitch round the audience groups move the standard distance, and earn bonus points for
 * marking the pitches. (If marking also gave extra steps, every group would arrive together.)
 */
export function audienceResult(rated: boolean): { steps: number; points: number } {
  return { steps: MIN_STEPS, points: MIN_STEPS * POINTS.perStep + (rated ? POINTS.mark : 0) };
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
    const steps = stepsFromAccuracy(accuracy);
    return { teamId: inp.teamId, members: inp.members, correct: inp.correct, accuracy, steps, points: steps * POINTS.perStep };
  });
}

/** Manual Mode: after a show of hands the facilitator clicks whether each team got it. Unset counts as yes. */
export function scoreManual(pass: (boolean | null)[]): TeamRoundResult[] {
  return pass.map((p, i) => {
    const ok = p ?? true;
    const steps = ok ? GOOD_STEPS : MIN_STEPS;
    return { teamId: i as TeamId, members: 0, correct: 0, accuracy: ok ? 1 : 0, steps, points: steps * POINTS.perStep };
  });
}

/** Ships already at the Stage don't move. */
export function groundDocked(results: TeamRoundResult[], teams: Pick<Team, "id" | "docked">[]): TeamRoundResult[] {
  return results.map((r) => (teams[r.teamId].docked !== null ? { ...r, steps: 0 } : r));
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
