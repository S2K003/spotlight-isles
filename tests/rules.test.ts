import { describe, expect, it } from "vitest";
import { MAP_RADIUS } from "@/config/balance";
import { computeAwards } from "@/lib/engine/awards";
import { giveCard, hecklerTarget } from "@/lib/engine/cards";
import { computeDebrief } from "@/lib/engine/debrief";
import { bottomTeams, finalClaims, stageWinner } from "@/lib/engine/final";
import { corners, distance, hexDisk, key, neighbors, ORIGIN } from "@/lib/engine/hex";
import { resolveRound, type ResolveInput } from "@/lib/engine/resolve";
import { mulberry32 } from "@/lib/engine/rng";
import { applyMods, baseMp, median, rankTeams, roundScore, scoreChallenge, scoreManual, teamScores } from "@/lib/engine/scoring";
import { isFairJudge, mpFromSpotlight, speakerResult } from "@/lib/engine/spotlight";
import type { CardId, CriterionKey, Rating, Team, TeamId, Tile } from "@/lib/engine/types";

/* ---------- fixtures ---------- */

const REGIONS: CriterionKey[] = ["structure", "visuals", "delivery", "engagement", "timing", "qa"];

function flatTiles(): Tile[] {
  return hexDisk(MAP_RADIUS).map((h) => ({
    q: h.q,
    r: h.r,
    type: distance(h, ORIGIN) === 0 ? "stage" : "land",
    region: "structure" as CriterionKey,
    height: 1,
  }));
}

function makeTeams(positions?: Partial<Record<number, { q: number; r: number }>>): Team[] {
  return corners(MAP_RADIUS).map((home, i) => ({
    id: i as TeamId,
    name: `T${i}`,
    color: "#fff",
    emblem: "x",
    home,
    pos: positions?.[i] ?? home,
    cards: [],
    pendingMods: [],
    score: 0,
  }));
}

const tileAt = (tiles: Tile[], q: number, r: number) => tiles.find((t) => t.q === q && t.r === r)!;

function input(over: Partial<ResolveInput> & { teams: Team[]; tiles: Tile[] }): ResolveInput {
  return {
    mp: [3, 3, 3, 3, 3, 3],
    roundScore: [0, 0, 0, 0, 0, 0],
    dests: [null, null, null, null, null, null],
    cards: [null, null, null, null, null, null],
    rng: mulberry32(1),
    ...over,
  };
}

/* ---------- 5.1 movement points ---------- */

