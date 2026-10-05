import { describe, expect, it } from "vitest";
import { MAP_RADIUS } from "@/config/balance";
import { CRITERIA } from "@/config/rubric";
import { DUR, ROUNDS, TOTAL_MS } from "@/config/timeline";
import { corners, distance, hexDisk, key, ORIGIN, wedgeOf } from "@/lib/engine/hex";
import { generateMap, isConnected, protectedKeys } from "@/lib/engine/mapgen";
import { homesOf, indexTiles, reachable, shortestPath } from "@/lib/engine/pathfinding";
import { makeRoomCode, mulberry32, normalizeRoomCode, rngFor, shuffle } from "@/lib/engine/rng";
import { buildTimeline, phaseIndexAt, TIMELINE, TIMELINE_TOTAL_MS } from "@/lib/engine/timeline";
import type { TeamId, Tile } from "@/lib/engine/types";

describe("timeline", () => {
  it("sums to exactly 900,000 ms (15:00)", () => {
    expect(TIMELINE_TOTAL_MS).toBe(900_000);
    expect(TOTAL_MS).toBe(900_000);
    expect(buildTimeline().reduce((s, p) => s + p.durationMs, 0)).toBe(900_000);
  });

  it("has contiguous cumulative offsets and unique ids", () => {
    let offset = 0;
    for (const p of TIMELINE) {
      expect(p.startOffsetMs).toBe(offset);
      offset += p.durationMs;
    }
    expect(new Set(TIMELINE.map((p) => p.id)).size).toBe(TIMELINE.length);
  });

  it("matches the spec's clock for key moments", () => {
    const at = (id: string) => TIMELINE.find((p) => p.id === id)!.startOffsetMs / 1000;
    expect(at("r1-challenge")).toBe(40);
    expect(at("r3-ready")).toBe(132); // 02:12
    expect(at("r4-challenge")).toBe(219); // 03:39
    expect(at("r6-ready")).toBe(311); // 05:11
    expect(at("r9-ready")).toBe(490); // 08:10
    expect(at("r10-challenge")).toBe(577); // 09:37
    expect(at("final-banner")).toBe(715); // 11:55
    expect(at("results")).toBe(790); // 13:10
    expect(at("debrief")).toBe(850); // 14:10
  });

  it("standard rounds are 46 s and spotlight rounds are 87 s", () => {
    expect(DUR.challenge + DUR.reveal + DUR.vote + DUR.resolve).toBe(46);
    expect(DUR.spotReady + 2 * (DUR.spotSpeak + DUR.spotRate) + DUR.spotReveal + DUR.vote + DUR.resolve).toBe(87);
    expect(DUR.finalBanner + 3 * (DUR.finalQ + DUR.finalReveal) + DUR.finalFlood).toBe(75);
  });

  it("each team speaks exactly once", () => {
    const speakers = ROUNDS.flatMap((r) => (r.kind === "spotlight" ? r.teams : []));
    expect(speakers.slice().sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(ROUNDS.length).toBe(12);
  });

  it("phaseIndexAt maps clock time to phases", () => {
    expect(phaseIndexAt(0)).toBe(0);
    expect(TIMELINE[phaseIndexAt(39_999)].kind).toBe("intro");
    expect(TIMELINE[phaseIndexAt(40_000)].id).toBe("r1-challenge");
    expect(TIMELINE[phaseIndexAt(899_999)].kind).toBe("debrief");
    expect(phaseIndexAt(900_000)).toBe(TIMELINE.length);
  });
});

describe("hex + map", () => {
  it("radius 6 gives 127 hexes", () => {
    expect(hexDisk(MAP_RADIUS).length).toBe(127);
  });

  it("the 6 homes are equidistant from the centre", () => {
    const homes = corners(MAP_RADIUS);
    expect(homes.length).toBe(6);
    for (const h of homes) expect(distance(h, ORIGIN)).toBe(6);
    expect(new Set(homes.map(key)).size).toBe(6);
  });

  it("each home sits in its own wedge and wedges are the same size", () => {
    corners(MAP_RADIUS).forEach((h, i) => expect(wedgeOf(h)).toBe(i));
    const counts = [0, 0, 0, 0, 0, 0];
    for (const h of hexDisk(MAP_RADIUS)) if (distance(h, ORIGIN) >= 2) counts[wedgeOf(h)]++;
    expect(counts).toEqual([20, 20, 20, 20, 20, 20]);
  });

  it("all land is connected for 50 random seeds, and protected tiles stay clear", () => {
    const prot = protectedKeys();
    for (let seed = 1; seed <= 50; seed++) {
      const { tiles } = generateMap(seed * 7919);
      expect(tiles.length).toBe(127);
      expect(isConnected(tiles)).toBe(true);
      for (const t of tiles) {
        if (prot.has(key(t))) expect(["land", "plaza", "stage"]).toContain(t.type);
      }
      expect(tiles.filter((t) => t.type === "stage").length).toBe(1);
      expect(tiles.filter((t) => t.type === "plaza").length).toBe(6);
      expect(tiles.filter((t) => t.chest).length).toBe(6);
      expect(tiles.filter((t) => t.type === "water").length).toBe(15);
      corners(MAP_RADIUS).forEach((h, i) => {
        expect(tiles.find((t) => t.q === h.q && t.r === h.r)!.owner).toBe(i);
      });
      for (const c of CRITERIA) expect(tiles.some((t) => t.region === c && t.chest)).toBe(true);
    }
  });

  it("is deterministic for a seed", () => {
    expect(generateMap(42).tiles).toEqual(generateMap(42).tiles);
  });

  it("detects a disconnected map", () => {
    const { tiles } = generateMap(5);
    const cut: Tile[] = tiles.map((t) => (distance(t, ORIGIN) === 3 ? { ...t, type: "water" } : t));
    expect(isConnected(cut)).toBe(false);
  });
});

describe("pathfinding", () => {
  const flat = (): Tile[] =>
    hexDisk(MAP_RADIUS).map((h) => ({
      q: h.q,
      r: h.r,
      type: distance(h, ORIGIN) === 0 ? "stage" : "land",
      region: "structure",
      height: 1,
    }));
  const teams = corners(MAP_RADIUS).map((home, i) => ({ id: i as TeamId, home }));
  const rules = { teamId: 0 as TeamId, homes: homesOf(teams) };

  it("reaches exactly the tiles within MP on open land", () => {
    const idx = indexTiles(flat());
    const from = { q: 3, r: 0 };
    expect(reachable(idx, from, 0, rules)).toEqual([]);
    expect(reachable(idx, from, 1, rules).length).toBe(6);
    expect(reachable(idx, from, 2, rules).length).toBe(18);
  });

  it("fog costs 2 MP, water and the locked Stage are impassable", () => {
    const tiles = flat();
    const set = (q: number, r: number, type: Tile["type"]) => (tiles.find((t) => t.q === q && t.r === r)!.type = type);
    set(4, 0, "fog");
    set(3, 1, "water");
    const idx = indexTiles(tiles);
    const from = { q: 3, r: 0 };
    const r1 = reachable(idx, from, 1, rules).map((r) => r.key);
    expect(r1).not.toContain("4,0");
    expect(r1).not.toContain("3,1");
    expect(reachable(idx, from, 2, rules).find((r) => r.key === "4,0")!.cost).toBe(2);
    expect(reachable(idx, { q: 1, r: 0 }, 3, rules).map((r) => r.key)).not.toContain("0,0");
    expect(shortestPath(idx, from, { q: 3, r: 1 }, 5, rules)).toBeNull();
  });

  it("another team's home is impassable, your own is fine", () => {
    const idx = indexTiles(flat());
    const nextToHome1 = { q: 0, r: 5 };
    expect(reachable(idx, nextToHome1, 1, rules).map((r) => r.key)).not.toContain("0,6");
    expect(reachable(idx, nextToHome1, 1, { ...rules, teamId: 1 }).map((r) => r.key)).toContain("0,6");
  });

  it("returns a deterministic shortest path, origin first", () => {
    const idx = indexTiles(flat());
    const a = shortestPath(idx, { q: 6, r: 0 }, { q: 3, r: 1 }, 5, rules)!;
    const b = shortestPath(idx, { q: 6, r: 0 }, { q: 3, r: 1 }, 5, rules)!;
    expect(a).toEqual(b);
    expect(a[0]).toEqual({ q: 6, r: 0 });
    expect(a[a.length - 1]).toEqual({ q: 3, r: 1 });
    expect(a.length).toBe(4);
    for (let i = 1; i < a.length; i++) expect(distance(a[i - 1], a[i])).toBe(1);
  });
});

describe("rng", () => {
  it("is deterministic and label-separated", () => {
    expect(mulberry32(1)()).toBe(mulberry32(1)());
    expect(rngFor(9, "a")()).not.toBe(rngFor(9, "b")());
    expect(shuffle(mulberry32(3), [1, 2, 3, 4, 5]).sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("room codes are 4 unambiguous capitals", () => {
    for (let i = 0; i < 200; i++) expect(makeRoomCode(mulberry32(i))).toMatch(/^[A-HJ-NP-Z]{4}$/);
    expect(normalizeRoomCode(" ab-cd ")).toBe("ABCD");
  });
});
