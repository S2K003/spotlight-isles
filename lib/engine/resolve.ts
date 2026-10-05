import { CLASH_MAX_ITERATIONS } from "@/config/balance";
import { drawCard, giveCard, hecklerTarget, removeCard } from "./cards";
import { key, neighbors, parseKey } from "./hex";
import { homesOf, indexTiles, shortestPath } from "./pathfinding";
import type { Rng } from "./rng";
import type { CardFx, CardId, Hex, MoveResult, Team, TeamId, Tile } from "./types";

export interface ResolveInput {
  tiles: Tile[];
  teams: Team[];
  mp: number[];
  roundScore: number[];
  /** Destination key per team, or null to hold position. */
  dests: (string | null)[];
  cards: (CardId | null)[];
  rng: Rng;
}

export interface ResolveOutput {
  moves: MoveResult[];
  tiles: Tile[];
  teams: Team[];
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/**
 * Section 5.4: resolve one round's simultaneous moves. Pure and deterministic for a given rng.
 * Order: cards → clashes → paint → pickups → hazards. (Scores are recomputed by the caller.)
 */
export function resolveRound(input: ResolveInput): ResolveOutput {
  const tiles = clone(input.tiles);
  const teams = clone(input.teams);
  const index = indexTiles(tiles);
  const homes = homesOf(teams);
  const n = teams.length;

  // Equal round scores are broken by one seeded draw per team, fixed for the whole resolution.
  const tiebreak = teams.map(() => input.rng());
  const beats = (a: number, b: number) =>
    input.roundScore[a] !== input.roundScore[b] ? input.roundScore[a] > input.roundScore[b] : tiebreak[a] > tiebreak[b];
  const bestOf = (ids: number[]) => ids.reduce((best, id) => (beats(id, best) ? id : best));

  /* 1. Cards */
  const cardFx: CardFx[][] = teams.map(() => []);
  const shielded = new Set<number>();
  const micDrop = new Set<number>();
  const scoresBefore = teams.map((t) => ({ id: t.id, score: t.score }));
  for (let i = 0; i < n; i++) {
    const card = input.cards[i];
    if (!card || !teams[i].cards.includes(card)) continue;
    if (card === "heckler") {
      const target = hecklerTarget(scoresBefore, teams[i].id);
      if (target === null) continue; // playing team is the leader: card stays in hand
      teams[target].pendingMods.push({ kind: "heckler", delta: -1 });
      cardFx[i].push({ card, target });
    } else if (card === "hook") {
      teams[i].pendingMods.push({ kind: "hook", delta: 1 });
      cardFx[i].push({ card });
    } else if (card === "rehearsed") {
      shielded.add(i);
      cardFx[i].push({ card });
    } else if (card === "micdrop") {
      micDrop.add(i);
    }
    teams[i].cards = removeCard(teams[i].cards, card);
  }

  /* 2. Paths and clashes */
  const intended: Hex[][] = teams.map((team, i) => {
    const dest = input.dests[i];
    if (!dest || input.mp[i] <= 0 || dest === key(team.pos)) return [team.pos];
    const path = shortestPath(index, team.pos, parseKey(dest), input.mp[i], { teamId: team.id, homes });
    return path ?? [team.pos];
  });
  const paths = intended.map((p) => p.slice());
  const clashAt: (Hex | undefined)[] = teams.map(() => undefined);

  const conflicts = (): number[][] => {
    const groups: Record<string, number[]> = {};
    paths.forEach((p, i) => (groups[key(p[p.length - 1])] ??= []).push(i));
    return Object.values(groups).filter((g) => g.length > 1);
  };

  let open = conflicts();
  for (let iter = 0; open.length && iter < CLASH_MAX_ITERATIONS; iter++) {
    for (const group of open) {
      // A ship that isn't moving can't be pushed anywhere, so it always keeps its own tile.
      const stationary = group.filter((i) => paths[i].length === 1);
      const winner = stationary.length ? stationary[0] : bestOf(group);
      for (const i of group) {
        if (i === winner || paths[i].length === 1) continue;
        clashAt[i] ??= paths[i][paths[i].length - 1];
        paths[i].pop();
      }
    }
    open = conflicts();
  }
  // Still unresolved after the cap: everyone left in conflict stays at their origin. Sending a
  // ship home can itself collide with a ship that moved onto that origin, so repeat until stable
  // (all ships at their origins is always a valid end state, because origins are distinct).
  while (open.length) {
    for (const group of open) {
      for (const i of group) {
        if (paths[i].length === 1) continue;
        clashAt[i] ??= paths[i][paths[i].length - 1];
        paths[i] = [paths[i][0]];
      }
    }
    open = conflicts();
  }

  /* 3. Paint */
  const claimable = (tile: Tile | undefined, teamIdx: number): tile is Tile => {
    if (!tile || tile.type === "water" || tile.type === "stage") return false;
    const home = homes[key(tile)];
    if (home !== undefined && home !== teams[teamIdx].id) return false;
    if (tile.owner !== undefined && tile.owner !== teams[teamIdx].id && shielded.has(tile.owner)) return false;
    return true;
  };
  const claims: Record<string, number> = {};
  const order: string[][] = teams.map(() => []);
  const claim = (k: string, i: number) => {
    if (!claimable(index[k], i)) return;
    if (!order[i].includes(k)) order[i].push(k);
    if (claims[k] === undefined || (claims[k] !== i && beats(i, claims[k]))) claims[k] = i;
  };
  const maxLen = Math.max(...paths.map((p) => p.length));
  for (let step = 1; step < maxLen; step++) {
    for (let i = 0; i < n; i++) if (paths[i][step]) claim(key(paths[i][step]), i);
  }
  const micTiles: string[][] = teams.map(() => []);
  for (const i of micDrop) {
    const end = paths[i][paths[i].length - 1];
    for (const nb of neighbors(end)) {
      const k = key(nb);
      if (claimable(index[k], i)) {
        micTiles[i].push(k);
        claim(k, i);
      }
    }
  }
  for (const k of Object.keys(claims)) index[k].owner = teams[claims[k]].id;

  /* 4. Pickups and 5. hazards */
  const moves: MoveResult[] = teams.map((team, i) => {
    const path = paths[i];
    const end = path[path.length - 1];
    const tile = index[key(end)];
    const move: MoveResult = {
      teamId: team.id,
      path,
      intended: intended[i],
      clashAt: clashAt[i],
      cardFx: cardFx[i],
      painted: order[i].filter((k) => claims[k] === i),
    };
    if (micDrop.has(i)) move.cardFx.push({ card: "micdrop", tiles: micTiles[i].filter((k) => claims[k] === i) });
    if (tile.chest) {
      delete tile.chest;
      move.pickup = drawCard(input.rng);
      team.cards = giveCard(team.cards, move.pickup);
    }
    // The swamp only bites when a ship ends a move there; sitting still in one doesn't stack penalties.
    if (tile.type === "swamp" && path.length > 1) {
      team.pendingMods.push({ kind: "swamp", delta: -1 });
      move.swamp = true;
    }
    team.pos = { q: end.q, r: end.r };
    return move;
  });

  return { moves, tiles, teams };
}

export function ownedBy(tiles: Tile[], teamId: TeamId): Tile[] {
  return tiles.filter((t) => t.owner === teamId);
}