describe("challenge scoring (5.1)", () => {
  it("maps accuracy to MP bands", () => {
    expect(baseMp(0)).toBe(0);
    expect(baseMp(0.01)).toBe(1);
    expect(baseMp(0.49)).toBe(1);
    expect(baseMp(0.5)).toBe(2);
    expect(baseMp(0.79)).toBe(2);
    expect(baseMp(0.8)).toBe(3);
    expect(baseMp(1)).toBe(3);
  });

  it("clamps final MP to 0..5 after modifiers", () => {
    expect(applyMods(3, [{ kind: "hook", delta: 1 }])).toBe(4);
    expect(applyMods(0, [{ kind: "swamp", delta: -1 }])).toBe(0);
    expect(applyMods(4, [{ kind: "hook", delta: 1 }, { kind: "hook", delta: 1 }])).toBe(5);
    expect(applyMods(2, [{ kind: "swamp", delta: -1 }, { kind: "heckler", delta: -1 }])).toBe(0);
  });

  it("round score = accuracy × 1000 − median ms ÷ 100", () => {
    expect(roundScore(1, 4000)).toBe(960);
    expect(roundScore(0.5, 10000)).toBe(400);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 2])).toBe(3);
    expect(median([])).toBeNull();
  });

  it("a team of 1 is exactly as strong as a team of 8", () => {
    const none = [[], [], [], [], [], []];
    const res = scoreChallenge(
      [
        { teamId: 0, members: 1, correctTimes: [5000] },
        { teamId: 1, members: 8, correctTimes: [5000, 5000, 5000, 5000, 5000, 5000, 5000, 5000] },
        { teamId: 2, members: 4, correctTimes: [3000, 3000] },
        { teamId: 3, members: 4, correctTimes: [1000] },
        { teamId: 4, members: 3, correctTimes: [] },
        { teamId: 5, members: 0, correctTimes: [] },
      ],
      none,
    );
    expect(res[0].accuracy).toBe(1);
    expect(res[1].accuracy).toBe(1);
    expect(res[0].roundScore).toBe(res[1].roundScore);
    // Team 2: 50% → 2 MP, and fastest with ≥50% → Quick Draw +1.
    expect(res[2].quickDraw).toBe(true);
    expect(res[2].mp).toBe(3);
    // Team 3 was fastest overall but under 50%, so no Quick Draw.
    expect(res[3].quickDraw).toBe(false);
    expect(res[3].mp).toBe(1);
    // 0% correct and an empty team are both Stage Fright.
    expect(res[4].stageFright).toBe(true);
    expect(res[4].mp).toBe(0);
    expect(res[5].stageFright).toBe(true);
    expect(res[0].mp).toBe(3);
    expect(res.filter((r) => r.quickDraw).length).toBe(1);
  });

  it("applies pending modifiers", () => {
    const mods = [[{ kind: "hook" as const, delta: 1 }], [{ kind: "swamp" as const, delta: -1 }], [], [], [], []];
    const res = scoreChallenge(
      [0, 1, 2, 3, 4, 5].map((t) => ({ teamId: t as TeamId, members: 2, correctTimes: t < 2 ? [9000, 9000] : [] })),
      mods,
    );
    // Team 0: 3 + Quick Draw (tied median, first found) + hook; team 1: 3 − swamp.
    expect(res[0].mp).toBe(5);
    expect(res[1].mp).toBe(2);
  });

  it("Manual Mode bands", () => {
    const res = scoreManual([0, 1, 2, 3, null, 3], 3, [[], [], [], [], [], []]);
    expect(res.map((r) => r.mp)).toEqual([0, 1, 2, 4, 2, 3]);
    expect(res[0].stageFright).toBe(true);
    // Quick Draw can't go to a team under 50%.
    expect(scoreManual([1, 3, 3, 3, 3, 3], 0, [[], [], [], [], [], []])[0].quickDraw).toBe(false);
  });
});

/* ---------- 5.4 resolution ---------- */

