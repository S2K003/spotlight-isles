import { TILE_COST } from "@/config/balance";
import { DIRS, key, parseKey } from "./hex";
import type { Hex, ReachItem, TeamId, Tile } from "./types";

export type TileIndex = Record<string, Tile>;

export function indexTiles(tiles: Tile[]): TileIndex {
  const idx: TileIndex = {};
  for (const t of tiles) idx[`${t.q},${t.r}`] = t;
  return idx;
}

export interface MoveRules {
  teamId: TeamId;
  /** Home tile key → owning team. Another team's home is impassable. */
  homes: Record<string, TeamId>;
  allowStage?: boolean;
}

/** Movement cost to ENTER a tile, or Infinity if it can't be entered. */
export function enterCost(tile: Tile | undefined, rules: MoveRules): number {
  if (!tile) return Infinity;
  if (tile.type === "water") return Infinity;
  if (tile.type === "stage") return rules.allowStage ? 1 : Infinity;
  const homeOf = rules.homes[`${tile.q},${tile.r}`];
  if (homeOf !== undefined && homeOf !== rules.teamId) return Infinity;
  return TILE_COST[tile.type];
}

interface Node {
  cost: number;
  prev: string | null;
  seq: number;
}

/**
 * Dijkstra from `from`, limited to `maxCost`. Deterministic: nodes are expanded by
 * (cost, discovery order) and neighbours are visited in the fixed DIRS order, and a node's
 * predecessor only changes on a strictly cheaper route. Every client therefore gets the same path.
 */
export function search(index: TileIndex, from: Hex, maxCost: number, rules: MoveRules): Record<string, Node> {
  const nodes: Record<string, Node> = {};
  const done: Record<string, boolean> = {};
  let seq = 0;
  nodes[key(from)] = { cost: 0, prev: null, seq: seq++ };
  const open: string[] = [key(from)];

  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      const a = nodes[open[i]];
      const b = nodes[open[bi]];
      if (a.cost < b.cost || (a.cost === b.cost && a.seq < b.seq)) bi = i;
    }
    const curKey = open.splice(bi, 1)[0];
    if (done[curKey]) continue;
    done[curKey] = true;
    const cur = parseKey(curKey);
    const curCost = nodes[curKey].cost;
    for (const d of DIRS) {
      const nk = `${cur.q + d.q},${cur.r + d.r}`;
      if (done[nk]) continue;
      const step = enterCost(index[nk], rules);
      const cost = curCost + step;
      if (cost > maxCost) continue;
      const existing = nodes[nk];
      if (!existing) {
        nodes[nk] = { cost, prev: curKey, seq: seq++ };
        open.push(nk);
      } else if (cost < existing.cost) {
        existing.cost = cost;
        existing.prev = curKey;
      }
    }
  }
  return nodes;
}

/** Every hex the team can reach with `mp` movement points (excluding where it already is). */
export function reachable(index: TileIndex, from: Hex, mp: number, rules: MoveRules): ReachItem[] {
  if (mp <= 0) return [];
  const nodes = search(index, from, mp, rules);
  const start = key(from);
  return Object.keys(nodes)
    .filter((k) => k !== start)
    .map((k) => ({ key: k, cost: nodes[k].cost }));
}

/** Shortest path from `from` to `to` within `mp`, origin first; null if unreachable. */
export function shortestPath(index: TileIndex, from: Hex, to: Hex, mp: number, rules: MoveRules): Hex[] | null {
  const nodes = search(index, from, mp, rules);
  const target = key(to);
  if (!nodes[target]) return null;
  const path: Hex[] = [];
  let k: string | null = target;
  while (k) {
    path.push(parseKey(k));
    k = nodes[k].prev;
  }
  return path.reverse();
}

export function homesOf(teams: { id: TeamId; home: Hex }[]): Record<string, TeamId> {
  const homes: Record<string, TeamId> = {};
  for (const t of teams) homes[key(t.home)] = t.id;
  return homes;
}
