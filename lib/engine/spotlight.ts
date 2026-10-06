import { SPOTLIGHT_TRIM_MIN_TEAMS } from "@/config/balance";
import type { Rating, SpeakerResult } from "./types";

const mean = (xs: number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;
export const ratingOverall = (r: Rating): number => (r.hook + r.clarity + r.confidence) / 3;

export function clampStars(n: number): number {
  return Math.max(1, Math.min(5, Math.round(Number(n) || 0)));
}

/**
 * Ratings are first averaged per rating team (so a big team has no more say than a small one).
 * When 5 or more teams rated, the teams with the highest and lowest overall average are dropped
 * before the room averages are taken.
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
  return { hook, clarity, confidence, overall: (hook + clarity + confidence) / 3, teamAverages, raterTeams: rows.length, trimmed };
}

/** Did this team rate at least one of the pitches? */
export function didRate(results: SpeakerResult[], teamId: number): boolean {
  return results.some((r) => r.teamAverages[teamId] !== undefined);
}

