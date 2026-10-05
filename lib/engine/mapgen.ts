import { CHESTS_AT_START, MAP_RADIUS, TILE_SHARE } from "@/config/balance";
import { CRITERIA, RUBRIC } from "@/config/rubric";
import { corners, DIRS, hexDisk, key, neighbors, ring, wedgeOf } from "./hex";
import { mulberry32, shuffle, type Rng } from "./rng";
import type { CriterionKey, Hex, Tile } from "./types";

export function homeHexes(): Hex[] {
  return corners(MAP_RADIUS);
}

export function regionOf(h: Hex): CriterionKey | "plaza" {
  return ring(h) <= 1 ? "plaza" : CRITERIA[wedgeOf(h)];
}

/** Keys of tiles that may never be water, fog or swamp: stage, plaza, homes and tiles next to a home. */
export function protectedKeys(): Set<string> {
  const out = new Set<string>();
  out.add("0,0");
  for (const d of DIRS) out.add(key(d));
  for (const home of homeHexes()) {
    out.add(key(home));
    for (const n of neighbors(home)) out.add(key(n));
  }
  return out;
}

function buildCandidate(rng: Rng): Tile[] {
  const hexes = hexDisk(MAP_RADIUS);
  const prot = protectedKeys();
  const tiles: Tile[] = hexes.map((h) => {
    const d = ring(h);
    const region = regionOf(h);
    const type = d === 0 ? "stage" : d === 1 ? "plaza" : "land";
    const base = d === 0 ? 30 : d === 1 ? 18 : RUBRIC[region as CriterionKey].height;
    return { q: h.q, r: h.r, type, region, height: Math.round(base + rng() * 6) };
  });

  const free = shuffle(
    rng,
    tiles.filter((t) => !prot.has(key(t))),
  );
  const total = tiles.length;
  const nWater = Math.round(total * TILE_SHARE.water);
  const nFog = Math.round(total * TILE_SHARE.fog);
  const nSwamp = Math.round(total * TILE_SHARE.swamp);
  free.slice(0, nWater).forEach((t) => {
    t.type = "water";
    t.height = 0;
  });
  free.slice(nWater, nWater + nFog).forEach((t) => (t.type = "fog"));
  free.slice(nWater + nFog, nWater + nFog + nSwamp).forEach((t) => {
    t.type = "swamp";
    t.height = Math.max(3, t.height - 4);
  });
  return tiles;
}

/**
 * True if every non-water tile can be reached from the plaza without crossing water or the
 * Keynote Stage (which is locked during normal rounds). That covers both "all land is connected"
 * and "all homes can reach the plaza".
 */
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

function placeStartingChests(tiles: Tile[], rng: Rng): void {
  const homes = new Set(homeHexes().map(key));
  // One chest per region, in the mid ring, so no team starts closer to treasure than another.
  let placed = 0;
  for (const c of CRITERIA) {
    const options = shuffle(
      rng,
      tiles.filter((t) => t.region === c && t.type === "land" && !homes.has(key(t)) && ring(t) >= 2 && ring(t) <= 4),
    );
    if (options[0]) {
      options[0].chest = true;
      placed++;
    }
  }
  const rest = shuffle(
    rng,
    tiles.filter((t) => t.type === "land" && !t.chest && !homes.has(key(t))),
  );
  for (let i = 0; placed < CHESTS_AT_START && i < rest.length; i++, placed++) rest[i].chest = true;
}

/** Generate the map for a seed. Reseeds deterministically until the connectivity check passes. */
export function generateMap(seed: number): { tiles: Tile[]; seedUsed: number } {
  for (let attempt = 0; attempt < 500; attempt++) {
    const seedUsed = (seed + attempt * 7919) >>> 0;
    const rng = mulberry32(seedUsed);
    const tiles = buildCandidate(rng);
    if (!isConnected(tiles)) continue;
    homeHexes().forEach((h, i) => {
      const t = tiles.find((x) => x.q === h.q && x.r === h.r)!;
      t.owner = i as Tile["owner"];
    });
    placeStartingChests(tiles, rng);
    return { tiles, seedUsed };
  }
  throw new Error("mapgen: no connected map found");
}