describe("move resolution (5.4)", () => {
  it("paints every tile along the path and moves the ship", () => {
    const tiles = flatTiles();
    const teams = makeTeams();
    const out = resolveRound(input({ tiles, teams, dests: ["3,0", null, null, null, null, null] }));
    expect(out.teams[0].pos).toEqual({ q: 3, r: 0 });
    expect(out.moves[0].path.length).toBe(4);
    for (const h of out.moves[0].path.slice(1)) expect(tileAt(out.tiles, h.q, h.r).owner).toBe(0);
    expect(out.moves[0].painted.length).toBe(3);
    // Inputs are not mutated.
    expect(teams[0].pos).toEqual({ q: 6, r: 0 });
    expect(tileAt(tiles, 3, 0).owner).toBeUndefined();
  });

  it("holds position with 0 MP, no vote, or an unreachable destination", () => {
    const out = resolveRound(
      input({ tiles: flatTiles(), teams: makeTeams(), mp: [0, 3, 1, 3, 3, 3], dests: ["5,0", null, "0,1", null, null, null] }),
    );
    expect(out.moves[0].path.length).toBe(1);
    expect(out.moves[1].path.length).toBe(1);
    expect(out.moves[2].path.length).toBe(1);
  });

  it("clash: higher round score wins, the loser stops on the tile before", () => {
    const teams = makeTeams({ 0: { q: 2, r: 0 }, 1: { q: -1, r: 2 } });
    const out = resolveRound(
      input({ tiles: flatTiles(), teams, roundScore: [900, 500, 0, 0, 0, 0], dests: ["1,1", "1,1", null, null, null, null], mp: [2, 3, 0, 0, 0, 0] }),
    );
    expect(out.teams[0].pos).toEqual({ q: 1, r: 1 });
    expect(out.moves[1].clashAt).toEqual({ q: 1, r: 1 });
    expect(key(out.teams[1].pos)).not.toBe("1,1");
    expect(distance(out.teams[1].pos, { q: 1, r: 1 })).toBe(1);
    expect(tileAt(out.tiles, 1, 1).owner).toBe(0);
  });

  it("clash chains: a bounced ship can bump the ship behind it", () => {
    // 0 and 1 both target (0,2); 1 loses and falls back to (0,3), which is exactly what 2 targets.
    const teams = makeTeams({ 0: { q: 1, r: 1 }, 1: { q: 0, r: 4 }, 2: { q: -1, r: 4 } });
    const out = resolveRound(
      input({
        tiles: flatTiles(),
        teams,
        roundScore: [900, 500, 100, 0, 0, 0],
        dests: ["0,2", "0,2", "0,3", null, null, null],
        mp: [1, 2, 1, 0, 0, 0],
      }),
    );
    expect(out.teams[0].pos).toEqual({ q: 0, r: 2 });
    expect(out.teams[1].pos).toEqual({ q: 0, r: 3 });
    expect(out.teams[2].pos).toEqual({ q: -1, r: 4 }); // bumped back to its origin
    expect(out.moves[2].clashAt).toEqual({ q: 0, r: 3 });
    expect(new Set(out.teams.map((t) => key(t.pos))).size).toBe(6);
  });

  it("a ship that holds keeps its tile against any attacker", () => {
    const teams = makeTeams({ 0: { q: 2, r: 0 }, 1: { q: 1, r: 0 } });
    const out = resolveRound(
      input({ tiles: flatTiles(), teams, roundScore: [999, 1, 0, 0, 0, 0], dests: ["1,0", null, null, null, null, null] }),
    );
    expect(out.teams[1].pos).toEqual({ q: 1, r: 0 });
    expect(out.teams[0].pos).toEqual({ q: 2, r: 0 });
    expect(out.moves[0].clashAt).toEqual({ q: 1, r: 0 });
  });

  it("ships never end on the same tile (300 random rounds)", () => {
    const rng = mulberry32(77);
    for (let n = 0; n < 300; n++) {
      const all = hexDisk(3).filter((h) => distance(h, ORIGIN) > 0);
      const starts: Record<number, { q: number; r: number }> = {};
      const pool = all.slice();
      for (let i = 0; i < 6; i++) starts[i] = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      const out = resolveRound(
        input({
          tiles: flatTiles(),
          teams: makeTeams(starts),
          mp: [0, 1, 2, 3, 4, 5].map(() => 1 + Math.floor(rng() * 4)),
          roundScore: [0, 1, 2, 3, 4, 5].map(() => Math.floor(rng() * 3) * 100),
          dests: [0, 1, 2, 3, 4, 5].map(() => key(all[Math.floor(rng() * 8)])),
          rng: mulberry32(n),
        }),
      );
      expect(new Set(out.teams.map((t) => key(t.pos))).size).toBe(6);
      for (const m of out.moves) expect(m.path[0]).toEqual(starts[m.teamId]);
    }
  });

  it("two teams painting the same tile: the higher round score keeps it", () => {
    // Both pass through (0,3) on the way to different destinations.
    const teams = makeTeams({ 0: { q: 1, r: 3 }, 1: { q: 0, r: 4 } });
    const out = resolveRound(
      input({
        tiles: flatTiles(),
        teams,
        roundScore: [100, 800, 0, 0, 0, 0],
        dests: ["-1,3", "0,2", null, null, null, null],
        mp: [2, 2, 0, 0, 0, 0],
      }),
    );
    expect(out.moves[0].path.map(key)).toContain("0,3");
    expect(out.moves[1].path.map(key)).toContain("0,3");
    expect(tileAt(out.tiles, 0, 3).owner).toBe(1);
    expect(out.moves[0].painted).not.toContain("0,3");
  });

  it("enemy tiles flip to the mover, but homes never do", () => {
    const tiles = flatTiles();
    tileAt(tiles, 5, 0).owner = 3;
    const out = resolveRound(input({ tiles, teams: makeTeams(), dests: ["5,0", null, null, null, null, null] }));
    expect(tileAt(out.tiles, 5, 0).owner).toBe(0);
    // Team 0 next to team 1's home can't enter it.
    const out2 = resolveRound(
      input({ tiles: flatTiles(), teams: makeTeams({ 0: { q: 0, r: 5 } }), dests: ["0,6", null, null, null, null, null] }),
    );
    expect(out2.teams[0].pos).toEqual({ q: 0, r: 5 });
  });

  it("chest pickup gives a card; a full hand replaces the oldest", () => {
    const tiles = flatTiles();
    tileAt(tiles, 5, 0).chest = true;
    const teams = makeTeams();
    const out = resolveRound(input({ tiles, teams, dests: ["5,0", null, null, null, null, null] }));
    expect(out.moves[0].pickup).toBeDefined();
    expect(out.teams[0].cards).toEqual([out.moves[0].pickup]);
    expect(tileAt(out.tiles, 5, 0).chest).toBeUndefined();
    expect(giveCard(["hook", "rehearsed"], "micdrop")).toEqual(["rehearsed", "micdrop"]);
    expect(giveCard([], "hook")).toEqual(["hook"]);
  });

  it("ending on a swamp queues −1 MP; passing through or sitting still doesn't", () => {
    const tiles = flatTiles();
    tileAt(tiles, 5, 0).type = "swamp";
    const end = resolveRound(input({ tiles, teams: makeTeams(), dests: ["5,0", null, null, null, null, null] }));
    expect(end.teams[0].pendingMods).toEqual([{ kind: "swamp", delta: -1 }]);
    expect(end.moves[0].swamp).toBe(true);
    const through = resolveRound(input({ tiles, teams: makeTeams(), dests: ["4,0", null, null, null, null, null] }));
    expect(through.teams[0].pendingMods).toEqual([]);
    const sit = resolveRound(input({ tiles, teams: makeTeams({ 0: { q: 5, r: 0 } }) }));
    expect(sit.teams[0].pendingMods).toEqual([]);
  });
});

