import {
  FAIR_JUDGE_TOLERANCE,
  SPOTLIGHT_MIN_MP,
  SPOTLIGHT_MP,
  SPOTLIGHT_TRIM_MIN_TEAMS,
} from "@/config/balance";
import type { Rating, SpeakerResult } from "./types";

const mean = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;
export const ratingOverall = (r: Rating): number => (r.hook + r.clarity + r.confidence) / 3;

export function clampStars(n: number): number {
  return Math.max(1, Math.min(5, Math.round(Number(n) || 0)));
}

/**
 * Section 6. Ratings are first averaged per rating team (so a big team has no more say than a
 * small one). When 5 or more teams rated, the teams with the highest and lowest overall average
 * are dropped before the room averages are taken.
 */
export function speakerResult(ratingsByTeam: Record<number, Rating[]>): SpeakerResult {
  const rows = Object.keys(ratingsByTeam)
    .map(Number)
    .filter((t) => ratingsByTeam[t].length > 0)
    .sort((a, b) => a - b)
    .map((teamId) => {
      const rs = ratingsByTeam[teamId];
      const hook = mean(rs.map((r) => r.hook));
      const clarity = mean(rs.map((r) => r.clarity));
      const confidence = mean(rs.map((r) => r.confidence));
      return { teamId, hook, clarity, confidence, overall: (hook + clarity + confidence) / 3 };
    });

  const teamAverages: Record<number, number> = {};
  for (const r of rows) teamAverages[r.teamId] = r.overall;

  if (!rows.length) {
    return { hook: null, clarity: null, confidence: null, overall: null, teamAverages, raterTeams: 0, trimmed: false };
  }

  let kept = rows;
  const trimmed = rows.length >= SPOTLIGHT_TRIM_MIN_TEAMS;
  if (trimmed) {
    const sorted = rows.slice().sort((a, b) => a.overall - b.overall || a.teamId - b.teamId);
    kept = sorted.slice(1, -1);
  }
  const hook = mean(kept.map((r) => r.hook));
  const clarity = mean(kept.map((r) => r.clarity));
  const confidence = mean(kept.map((r) => r.confidence));
  return {
    hook,
    clarity,
    confidence,
    overall: (hook + clarity + confidence) / 3,
    teamAverages,
    raterTeams: rows.length,
    trimmed,
  };
}

/** Speaking always earns at least 1 MP: courage is rewarded. */
export function mpFromSpotlight(overall: number): number {
  for (const band of SPOTLIGHT_MP) if (overall >= band.min) return band.mp;
  return SPOTLIGHT_MIN_MP;
}

/**
 * Fair Judge: the team's average rating was within 0.5 of the room average for every speaker it
 * was allowed to rate (both speakers, for a non-speaking team), and it rated all of them.
 */
export function isFairJudge(results: SpeakerResult[], teamId: number): boolean {
  const rated = results.filter((r) => r.overall !== null);
  if (!rated.length) return false;
  return rated.every((r) => {
    const mine = r.teamAverages[teamId];
    return mine !== undefined && Math.abs(mine - (r.overall as number)) <= FAIR_JUDGE_TOLERANCE + 1e-9;
  });
}

export function judgeDeviation(results: SpeakerResult[], teamId: number): number {
  const devs = results
    .filter((r) => r.overall !== null && r.teamAverages[teamId] !== undefined)
    .map((r) => Math.abs(r.teamAverages[teamId] - (r.overall as number)));
  return devs.length ? mean(devs) : 5;
}
