import { key, ORIGIN, parseKey } from "./hex";
import { costTo, reachable, shortestPath, type TileIndex } from "./pathfinding";
import type { Hex, ReachItem, Team, TeamId, Tile } from "./types";

type Flyer = Pick<Team, "id" | "pos" | "hasKey">;
type Homes = Record<string, TeamId>;

/** Where a team's own key is, or null once it has been picked up. */
export function findKey(tiles: Tile[], teamId: TeamId): Hex | null {
  const t = tiles.find((x) => x.key === teamId);
  return t ? { q: t.q, r: t.r } : null;
}

/**
 * The path a ship flies to `dest` with `steps`. If the team still needs its key and can fly over
 * it on the way within the same steps, it does, so a team never has to waste a move "stopping"
 * on the key. Returns null if `dest` can't be reached.
 */
export function planPath(index: TileIndex, team: Flyer, dest: Hex, steps: number, homes: Homes, keyHex: Hex | null): Hex[] | null {
  const rules = { teamId: team.id, homes };
  if (!team.hasKey && keyHex) {
    const toKey = shortestPath(index, team.pos, keyHex, steps, rules);
    if (toKey) {
      const left = steps - (toKey.length - 1);
      const onward = key(dest) === key(keyHex) ? [keyHex] : shortestPath(index, keyHex, dest, left, { ...rules, allowStage: true });
      if (onward) return toKey.concat(onward.slice(1));
    }
  }
  return shortestPath(index, team.pos, dest, steps, { ...rules, allowStage: team.hasKey });
}

/** Every hex the team can end its move on, including the Stage if it can collect its key on the way. */
export function reachableFor(index: TileIndex, team: Flyer, steps: number, homes: Homes, keyHex: Hex | null): ReachItem[] {
  const rules = { teamId: team.id, homes };
  const best = new Map<string, number>();
  for (const r of reachable(index, team.pos, steps, { ...rules, allowStage: team.hasKey })) best.set(r.key, r.cost);
  if (!team.hasKey && keyHex) {
    const toKey = best.get(key(keyHex));
    if (toKey !== undefined) {
      for (const r of reachable(index, keyHex, steps - toKey, { ...rules, allowStage: true })) {
        const cost = toKey + r.cost;
        if (cost < (best.get(r.key) ?? Infinity)) best.set(r.key, cost);
      }
    }
  }
  best.delete(key(team.pos));
  return Array.from(best, ([k, cost]) => ({ key: k, cost }));
}

/** Steps still needed to finish the journey from `at` (own key first if not yet collected). */
export function stepsToGo(index: TileIndex, team: Pick<Team, "id">, at: Hex, hasKey: boolean, homes: Homes, keyHex: Hex | null): number {
  const rules = { teamId: team.id, homes };
  if (hasKey || !keyHex) return key(at) === key(ORIGIN) ? 0 : costTo(index, at, ORIGIN, { ...rules, allowStage: true });
  return costTo(index, at, keyHex, rules) + costTo(index, keyHex, ORIGIN, { ...rules, allowStage: true });
}

/**
 * The best move this round: the reachable hex that leaves the fewest steps to go.
 * Returns a hex key, or "hold" if nothing is better than staying put. This is what the phones
 * highlight, and what a ship does by itself if its team doesn't choose.
 */
export function suggestMove(index: TileIndex, team: Flyer, steps: number, homes: Homes, keyHex: Hex | null): string {
  let best = "hold";
  let bestToGo = stepsToGo(index, team, team.pos, team.hasKey, homes, keyHex);
  let bestCost = 0;
  const options = reachableFor(index, team, steps, homes, keyHex).sort((a, b) => a.key.localeCompare(b.key));
  for (const opt of options) {
    const dest = parseKey(opt.key);
    const path = planPath(index, team, dest, steps, homes, keyHex);
    if (!path) continue;
    const getsKey = team.hasKey || (!!keyHex && path.some((h) => key(h) === key(keyHex)));
    const toGo = stepsToGo(index, team, dest, getsKey, homes, keyHex);
    if (toGo < bestToGo || (toGo === bestToGo && best !== "hold" && opt.cost < bestCost)) {
      best = opt.key;
      bestToGo = toGo;
      bestCost = opt.cost;
    }
  }
  return best;
}