/* ---------- 7 cards ---------- */

describe("power cards (7)", () => {
  const withCard = (card: CardId, team = 0) => {
    const teams = makeTeams();
    teams[team].cards = [card];
    return teams;
  };
  const play = (card: CardId, team = 0) => {
    const cards: (CardId | null)[] = [null, null, null, null, null, null];
    cards[team] = card;
    return cards;
  };

  it("Strong Hook: +1 MP next round, card is spent", () => {
    const out = resolveRound(input({ tiles: flatTiles(), teams: withCard("hook"), cards: play("hook") }));
    expect(out.teams[0].pendingMods).toEqual([{ kind: "hook", delta: 1 }]);
    expect(out.teams[0].cards).toEqual([]);
    expect(out.moves[0].cardFx).toEqual([{ card: "hook" }]);
  });

  it("a team can't play a card it doesn't hold", () => {
    const out = resolveRound(input({ tiles: flatTiles(), teams: makeTeams(), cards: play("hook") }));
    expect(out.teams[0].pendingMods).toEqual([]);
  });

  it("Rehearsed: your tiles can't be stolen this round", () => {
    const tiles = flatTiles();
    tileAt(tiles, 5, 0).owner = 1;
    const teams = withCard("rehearsed", 1);
    const out = resolveRound(
      input({ tiles, teams, dests: ["4,0", null, null, null, null, null], cards: play("rehearsed", 1) }),
    );
    expect(tileAt(out.tiles, 5, 0).owner).toBe(1); // passed through, not flipped
    expect(tileAt(out.tiles, 4, 0).owner).toBe(0);
    const without = resolveRound(input({ tiles, teams: makeTeams(), dests: ["4,0", null, null, null, null, null] }));
    expect(tileAt(without.tiles, 5, 0).owner).toBe(0);
  });

  it("Heckler: the score leader gets −1 MP next round, unless that's you", () => {
    const teams = withCard("heckler");
    teams[3].score = 200;
    const out = resolveRound(input({ tiles: flatTiles(), teams, cards: play("heckler") }));
    expect(out.teams[3].pendingMods).toEqual([{ kind: "heckler", delta: -1 }]);
    expect(out.moves[0].cardFx).toEqual([{ card: "heckler", target: 3 }]);

    const leader = withCard("heckler");
    leader[0].score = 500;
    const kept = resolveRound(input({ tiles: flatTiles(), teams: leader, cards: play("heckler") }));
    expect(kept.teams.every((t) => t.pendingMods.length === 0)).toBe(true);
    expect(kept.teams[0].cards).toEqual(["heckler"]); // not spent
    expect(hecklerTarget([{ id: 0, score: 5 }, { id: 1, score: 5 }], 0)).toBe(1);
  });

  it("Mic Drop: claims the 6 neighbours of the landing tile except protected ones", () => {
    const tiles = flatTiles();
    tileAt(tiles, 3, 1).type = "water";
    tileAt(tiles, 4, -1).owner = 2;
    tileAt(tiles, 2, 1).owner = 4;
    const teams = withCard("micdrop");
    teams[4].cards = ["rehearsed"];
    const cards = play("micdrop");
    cards[4] = "rehearsed";
    const out = resolveRound(input({ tiles, teams, dests: ["3,0", null, null, null, null, null], cards }));
    const around = neighbors({ q: 3, r: 0 }).map(key);
    const fx = out.moves[0].cardFx.find((f) => f.card === "micdrop");
    expect(fx && fx.card === "micdrop" && fx.tiles.length).toBe(4);
    expect(tileAt(out.tiles, 3, 1).owner).toBeUndefined(); // water
    expect(tileAt(out.tiles, 2, 1).owner).toBe(4); // shielded
    expect(tileAt(out.tiles, 4, -1).owner).toBe(0); // stolen
    expect(around.filter((k) => out.tiles.find((t) => key(t) === k)!.owner === 0).length).toBe(4);
  });

  it("Mic Drop next to the Stage never claims the Stage", () => {
    const teams = makeTeams({ 0: { q: 2, r: 0 } });
    teams[0].cards = ["micdrop"];
    const out = resolveRound(input({ tiles: flatTiles(), teams, dests: ["1,0", null, null, null, null, null], cards: play("micdrop") }));
    expect(tileAt(out.tiles, 0, 0).owner).toBeUndefined();
  });
});

