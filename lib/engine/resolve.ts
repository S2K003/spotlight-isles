import { POINTS } from "@/config/balance";
import { key, parseKey } from "./hex";
import { homesOf, indexTiles } from "./pathfinding";
import { findKey, planPath } from "./route";
import type { MoveResult, Team, TeamId, Tile } from "./types";

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
 *  - a ship flies to its team's chosen hex, over its own key on the way if it can;
 *  - ships never block each other: any number can share a hex;
 *  - flying over your own key picks it up; flying over a star takes it (so moving first helps);
 *  - landing on the Stage docks the ship and pays the arrival bonus (earlier is worth more).
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

    const path = planPath(index, team, parseKey(dest), steps, homes, findKey(tiles, teamId));
    if (!path) return;
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
