import { POINTS } from "@/config/balance";
import { key, parseKey } from "./hex";
import { homesOf, indexTiles, shortestPath } from "./pathfinding";
import type { Hex, MoveResult, Team, TeamId, Tile } from "./types";

export interface ResolveInput {
  tiles: Tile[];
  teams: Team[];
  /** Steps available to each team this round. */
  steps: number[];
  /** Move order: highest score first. */
  order: TeamId[];
  /** Destination key per team, or null to hold position. */
  dests: (string | null)[];
  /** Ships already at the Stage before this round. */
  dockCount: number;
}

export interface ResolveOutput {
  moves: MoveResult[];
  tiles: Tile[];
  teams: Team[];
  dockCount: number;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/**
 * Resolve one round. Ships move ONE AT A TIME in `order` (most points first):
 *  - a ship flies the shortest path to its team's chosen hex;
 *  - it can't land on a hex another ship is sitting on, so it stops one hex short (the Stage is
 *    the exception: any number of ships can dock there);
 *  - flying over your own key picks it up; flying over a star takes it;
 *  - landing on the Stage docks the ship and pays the arrival bonus.
 * Pure and deterministic. Moves are returned in the order they happened.
 */
export function resolveRound(input: ResolveInput): ResolveOutput {
  const tiles = clone(input.tiles);
  const teams = clone(input.teams);
  const index = indexTiles(tiles);
  const homes = homesOf(teams);
  let dockCount = input.dockCount;
  const moves: MoveResult[] = [];

  input.order.forEach((teamId, orderIdx) => {
    const team = teams[teamId];
    const move: MoveResult = { teamId, order: orderIdx, path: [team.pos], stars: [], bonus: 0 };
    moves.push(move);
    const dest = input.dests[teamId];
    const steps = input.steps[teamId] ?? 0;
    if (team.docked !== null || !dest || steps <= 0 || dest === key(team.pos)) return;

    const path = shortestPath(index, team.pos, parseKey(dest), steps, { teamId, homes, allowStage: team.hasKey });
    if (!path) return;

    // Where is everyone else right now? Earlier movers are already at their new hex.
    const taken = new Set(teams.filter((t) => t.id !== teamId && t.docked === null).map((t) => key(t.pos)));
    const wanted: Hex = path[path.length - 1];
    while (path.length > 1 && taken.has(key(path[path.length - 1]))) path.pop();
    if (key(path[path.length - 1]) !== key(wanted)) move.blockedAt = wanted;
    move.path = path;

    for (const h of path.slice(1)) {
      const tile = index[key(h)];
      if (tile.type !== "stage") tile.owner = teamId; // the trail is only decoration
      if (tile.key === teamId) {
        delete tile.key;
        team.hasKey = true;
        move.gotKey = true;
        move.bonus += POINTS.key;
      }
      if (tile.star) {
        delete tile.star;
        team.stars++;
        move.stars.push(key(h));
        move.bonus += POINTS.star;
      }
    }

    const end = path[path.length - 1];
    team.pos = { q: end.q, r: end.r };
    if (index[key(end)].type === "stage") {
      team.docked = ++dockCount;
      move.docked = team.docked;
      move.bonus += POINTS.dock[Math.min(team.docked, POINTS.dock.length) - 1];
    }
    team.score += move.bonus;
  });

  return { moves, tiles, teams, dockCount };
}