/* ---------- 6 spotlight ---------- */

describe("spotlight scoring (6)", () => {
  const r = (n: number): Rating => ({ hook: n, clarity: n, confidence: n });

  it("MP bands, with a minimum of 1 for speaking", () => {
    expect(mpFromSpotlight(4.2)).toBe(4);
    expect(mpFromSpotlight(4.19)).toBe(3);
    expect(mpFromSpotlight(3.5)).toBe(3);
    expect(mpFromSpotlight(2.5)).toBe(2);
    expect(mpFromSpotlight(2.49)).toBe(1);
    expect(mpFromSpotlight(1)).toBe(1);
  });

  it("averages per team first, so a big team has no extra say", () => {
    const res = speakerResult({ 1: [r(5), r(5), r(5), r(5), r(5), r(5)], 2: [r(1)] });
    expect(res.overall).toBe(3);
    expect(res.trimmed).toBe(false);
  });

  it("drops the highest and lowest team averages when 5 or more teams rated", () => {
    const res = speakerResult({ 1: [r(1)], 2: [r(3)], 3: [r(3)], 4: [r(4)], 5: [r(5)] });
    expect(res.trimmed).toBe(true);
    expect(res.overall).toBeCloseTo((3 + 3 + 4) / 3);
    const four = speakerResult({ 1: [r(1)], 2: [r(3)], 3: [r(3)], 4: [r(5)] });
    expect(four.trimmed).toBe(false);
    expect(four.overall).toBe(3);
  });

  it("keeps the three criteria separate", () => {
    const res = speakerResult({ 1: [{ hook: 5, clarity: 3, confidence: 1 }], 2: [{ hook: 3, clarity: 3, confidence: 3 }] });
    expect(res.hook).toBe(4);
    expect(res.clarity).toBe(3);
    expect(res.confidence).toBe(2);
    expect(res.overall).toBe(3);
  });

  it("no ratings → null result", () => {
    expect(speakerResult({}).overall).toBeNull();
  });

  it("Fair Judge: within 0.5 of the room for both speakers", () => {
    const a = speakerResult({ 2: [r(4)], 3: [r(4)], 4: [r(2)] }); // room 3.33
    const b = speakerResult({ 2: [r(3)], 3: [r(5)], 4: [r(3)] }); // room 3.67
    expect(isFairJudge([a, b], 2)).toBe(false); // 0.67 off on both
    expect(isFairJudge([a, b], 3)).toBe(false); // fine on A, 1.33 off on B
    const c = speakerResult({ 2: [r(4)], 3: [r(4)], 4: [r(3)] }); // room 3.67
    const d = speakerResult({ 2: [r(3)], 3: [r(3)], 4: [r(3)] }); // room 3
    expect(isFairJudge([c, d], 2)).toBe(true);
    expect(isFairJudge([c, d], 4)).toBe(false);
    expect(isFairJudge([c, d], 5)).toBe(false); // didn't rate
  });
});

