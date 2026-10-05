import { FINAL } from "@/config/balance";
import { key, neighbors, ORIGIN, distance } from "./hex";
import { homesOf, indexTiles } from "./pathfinding";
import type { Rng } from "./rng";
import type { FinalClaim, FinalQResult, Team, TeamId, Tile } from "./types";

/** The comeback boost goes to the bottom three teams on score when the showdown begins. */
export function bottomTeams(teams: Pick<Team, "id" | "score">[]): TeamId[] {
  return teams
    .slice()
    .sort((a, b) => a.score - b.score || b.id - a.id)
    .slice(0, FINAL.comebackTeams)
    .map((t) => t.id);
}

/**
 * Section 8. For each question a team passed (≥50% correct) it claims 2 tiles, or 3 if it is in
 * the bottom three. Each claimed tile is unowned or an enemy tile next to the team's territory,
 * closest to the Keynote Stage first. Within a wave the lowest-scoring team picks first.
 */
export function finalClaims(
  tilesIn: Tile[],
  teams: Pick<Team, "id" | "score" | "home">[],
  perQ: FinalQResult[],
  bottom3: TeamId[],
): { claims: FinalClaim[]; tiles: Tile[] } {
  const tiles: Tile[] = JSON.parse(JSON.stringify(tilesIn));
  const index = indexTiles(tiles);
  const homes = homesOf(teams);
  const claims: FinalClaim[] = [];
  const order = teams.slice().sort((a, b) => a.score - b.score || a.id - b.id);

  const nextTile = (teamId: TeamId): Tile | null => {
    let best: Tile | null = null;
    let bestD = Infinity;
    for (const t of tiles) {
      if (t.owner !== teamId) continue;
      for (const nb of neighbors(t)) {
        const cand = index[key(nb)];
        if (!cand || cand.owner === teamId) continue;
        if (cand.type === "water" || cand.type === "stage") continue;
        if (homes[key(cand)] !== undefined) continue;
        const d = distance(cand, ORIGIN);
        if (d < bestD || (d === bestD && best && (cand.q < best.q || (cand.q === best.q && cand.r < best.r)))) {
          best = cand;
          bestD = d;
        }
      }
    }
    return best;
  };

  perQ.forEach((q, wave) => {
    for (const team of order) {
      if (!q.passed[team.id]) continue;
      const count = bottom3.includes(team.id) ? FINAL.claimComeback : FINAL.claim;
      for (let i = 0; i < count; i++) {
        const tile = nextTile(team.id);
        if (!tile) break;
        tile.owner = team.id;
        claims.push({ teamId: team.id, key: key(tile), wave });
      }
    }
  });

  return { claims, tiles };
}

/**
 * The Keynote Stage goes to the team with the most correct answers across the questions
 * (summed accuracy, so team size doesn't matter); the fastest total median time breaks ties.
 * Nobody takes the Stage if no team got anything right.
 */
export function stageWinner(perQ: FinalQResult[], teamCount: number, rng: Rng): TeamId | null {
  let best: number[] = [];
  let bestAcc = 0;
  let bestTime = Infinity;
  for (let t = 0; t < teamCount; t++) {
    const acc = perQ.reduce((s, q) => s + (q.accuracy[t] ?? 0), 0);
    if (acc <= 0) continue;
    const time = perQ.reduce((s, q) => s + (q.medianMs[t] ?? 0), 0);
    if (acc > bestAcc + 1e-9 || (Math.abs(acc - bestAcc) <= 1e-9 && time < bestTime)) {
      best = [t];
      bestAcc = acc;
      bestTime = time;
    } else if (Math.abs(acc - bestAcc) <= 1e-9 && time === bestTime) {
      best.push(t);
    }
  }
  if (!best.length) return null;
  return best[Math.floor(rng() * best.length)] as TeamId;
}
