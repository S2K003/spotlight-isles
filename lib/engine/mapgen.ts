import { MAP_RADIUS, ROUTE_MAX, ROUTE_MIN, WEDGE } from "@/config/balance";
import { CRITERIA, RUBRIC } from "@/config/rubric";
import { corners, DIRS, distance, hexDisk, key, neighbors, ORIGIN, ring, wedgeOf } from "./hex";
import { costTo, indexTiles } from "./pathfinding";
import { mulberry32, shuffle, type Rng } from "./rng";
import type { CriterionKey, Hex, TeamId, Tile } from "./types";

export function homeHexes(): Hex[] {
  return corners(MAP_RADIUS);
}

export function regionOf(h: Hex): CriterionKey | "plaza" {
  return ring(h) <= 1 ? "plaza" : CRITERIA[wedgeOf(h)];
}

/** Rotate a hex by 60° around the centre: wedge i maps onto wedge i+1. */
export function rotate(h: Hex, times = 1): Hex {
  let { q, r } = h;
  for (let i = 0; i < ((times % 6) + 6) % 6; i++) [q, r] = [-r, q + r];
  return { q, r };
}

/**
 * Design one wedge (home, water, a key and a star) and rotate it six times, so every team
 * faces exactly the same journey. Returns null if the layout breaks a rule.
 */
function buildCandidate(rng: Rng): Tile[] | null {
  const home = DIRS[0].q * MAP_RADIUS;
  const homeHex: Hex = { q: home, r: 0 };
  const wedge0 = hexDisk(MAP_RADIUS).filter((h) => ring(h) >= 2 && wedgeOf(h) === 0 && key(h) !== key(homeHex));
  const nearHome = new Set(neighbors(homeHex).map(key));

  const pool = shuffle(rng, wedge0);
  const take = (n: number, ok: (h: Hex) => boolean): Hex[] => {
    const out: Hex[] = [];
    for (let i = 0; i < pool.length && out.length < n; i++) {
      if (ok(pool[i])) out.push(pool.splice(i--, 1)[0]);
    }
    return out;
  };
  // Nothing blocks the tiles right next to home.
  const water = take(WEDGE.water, (h) => !nearHome.has(key(h)));
  const keys = take(WEDGE.keys, () => true);
  const stars = take(WEDGE.stars, () => true);
  if (water.length < WEDGE.water || keys.length < WEDGE.keys || stars.length < WEDGE.stars) return null;

  const mark = new Map<string, "water" | "key" | "star">();
  for (let w = 0; w < 6; w++) {
    for (const h of water) mark.set(key(rotate(h, w)), "water");
    for (const h of keys) mark.set(key(rotate(h, w)), "key");
    for (const h of stars) mark.set(key(rotate(h, w)), "star");
  }

  // Heights come from the wedge-0 copy of each tile so the look is symmetric too.
  const heightOf = new Map<string, number>();
  const tiles: Tile[] = hexDisk(MAP_RADIUS).map((h) => {
    const d = ring(h);
    const region = regionOf(h);
    const m = mark.get(key(h));
    const type = d === 0 ? "stage" : d === 1 ? "plaza" : m === "water" ? "water" : "land";
    const base = d === 0 ? 30 : d === 1 ? 18 : RUBRIC[region as CriterionKey].height;
    const jitterKey = `${d}:${key(rotate(h, 6 - wedgeOf(h)))}`;
    if (!heightOf.has(jitterKey)) heightOf.set(jitterKey, rng() * 6);
    const tile: Tile = { q: h.q, r: h.r, type, region, height: type === "water" ? 0 : Math.round(base + heightOf.get(jitterKey)!) };
    // Each key belongs to the team from the OPPOSITE island, so everyone has to cross the map.
    if (m === "key") tile.key = ((wedgeOf(h) + 3) % 6) as TeamId;
    if (m === "star") tile.star = true;
    return tile;
  });
  return tiles;
}

/** True if every non-water tile can be reached from the plaza without crossing water or the Stage. */
export function isConnected(tiles: Tile[]): boolean {
  const idx = new Map<string, Tile>();
  for (const t of tiles) idx.set(key(t), t);
  const walkable = (t: Tile | undefined) => !!t && t.type !== "water" && t.type !== "stage";
  const start = key(DIRS[0]);
  const seen = new Set<string>([start]);
  const queue: Hex[] = [DIRS[0]];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of neighbors(cur)) {
      const k = key(n);
      if (seen.has(k) || !walkable(idx.get(k))) continue;
      seen.add(k);
      queue.push(n);
    }
  }
  return tiles.every((t) => !walkable(t) || seen.has(key(t)));
}

/** Fewest steps for a team to fly home → its own key → the Stage (water has to be flown around). */
export function routeLength(tiles: Tile[], teamId: TeamId): number {
  const index = indexTiles(tiles);
  const homes = homeHexes();
  const homeMap: Record<string, TeamId> = {};
  homes.forEach((h, i) => (homeMap[key(h)] = i as TeamId));
  let best = Infinity;
  for (const t of tiles) {
    if (t.key !== teamId) continue;
    const toKey = costTo(index, homes[teamId], t, { teamId, homes: homeMap });
    const toStage = costTo(index, t, ORIGIN, { teamId, homes: homeMap, allowStage: true });
    best = Math.min(best, toKey + toStage);
  }
  return best;
}

/** Generate the map for a seed. Reseeds deterministically until every rule passes. */
export function generateMap(seed: number): { tiles: Tile[]; seedUsed: number } {
  for (let attempt = 0; attempt < 2000; attempt++) {
    const seedUsed = (seed + attempt * 7919) >>> 0;
    const tiles = buildCandidate(mulberry32(seedUsed));
    if (!tiles || !isConnected(tiles)) continue;
    const route = routeLength(tiles, 0);
    if (route < ROUTE_MIN || route > ROUTE_MAX) continue;
    homeHexes().forEach((h, i) => {
      const t = tiles.find((x) => x.q === h.q && x.r === h.r)!;
      t.owner = i as TeamId;
    });
    return { tiles, seedUsed };
  }
  throw new Error("mapgen: no fair map found");
}