/* ---------- 8 final ---------- */

describe("final showdown (8)", () => {
  const perQ = (passed: boolean[], acc?: number[], med?: (number | null)[]) => ({
    passed,
    accuracy: acc ?? passed.map((p) => (p ? 1 : 0)),
    medianMs: med ?? passed.map(() => 1000),
  });

  it("bottom three on score get the comeback boost", () => {
    const teams = makeTeams();
    [50, 10, 40, 20, 60, 30].forEach((s, i) => (teams[i].score = s));
    expect(bottomTeams(teams).sort()).toEqual([1, 3, 5]);
  });

  it("claims 2 tiles per passed question (3 for the bottom three), adjacent and closest to the Stage first", () => {
    const tiles = flatTiles();
    const teams = makeTeams();
    teams.forEach((t) => (tileAt(tiles, t.home.q, t.home.r).owner = t.id));
    const all = [true, true, true, true, true, true];
    const { claims, tiles: after } = finalClaims(tiles, teams, [perQ(all), perQ([true, false, false, false, false, false])], [3, 4, 5]);
    const count = (t: number) => claims.filter((c) => c.teamId === t).length;
    expect(count(0)).toBe(4);
    expect(count(1)).toBe(2);
    expect(count(3)).toBe(3);
    // Every claim extends territory toward the centre.
    const mine = claims.filter((c) => c.teamId === 0).map((c) => c.key);
    expect(mine).toEqual(["5,0", "4,0", "3,0", "2,0"]);
    expect(after.filter((t) => t.owner === 0).length).toBe(5);
    expect(after.find((t) => t.type === "stage")!.owner).toBeUndefined();
  });

  it("never claims water, the Stage or a home", () => {
    const tiles = flatTiles();
    const teams = makeTeams({});
    teams.forEach((t) => (tileAt(tiles, t.home.q, t.home.r).owner = t.id));
    for (const n of neighbors({ q: 6, r: 0 })) {
      const t = tiles.find((x) => x.q === n.q && x.r === n.r);
      if (t) t.type = "water";
    }
    const { claims } = finalClaims(tiles, teams, [perQ([true, false, false, false, false, false])], []);
    expect(claims.length).toBe(0);
  });

  it("the Stage goes to the most correct answers; fastest total time breaks ties", () => {
    const rng = mulberry32(1);
    const q = [
      perQ([true, true, false, false, false, false], [1, 1, 0, 0, 0, 0], [3000, 2000, null, null, null, null]),
      perQ([true, true, false, false, false, false], [1, 1, 0.4, 0, 0, 0], [3000, 2000, 500, null, null, null]),
    ];
    expect(stageWinner(q, 6, rng)).toBe(1);
    const clear = [perQ([true, false, false, false, false, false], [0.75, 0.5, 0, 0, 0, 0])];
    expect(stageWinner(clear, 6, rng)).toBe(0);
    expect(stageWinner([perQ([false, false, false, false, false, false])], 6, rng)).toBeNull();
  });
});

/* ---------- 9 scoring, awards, debrief ---------- */

