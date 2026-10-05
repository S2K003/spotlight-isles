import {
  MANUAL_BAND_ACCURACY,
  MANUAL_DEFAULT_BAND,
  MP_BANDS,
  MP_MAX,
  MP_MIN,
  QUICK_DRAW_BONUS,
  QUICK_DRAW_MIN_ACCURACY,
  SCORE,
} from "@/config/balance";
import { CRITERIA } from "@/config/rubric";
import type { CriterionKey, Mod, Team, TeamId, TeamRoundResult, Tile } from "./types";

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Accuracy (0..1) → base movement points. 0% (or nobody answered) is Stage Fright: 0 MP. */
export function baseMp(accuracy: number): number {
  for (const band of MP_BANDS) if (accuracy >= band.min) return band.mp;
  return 0;
}

export function clampMp(mp: number): number {
  return Math.max(MP_MIN, Math.min(MP_MAX, mp));
}

export function applyMods(base: number, mods: Mod[]): number {
  return clampMp(base + mods.reduce((s, m) => s + m.delta, 0));
}

/** Used to break clashes: accuracy × 1000 − median speed in ms ÷ 100. */
export function roundScore(accuracy: number, medianMs: number | null): number {
  return accuracy * 1000 - (medianMs ?? 0) / 100;
}

export interface TeamAnswers {
  teamId: TeamId;
  /** Members connected during the phase (anyone who answered counts as connected). */
  members: number;
  /** Host-measured answer times of the members who answered correctly. */
  correctTimes: number[];
}

/**
 * Section 5.1. Accuracy is correct ÷ connected members, so a team of 1 is exactly as strong
 * as a team of 8. Quick Draw goes to the fastest team (lowest median) with ≥50% accuracy.
 */
export function scoreChallenge(inputs: TeamAnswers[], mods: Mod[][]): TeamRoundResult[] {
  const rows = inputs.map((inp) => {
    const correct = inp.correctTimes.length;
    const accuracy = inp.members > 0 ? Math.min(1, correct / inp.members) : 0;
    return { inp, correct, accuracy, medianMs: median(inp.correctTimes) };
  });

  let quick: TeamId | null = null;
  let best = Infinity;
  for (const r of rows) {
    if (r.accuracy >= QUICK_DRAW_MIN_ACCURACY && r.medianMs !== null && r.medianMs < best) {
      best = r.medianMs;
      quick = r.inp.teamId;
    }
  }

  return rows.map((r) => {
    const quickDraw = quick === r.inp.teamId;
    const base = baseMp(r.accuracy) + (quickDraw ? QUICK_DRAW_BONUS : 0);
    const teamMods = mods[r.inp.teamId] ?? [];
    return {
      teamId: r.inp.teamId,
      members: r.inp.members,
      correct: r.correct,
      accuracy: r.accuracy,
      medianMs: r.medianMs,
      baseMp: base,
      quickDraw,
      mods: teamMods,
      mp: applyMods(base, teamMods),
      roundScore: roundScore(r.accuracy, r.medianMs),
      stageFright: r.accuracy === 0,
    };
  });
}

/** Manual Mode: the facilitator clicks an accuracy band per team and (optionally) the Quick Draw team. */
export function scoreManual(bands: (number | null)[], quickDraw: TeamId | null, mods: Mod[][]): TeamRoundResult[] {
  return bands.map((b, i) => {
    const band = b ?? MANUAL_DEFAULT_BAND;
    const accuracy = MANUAL_BAND_ACCURACY[band];
    const isQuick = quickDraw === i && accuracy >= QUICK_DRAW_MIN_ACCURACY;
    const base = baseMp(accuracy) + (isQuick ? QUICK_DRAW_BONUS : 0);
    const teamMods = mods[i] ?? [];
    return {
      teamId: i as TeamId,
      members: 0,
      correct: 0,
      accuracy,
      medianMs: null,
      baseMp: base,
      quickDraw: isQuick,
      mods: teamMods,
      mp: applyMods(base, teamMods),
      roundScore: accuracy * 1000 + (isQuick ? 50 : 0),
      stageFright: accuracy === 0,
    };
  });
}

export interface TeamScore {
  teamId: TeamId;
  score: number;
  tiles: number;
  mastery: CriterionKey[];
  stage: boolean;
}

/**
 * Section 9. Score = owned tiles × 10 + 50 per region mastered + 100 for the Keynote Stage.
 * A region is mastered by the team with strictly the most tiles in it, with at least 5.
 * The Stage tile itself is worth its 100 bonus and is not also counted as a ×10 tile.
 */
export function teamScores(tiles: Tile[], teams: Pick<Team, "id">[], stageOwner: TeamId | null): TeamScore[] {
  const owned = teams.map(() => 0);
  const perRegion: Record<string, number[]> = {};
  for (const c of CRITERIA) perRegion[c] = teams.map(() => 0);

  for (const t of tiles) {
    if (t.owner === undefined || t.type === "stage") continue;
    owned[t.owner]++;
    if (t.region !== "plaza") perRegion[t.region][t.owner]++;
  }

  const mastery: CriterionKey[][] = teams.map(() => []);
  for (const c of CRITERIA) {
    const counts = perRegion[c];
    const max = Math.max(...counts);
    if (max < SCORE.masteryMinTiles) continue;
    const leaders = counts.map((n, i) => (n === max ? i : -1)).filter((i) => i >= 0);
    if (leaders.length === 1) mastery[leaders[0]].push(c);
  }

  return teams.map((team, i) => {
    const stage = stageOwner === team.id;
    return {
      teamId: team.id,
      tiles: owned[i],
      mastery: mastery[i],
      stage,
      score: owned[i] * SCORE.tile + mastery[i].length * SCORE.mastery + (stage ? SCORE.stage : 0),
    };
  });
}

/** Rank rows by score (ties share a rank; order within a tie is by tiles, then team id). */
export function rankTeams(scores: TeamScore[]): (TeamScore & { rank: number })[] {
  const sorted = scores.slice().sort((a, b) => b.score - a.score || b.tiles - a.tiles || a.teamId - b.teamId);
  let rank = 0;
  let prev = NaN;
  return sorted.map((s, i) => {
    if (s.score !== prev) {
      rank = i + 1;
      prev = s.score;
    }
    return { ...s, rank };
  });
}