describe("team score (9)", () => {
  it("tiles × 10 + region mastery × 50 + Stage 100", () => {
    const tiles = flatTiles();
    const teams = makeTeams();
    hexDisk(MAP_RADIUS)
      .filter((h) => distance(h, ORIGIN) >= 2)
      .slice(0, 5)
      .forEach((h) => (tileAt(tiles, h.q, h.r).owner = 0));
    let s = teamScores(tiles, teams, null);
    expect(s[0].tiles).toBe(5);
    expect(s[0].mastery).toEqual(["structure"]);
    expect(s[0].score).toBe(5 * 10 + 50);
    s = teamScores(tiles, teams, 0);
    expect(s[0].score).toBe(5 * 10 + 50 + 100);
    expect(s[1].score).toBe(0);
  });

  it("mastery needs at least 5 tiles and a strict lead", () => {
    const tiles = flatTiles();
    const teams = makeTeams();
    const land = tiles.filter((t) => t.type === "land");
    land.slice(0, 4).forEach((t) => (t.owner = 0));
    expect(teamScores(tiles, teams, null)[0].mastery).toEqual([]);
    land.slice(0, 5).forEach((t) => (t.owner = 0));
    land.slice(5, 10).forEach((t) => (t.owner = 1));
    const tied = teamScores(tiles, teams, null);
    expect(tied[0].mastery).toEqual([]);
    expect(tied[1].mastery).toEqual([]);
    land[10].owner = 1;
    expect(teamScores(tiles, teams, null)[1].mastery).toEqual(["structure"]);
  });

  it("counts regions separately and ignores the plaza for mastery", () => {
    const tiles = flatTiles();
    tiles.forEach((t, i) => (t.region = distance(t, ORIGIN) <= 1 ? "plaza" : REGIONS[i % 6]));
    tiles.filter((t) => t.region === "plaza" && t.type !== "stage").forEach((t) => (t.owner = 2));
    const s = teamScores(tiles, makeTeams(), null);
    expect(s[2].tiles).toBe(6);
    expect(s[2].mastery).toEqual([]);
    expect(s[2].score).toBe(60);
  });

  it("ranks with shared places on ties", () => {
    const ranked = rankTeams([
      { teamId: 0, score: 100, tiles: 10, mastery: [], stage: false },
      { teamId: 1, score: 300, tiles: 20, mastery: [], stage: true },
      { teamId: 2, score: 100, tiles: 10, mastery: [], stage: false },
    ]);
    expect(ranked.map((r) => [r.teamId, r.rank])).toEqual([[1, 1], [0, 2], [2, 2]]);
  });
});

describe("awards + debrief (9)", () => {
  const p = (id: string, stats: Partial<{ answered: number; correct: number; correctMs: number; ratings: number; ratingDev: number; spotlight: number }>) => ({
    id,
    name: id.toUpperCase(),
    teamId: 0 as TeamId,
    stats: { answered: 0, correct: 0, correctMs: 0, ratings: 0, ratingDev: 0, ...stats },
  });

  it("picks the four award winners", () => {
    const awards = computeAwards([
      p("ann", { answered: 12, correct: 10, correctMs: 60000, ratings: 4, ratingDev: 2 }),
      p("bob", { answered: 12, correct: 4, correctMs: 8000, ratings: 4, ratingDev: 0.4, spotlight: 3.2 }),
      p("cat", { answered: 12, correct: 1, correctMs: 500, ratings: 2, ratingDev: 3, spotlight: 4.6 }),
    ]);
    const by = Object.fromEntries(awards.map((a) => [a.key, a.playerId]));
    expect(by.speaker).toBe("cat");
    expect(by.quick).toBe("bob"); // cat's single lucky tap doesn't count once others have ≥3 correct
    expect(by.judge).toBe("bob");
    expect(by.master).toBe("ann");
  });

  it("handles an empty room", () => {
    const awards = computeAwards([]);
    expect(awards.length).toBe(4);
    expect(awards.every((a) => a.playerId === null)).toBe(true);
  });

  it("debrief finds the strongest and weakest criteria and the worst questions' takeaways", () => {
    const crit = {
      structure: { correct: 9, total: 10 },
      visuals: { correct: 5, total: 10 },
      delivery: { correct: 2, total: 10 },
      engagement: { correct: 7, total: 10 },
      timing: { correct: 6, total: 10 },
      qa: { correct: 0, total: 0 },
    };
    const d = computeDebrief(
      crit,
      { S1: { correct: 9, total: 10 }, D1: { correct: 2, total: 10 }, V2: { correct: 5, total: 10 }, T1: { correct: 6, total: 10 } },
      { hook: 8, clarity: 6, confidence: 7, n: 2 },
    );
    expect(d.strongest).toBe("structure");
    expect(d.weakest).toBe("delivery");
    expect(d.criteria.qa).toBeNull();
    expect(d.criteria.visuals).toBe(0.5);
    expect(d.takeaways.length).toBe(3);
    expect(d.takeaways[0]).toMatch(/pause/i);
    expect(d.spotlight).toEqual({ hook: 4, clarity: 3, confidence: 3.5 });
  });

  it("debrief still gives three takeaways with no data", () => {
    const zero = { correct: 0, total: 0 };
    const d = computeDebrief(
      { structure: zero, visuals: zero, delivery: zero, engagement: zero, timing: zero, qa: zero },
      {},
      { hook: 0, clarity: 0, confidence: 0, n: 0 },
    );
    expect(d.takeaways.length).toBe(3);
    expect(d.strongest).toBeNull();
    expect(d.spotlight).toBeNull();
  });
});
