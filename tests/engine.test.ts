import { describe, expect, it } from "vitest";
import { MAP_RADIUS, MIN_STEPS, ROUTE_MAX, ROUTE_MIN, TOTAL_ROUNDS } from "@/config/balance";
import { TEAM_DEFS } from "@/config/teams";
import { DUR, ROUNDS, TOTAL_MS } from "@/config/timeline";
import { QUESTION_BY_ID, QUESTIONS } from "@/content/questions";
import { SPOTLIGHT_TOPICS } from "@/content/spotlight";
import { computeDebrief } from "@/lib/engine/debrief";
import {
  addPlayer,
  advancePhase,
  buildPublic,
  createGame,
  currentPhase,
  elapsedMs,
  isOver,
  pauseGame,
  remaining,
  resumeGame,
  startGame,
  submitAnswer,
  submitRating,
  submitVote,
  syncToClock,
} from "@/lib/engine/game";
import { corners, distance, hexDisk, key, ORIGIN, wedgeOf } from "@/lib/engine/hex";
import { generateMap, isConnected, rotate, routeLength } from "@/lib/engine/mapgen";
import { homesOf, indexTiles, reachable, shortestPath } from "@/lib/engine/pathfinding";
import { resolveRound, type ResolveInput } from "@/lib/engine/resolve";
import { makeRoomCode, mulberry32, normalizeRoomCode } from "@/lib/engine/rng";
import { planPath, reachableFor, stepsToGo, suggestMove } from "@/lib/engine/route";
import { audienceResult, groundDocked, moveOrder, rankTeams, scoreManual, scoreQuestion, stepsFromAccuracy, stepsFromPitch } from "@/lib/engine/scoring";
import { speakerResult } from "@/lib/engine/spotlight";
import { buildTimeline, phaseIndexAt, TIMELINE, TIMELINE_TOTAL_MS } from "@/lib/engine/timeline";
import type { GameState, Rating, Team, TeamId, Tile } from "@/lib/engine/types";

const T0 = 1_700_000_000_000;

/* ---------- timeline ---------- */

describe("timeline", () => {
  it("sums to exactly 900,000 ms (15:00)", () => {
    expect(TIMELINE_TOTAL_MS).toBe(900_000);
    expect(TOTAL_MS).toBe(900_000);
    expect(buildTimeline().reduce((s, p) => s + p.durationMs, 0)).toBe(900_000);
  });

  it("has contiguous offsets and unique ids", () => {
    let offset = 0;
    for (const p of TIMELINE) {
      expect(p.startOffsetMs).toBe(offset);
      offset += p.durationMs;
    }
    expect(new Set(TIMELINE.map((p) => p.id)).size).toBe(TIMELINE.length);
  });

  it("gives pitching the time and keeps the move decision short", () => {
    expect(ROUNDS).toEqual(["question", "spotlight", "question", "spotlight", "question", "spotlight"]);
    expect(DUR.spotReady).toBeGreaterThanOrEqual(45);
    expect(DUR.spotSpeak).toBeGreaterThanOrEqual(40);
    expect(DUR.challenge).toBeGreaterThanOrEqual(40);
    expect(DUR.vote).toBeLessThanOrEqual(15);
    // Two pitches in each of three pitch rounds = one pitch per team.
    expect(TIMELINE.filter((p) => p.kind === "spotSpeak").length).toBe(6);
  });

  it("phaseIndexAt maps clock time to phases", () => {
    expect(phaseIndexAt(0)).toBe(0);
    expect(TIMELINE[phaseIndexAt(40_000)].id).toBe("r1-challenge");
    expect(TIMELINE[phaseIndexAt(899_999)].kind).toBe("debrief");
    expect(phaseIndexAt(900_000)).toBe(TIMELINE.length);
  });
});

/* ---------- map ---------- */

describe("map", () => {
  it("is small: radius 4, 61 hexes, homes on the six corners", () => {
    expect(hexDisk(MAP_RADIUS).length).toBe(61);
    const homes = corners(MAP_RADIUS);
    for (const h of homes) expect(distance(h, ORIGIN)).toBe(4);
    homes.forEach((h, i) => expect(wedgeOf(h)).toBe(i));
  });

  it("is identical for every team, and the route is never longer than the guaranteed steps (60 seeds)", () => {
    expect(ROUTE_MAX).toBeLessThanOrEqual(MIN_STEPS * TOTAL_ROUNDS);
    for (let seed = 1; seed <= 60; seed++) {
      const { tiles } = generateMap(seed * 7919);
      const at = new Map(tiles.map((t) => [key(t), t]));
      for (const t of tiles) {
        const r = at.get(key(rotate(t)))!;
        expect([r.type, r.key !== undefined, !!r.star]).toEqual([t.type, t.key !== undefined, !!t.star]);
        // Each key belongs to the team from the opposite island.
        if (t.key !== undefined) expect(t.key).toBe((wedgeOf(t) + 3) % 6);
        expect(["land", "water", "plaza", "stage"]).toContain(t.type);
      }
      expect(isConnected(tiles)).toBe(true);
      expect(tiles.map((t) => t.key).filter((k) => k !== undefined).sort()).toEqual([0, 1, 2, 3, 4, 5]);
      expect(tiles.filter((t) => t.star).length).toBe(6);
      expect(tiles.filter((t) => t.type === "water").length).toBe(12);
      const lengths = [0, 1, 2, 3, 4, 5].map((id) => routeLength(tiles, id as TeamId));
      expect(new Set(lengths).size).toBe(1);
      expect(lengths[0]).toBeGreaterThanOrEqual(ROUTE_MIN);
      expect(lengths[0]).toBeLessThanOrEqual(ROUTE_MAX);
    }
  });

  it("is deterministic for a seed", () => {
    expect(generateMap(42).tiles).toEqual(generateMap(42).tiles);
  });
});

/* ---------- fixtures ---------- */

function flatTiles(): Tile[] {
  return hexDisk(MAP_RADIUS).map((h) => ({ q: h.q, r: h.r, type: distance(h, ORIGIN) === 0 ? "stage" : "land", region: "structure", height: 1 }));
}
function makeTeams(pos?: Partial<Record<number, { q: number; r: number }>>): Team[] {
  return corners(MAP_RADIUS).map((home, i) => ({ id: i as TeamId, name: `T${i}`, color: "#fff", emblem: "x", home, pos: pos?.[i] ?? home, score: 0, hasKey: false, stars: 0, docked: null }));
}
const tileAt = (tiles: Tile[], q: number, r: number) => tiles.find((t) => t.q === q && t.r === r)!;
function input(over: Partial<ResolveInput> & { teams: Team[]; tiles: Tile[] }): ResolveInput {
  return { steps: [3, 3, 3, 3, 3, 3], order: [0, 1, 2, 3, 4, 5], dests: [null, null, null, null, null, null], dockCount: 0, ...over };
}

/* ---------- movement ---------- */

describe("pathfinding", () => {
  const teams = makeTeams();
  const rules = { teamId: 0 as TeamId, homes: homesOf(teams) };

  it("every step costs 1; water is impassable", () => {
    const tiles = flatTiles();
    tileAt(tiles, 3, 1).type = "water";
    const idx = indexTiles(tiles);
    const one = reachable(idx, { q: 4, r: 0 }, 1, rules);
    expect(one.map((r) => r.key)).not.toContain("3,1");
    expect(one.every((r) => r.cost === 1)).toBe(true);
    expect(reachable(idx, { q: 2, r: 0 }, 2, rules).length).toBe(16); // 18 minus the water hex and the locked Stage
  });

  it("the Stage is locked without a key, and the journey ends there", () => {
    const idx = indexTiles(flatTiles());
    const from = { q: 1, r: 0 };
    expect(reachable(idx, from, 3, rules).map((r) => r.key)).not.toContain("0,0");
    const withKey = reachable(idx, from, 3, { ...rules, allowStage: true });
    expect(withKey.map((r) => r.key)).toContain("0,0");
    expect(withKey.map((r) => r.key)).not.toContain("-2,0"); // can't fly through the Stage
  });

  it("another team's home is impassable; paths are deterministic", () => {
    const idx = indexTiles(flatTiles());
    expect(reachable(idx, { q: 0, r: 3 }, 1, rules).map((r) => r.key)).not.toContain("0,4");
    const a = shortestPath(idx, { q: 4, r: 0 }, { q: 1, r: 1 }, 4, rules)!;
    expect(a).toEqual(shortestPath(idx, { q: 4, r: 0 }, { q: 1, r: 1 }, 4, rules));
    expect(a.length).toBe(4);
  });
});

describe("easy moves: key-aware routes and the suggested move", () => {
  it("flies over the key on the way when that fits, so no move is wasted stopping on it", () => {
    const tiles = flatTiles();
    tileAt(tiles, 2, 0).key = 0;
    const idx = indexTiles(tiles);
    const team = makeTeams({ 0: { q: 3, r: 0 } })[0];
    const homes = homesOf(makeTeams());
    // Key is 1 step away and the Stage 2 beyond it: reachable in one 3-step move.
    expect(reachableFor(idx, team, 3, homes, { q: 2, r: 0 }).map((r) => r.key)).toContain("0,0");
    const path = planPath(idx, team, ORIGIN, 3, homes, { q: 2, r: 0 })!;
    expect(path.map(key)).toEqual(["3,0", "2,0", "1,0", "0,0"]);
    // With only 2 steps the Stage is out of reach.
    expect(reachableFor(idx, team, 2, homes, { q: 2, r: 0 }).map((r) => r.key)).not.toContain("0,0");
  });

  it("the suggested move always gets closer to the goal", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { tiles } = generateMap(seed * 31);
      const idx = indexTiles(tiles);
      const teams = makeTeams();
      const homes = homesOf(teams);
      for (const team of teams) {
        const keyHex = tiles.find((t) => t.key === team.id)!;
        const before = stepsToGo(idx, team, team.pos, false, homes, keyHex);
        const dest = suggestMove(idx, team, 2, homes, keyHex);
        expect(dest).not.toBe("hold");
        const [q, r] = dest.split(",").map(Number);
        const path = planPath(idx, team, { q, r }, 2, homes, keyHex)!;
        const gotKey = path.some((h) => key(h) === key(keyHex));
        expect(stepsToGo(idx, team, { q, r }, gotKey, homes, keyHex)).toBe(before - 2);
      }
    }
  });
});

describe("move resolution", () => {
  it("moves a ship along its path without changing the inputs", () => {
    const tiles = flatTiles();
    const teams = makeTeams();
    const out = resolveRound(input({ tiles, teams, dests: ["2,0", null, null, null, null, null] }));
    expect(out.teams[0].pos).toEqual({ q: 2, r: 0 });
    expect(out.moves[0].path.length).toBe(3);
    expect(teams[0].pos).toEqual({ q: 4, r: 0 });
  });

  it("holds with no destination, no steps or an unreachable destination", () => {
    const out = resolveRound(input({ tiles: flatTiles(), teams: makeTeams(), steps: [0, 3, 1, 3, 3, 3], dests: ["3,0", null, "0,0", null, null, null] }));
    for (const m of out.moves) expect(m.path.length).toBe(1);
  });

  it("ships never block each other: two can land on the same hex", () => {
    const teams = makeTeams({ 0: { q: 2, r: 0 }, 1: { q: 0, r: 2 }, 2: { q: 1, r: 1 } });
    const out = resolveRound(input({ tiles: flatTiles(), teams, dests: ["1,1", "1,1", null, null, null, null], steps: [2, 2, 0, 0, 0, 0] }));
    expect(out.teams[0].pos).toEqual({ q: 1, r: 1 });
    expect(out.teams[1].pos).toEqual({ q: 1, r: 1 });
    expect(out.teams[2].pos).toEqual({ q: 1, r: 1 });
    expect(out.moves.map((m) => m.teamId)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("your own key is picked up; another team's key is left; the first ship over a star takes it", () => {
    const tiles = flatTiles();
    tileAt(tiles, 3, 0).key = 0;
    tileAt(tiles, 2, 0).key = 3;
    tileAt(tiles, 1, 1).star = true;
    const teams = makeTeams({ 0: { q: 4, r: 0 }, 1: { q: 0, r: 2 }, 2: { q: 2, r: 1 } });
    const out = resolveRound(input({ tiles, teams, order: [2, 1, 0, 3, 4, 5], dests: ["2,0", "1,1", "1,1", null, null, null] }));
    expect(out.teams[0].hasKey).toBe(true);
    expect(tileAt(out.tiles, 3, 0).key).toBeUndefined();
    expect(tileAt(out.tiles, 2, 0).key).toBe(3); // someone else's key stays where it is
    expect(out.teams[0].score).toBe(10);
    // Team 2 moved before team 1, so it got the star.
    expect(out.teams[2].stars).toBe(1);
    expect(out.teams[1].stars).toBe(0);
  });

  it("docking at the Stage needs a key and pays by arrival order", () => {
    const teams = makeTeams({ 0: { q: 1, r: 0 }, 1: { q: 0, r: 1 }, 2: { q: -1, r: 1 } });
    teams[0].hasKey = teams[1].hasKey = true;
    const out = resolveRound(input({ tiles: flatTiles(), teams, order: [1, 0, 2, 3, 4, 5], dests: ["0,0", "0,0", "0,0", null, null, null], steps: [2, 2, 2, 0, 0, 0] }));
    expect(out.teams[1].docked).toBe(1);
    expect(out.teams[0].docked).toBe(2);
    expect(out.teams[2].docked).toBeNull(); // no key
    expect(out.teams[1].score).toBe(50);
    expect(out.teams[0].score).toBe(40);
    const next = resolveRound(input({ tiles: out.tiles, teams: out.teams, dests: ["1,0", null, null, null, null, null], dockCount: out.dockCount }));
    expect(next.teams[0].pos).toEqual({ q: 0, r: 0 }); // docked ships stay put
  });
});

/* ---------- scoring ---------- */

describe("steps, points and move order", () => {
  it("question: half the team right earns 3 steps, otherwise 2 — never less", () => {
    expect([0, 0.2, 0.49, 0.5, 0.8, 1].map(stepsFromAccuracy)).toEqual([2, 2, 2, 3, 3, 3]);
  });

  it("a team of 1 is exactly as strong as a team of 8", () => {
    const r = scoreQuestion([
      { teamId: 0, members: 1, correct: 1 },
      { teamId: 1, members: 8, correct: 8 },
      { teamId: 2, members: 4, correct: 2 },
      { teamId: 3, members: 4, correct: 1 },
      { teamId: 4, members: 0, correct: 0 },
      { teamId: 5, members: 5, correct: 0 },
    ]);
    expect(r.map((x) => x.steps)).toEqual([3, 3, 3, 2, 2, 2]);
    expect(r.map((x) => x.points)).toEqual([30, 30, 30, 20, 20, 20]);
  });

  it("pitch: great 4, good 3, otherwise 2; the audience moves 2 and earns points for marking", () => {
    expect([1, 2.9, 3, 3.9, 4, 5].map(stepsFromPitch)).toEqual([2, 2, 3, 3, 4, 4]);
    expect(audienceResult(false)).toEqual({ steps: 2, points: 20 });
    expect(audienceResult(true)).toEqual({ steps: 2, points: 30 });
  });

  it("Manual Mode: got it / didn't, unset counts as got it", () => {
    expect(scoreManual([true, false, null, true, false, null]).map((r) => r.steps)).toEqual([3, 2, 3, 3, 2, 3]);
  });

  it("docked ships get no steps; the team with the most points moves first", () => {
    const teams = makeTeams();
    teams[5].docked = 1;
    expect(groundDocked(scoreManual([null, null, null, null, null, null]), teams).map((r) => r.steps)).toEqual([3, 3, 3, 3, 3, 0]);
    [10, 50, 30, 50, 0, 90].forEach((s, i) => (teams[i].score = s));
    const order = moveOrder(teams, mulberry32(3));
    expect(order.slice(0, 2).sort()).toEqual([1, 3]);
    expect(order.slice(2)).toEqual([2, 0, 4, 5]);
    expect(moveOrder(teams, mulberry32(3))).toEqual(order);
  });

  it("ranks by score with shared places", () => {
    const teams = makeTeams();
    [30, 90, 30, 10, 0, 0].forEach((s, i) => (teams[i].score = s));
    expect(rankTeams(teams).map((t) => [t.id, t.rank])).toEqual([[1, 1], [0, 2], [2, 2], [3, 4], [4, 5], [5, 5]]);
  });

  it("pitch marks are averaged per team, and the extremes are trimmed when 5+ teams mark", () => {
    const r = (n: number): Rating => ({ hook: n, clarity: n, confidence: n });
    expect(speakerResult({ 1: [r(5), r(5), r(5), r(5)], 2: [r(1)] }).overall).toBe(3);
    const five = speakerResult({ 1: [r(1)], 2: [r(3)], 3: [r(3)], 4: [r(4)], 5: [r(5)] });
    expect(five.trimmed).toBe(true);
    expect(five.overall).toBeCloseTo(10 / 3);
    expect(speakerResult({}).overall).toBeNull();
  });
});

/* ---------- whole game ---------- */

function seeded(seed = 11, perTeam = [3, 1, 4, 2, 2, 5]): GameState {
  const state = createGame("TEST", seed);
  perTeam.forEach((n, team) => {
    for (let i = 0; i < n; i++) addPlayer(state, `p${team}-${i}`, `P${team}${i}`, team as TeamId);
  });
  return state;
}

function correctChoice(state: GameState): number {
  const { id, perm } = state.cur!.q!;
  return perm.indexOf(QUESTION_BY_ID[id].correct);
}

/** Play a phase. `votes` false means nobody touches the map, so ships fly the suggested route. */
function playPhase(state: GameState, rng: () => number, skill = 0.6, votes = true) {
  const phase = currentPhase(state)!;
  const players = Object.values(state.players);
  if (phase.kind === "challenge") {
    const right = correctChoice(state);
    for (const p of players) if (rng() > 0.1) submitAnswer(state, p.id, phase.id, rng() < skill ? right : (right + 1) % 4, T0);
  } else if (phase.kind === "vote" && votes) {
    for (const p of players) submitVote(state, p.id, phase.id, state.cur!.suggest![p.teamId]);
  } else if (phase.kind === "spotRate") {
    for (const p of players) {
      const s = () => 2 + Math.floor(rng() * 4);
      submitRating(state, p.id, phase.id, { hook: s(), clarity: s(), confidence: s() });
    }
  }
}

function playFullGame(seed: number, perTeam?: number[], skill?: number, votes = true): GameState {
  const state = seeded(seed, perTeam);
  const rng = mulberry32(seed);
  startGame(state, T0, 1);
  while (!isOver(state)) {
    playPhase(state, rng, skill, votes);
    JSON.stringify(buildPublic(state));
    advancePhase(state);
  }
  return state;
}

describe("the goal is always reachable", () => {
  it("every team that follows the suggested route reaches the Stage, even answering everything wrong", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const state = playFullGame(seed, [2, 2, 2, 2, 2, 2], 0);
      expect(state.teams.every((t) => t.docked !== null)).toBe(true);
    }
  });

  it("even if nobody touches a phone, every ship still reaches the Stage by itself", () => {
    for (let seed = 1; seed <= 15; seed++) {
      const state = playFullGame(seed, [0, 0, 0, 0, 0, 0], 0, false);
      expect(state.teams.every((t) => t.docked !== null && t.hasKey)).toBe(true);
    }
  });

  it("but good teams get there first, and nobody arrives before round 4", () => {
    const arrivals: Record<number, number> = {};
    for (let seed = 1; seed <= 40; seed++) {
      const state = seeded(seed, [3, 3, 3, 3, 3, 3]);
      const rng = mulberry32(seed);
      startGame(state, T0, 1);
      while (!isOver(state)) {
        const phase = currentPhase(state)!;
        playPhase(state, rng, 0.9);
        const before = state.dockCount;
        advancePhase(state);
        if (state.dockCount > before) arrivals[phase.round!] = (arrivals[phase.round!] ?? 0) + state.dockCount - before;
      }
    }
    expect(Math.min(...Object.keys(arrivals).map(Number))).toBeGreaterThanOrEqual(4);
    // Arrivals are spread out: even with strong groups, most ships are still flying after round 4.
    expect((arrivals[5] ?? 0) + (arrivals[6] ?? 0)).toBeGreaterThan((arrivals[4] ?? 0) * 1.5);
    expect(arrivals[5] ?? 0).toBeGreaterThan(0);
    expect(arrivals[6] ?? 0).toBeGreaterThan(0);
    console.info("arrivals by round over 40 games:", JSON.stringify(arrivals));
  });
});

describe("pitching: every team exactly once, in an order nobody knows in advance", () => {
  function pitchOrder(seed: number): TeamId[] {
    const state = seeded(seed);
    startGame(state, T0, 1);
    while (!isOver(state)) {
      if (currentPhase(state)!.kind === "spotReady") {
        const spot = state.cur!.spot!;
        // The wheel only ever offers teams that have not pitched yet.
        for (const t of spot.teams) expect(spot.pool).toContain(t);
        expect(spot.teams[0]).not.toBe(spot.teams[1]);
        expect(spot.topics[0]).not.toBe(spot.topics[1]);
        expect(spot.topics.every((t) => SPOTLIGHT_TOPICS.includes(t))).toBe(true);
        expect(buildPublic(state).spot!.topics).toEqual(spot.topics);
      }
      advancePhase(state);
    }
    return state.pitchOrder;
  }

  it("every team pitches once for 50 different seeds", () => {
    const orders = new Set<string>();
    for (let seed = 1; seed <= 50; seed++) {
      const order = pitchOrder(seed);
      expect(order.slice().sort()).toEqual([0, 1, 2, 3, 4, 5]);
      orders.add(order.join(""));
    }
    expect(orders.size).toBeGreaterThan(20); // the spin really does vary
  });

  it("each team gets its own topic", () => {
    const state = seeded(8);
    startGame(state, T0, 1);
    const topics: string[] = [];
    while (!isOver(state)) {
      if (currentPhase(state)!.kind === "spotReady") topics.push(...state.cur!.spot!.topics);
      advancePhase(state);
    }
    expect(new Set(topics).size).toBe(6);
  });

  it("self-team marking is impossible, and marking earns the audience bonus points", () => {
    const state = seeded(3, [2, 2, 2, 2, 2, 2]);
    startGame(state, T0, 1);
    while (currentPhase(state)!.kind !== "spotRate") advancePhase(state);
    const [a, b] = state.cur!.spot!.teams;
    const lazy = ([0, 1, 2, 3, 4, 5] as TeamId[]).find((t) => t !== a && t !== b)!;
    for (let slot = 0; slot < 2; slot++) {
      while (currentPhase(state)!.kind !== "spotRate") advancePhase(state);
      const phase = currentPhase(state)!;
      const speakerTeam = state.cur!.spot!.teams[slot];
      for (const p of Object.values(state.players)) {
        if (p.teamId === lazy) continue;
        expect(submitRating(state, p.id, phase.id, { hook: 9, clarity: 4, confidence: 4 })).toBe(p.teamId !== speakerTeam);
      }
      advancePhase(state);
    }
    while (currentPhase(state)!.kind !== "spotReveal") advancePhase(state);
    const res = state.cur!.teamResults!;
    expect(state.cur!.spot!.results![0].teamAverages[a]).toBeUndefined();
    expect(res[a].speaker).toBe(true);
    expect(res[a].steps).toBe(4); // (5+4+4)/3 ≥ 4
    expect(res[b].steps).toBe(4);
    expect([res[lazy].steps, res[lazy].points]).toEqual([2, 20]);
    for (const r of res) if (!r.speaker && r.teamId !== lazy) expect([r.steps, r.points]).toEqual([2, 30]);
  });
});

describe("full game", () => {
  it("runs to the end and produces results and a debrief", () => {
    const state = playFullGame(11);
    expect(state.usedQuestions.length).toBe(3);
    expect(new Set(state.usedQuestions).size).toBe(3);
    expect(state.results!.ranking.length).toBe(6);
    expect(state.debrief!.takeaways.length).toBe(3);
    expect(state.pitches.every((p) => p !== null)).toBe(true);
    expect(state.results!.bestPitch).not.toBeNull();
  });

  it("is deterministic and survives a snapshot at every phase", () => {
    expect(JSON.stringify(playFullGame(23))).toBe(JSON.stringify(playFullGame(23)));
    let state = seeded(5);
    const rng = mulberry32(5);
    startGame(state, T0, 1);
    while (!isOver(state)) {
      playPhase(state, rng);
      state = JSON.parse(JSON.stringify(state)) as GameState;
      advancePhase(state);
    }
    expect(state.results).toBeTruthy();
  });

  it("copes with teams of 1 and empty teams", () => {
    for (let seed = 1; seed <= 15; seed++) playFullGame(seed, [1, 0, 6, 1, 3, 0]);
  });

  it("points are added at the reveal and decide the move order", () => {
    const state = seeded(6, [2, 2, 2, 2, 2, 2]);
    startGame(state, T0, 1);
    advancePhase(state);
    const ch = currentPhase(state)!;
    const right = correctChoice(state);
    for (const p of Object.values(state.players)) submitAnswer(state, p.id, ch.id, p.teamId <= 1 ? right : (right + 1) % 4, T0);
    advancePhase(state);
    expect(state.teams.map((t) => t.score)).toEqual([30, 30, 20, 20, 20, 20]);
    expect(state.cur!.teamResults!.map((r) => r.steps)).toEqual([3, 3, 2, 2, 2, 2]);
    expect(state.cur!.order!.slice(0, 2).sort()).toEqual([0, 1]);
    const pub = buildPublic(state);
    expect(pub.teams[2].steps).toBe(2);
    advancePhase(state);
    expect(buildPublic(state).suggest!.length).toBe(6);
  });

  it("answers can be changed while the team discusses; the last one counts", () => {
    const state = seeded(6, [1, 1, 1, 1, 1, 1]);
    startGame(state, T0, 1);
    advancePhase(state);
    const ch = currentPhase(state)!;
    const right = correctChoice(state);
    expect(submitAnswer(state, "p0-0", ch.id, (right + 1) % 4, T0)).toBe(true);
    expect(submitAnswer(state, "p0-0", ch.id, right, T0)).toBe(true);
    expect(submitAnswer(state, "p0-0", "intro", right, T0)).toBe(false);
    expect(submitAnswer(state, "ghost", ch.id, right, T0)).toBe(false);
    expect(submitAnswer(state, "p0-0", ch.id, 9, T0)).toBe(false);
    advancePhase(state);
    expect(state.teams[0].score).toBe(30);
  });

  it("never sends the answer before the reveal", () => {
    const state = seeded(6);
    startGame(state, T0, 1);
    advancePhase(state);
    expect(JSON.stringify(buildPublic(state))).not.toContain("why");
    advancePhase(state);
    expect(buildPublic(state).reveal!.why.length).toBeGreaterThan(5);
  });

  it("votes: the majority can pick a different hex, or choose to stay", () => {
    const state = seeded(6, [5, 3, 1, 1, 1, 1]);
    startGame(state, T0, 1);
    advancePhase(state);
    advancePhase(state);
    advancePhase(state);
    const phase = currentPhase(state)!;
    expect(phase.kind).toBe("vote");
    const other = state.cur!.reach![0].find((r) => r.key !== state.cur!.suggest![0])!.key;
    expect(submitVote(state, "p0-0", phase.id, "0,0")).toBe(false); // not reachable yet
    for (const id of ["p0-0", "p0-1", "p0-2"]) submitVote(state, id, phase.id, other);
    submitVote(state, "p0-3", phase.id, "hold");
    for (const id of ["p1-0", "p1-1"]) submitVote(state, id, phase.id, "hold");
    advancePhase(state);
    expect(state.cur!.dests![0]).toBe(other);
    expect(state.cur!.dests![1]).toBeNull(); // team 1 chose to stay
    expect(state.cur!.dests![2]).toBe(state.cur!.suggest![2]); // no vote → suggested route
    expect(key(state.teams[0].pos)).toBe(other);
  });
});

describe("master clock", () => {
  it("ends at exactly 15:00, at any speed, and a late tick doesn't drift", () => {
    const state = seeded(9);
    startGame(state, T0, 1);
    expect(syncToClock(state, T0 + 39_999)).toBe(false);
    expect(syncToClock(state, T0 + 40_000)).toBe(true);
    syncToClock(state, T0 + 500_000);
    expect(remaining(state, T0 + 500_000).globalMs).toBe(400_000);
    syncToClock(state, T0 + 899_999);
    expect(isOver(state)).toBe(false);
    syncToClock(state, T0 + 900_000);
    expect(isOver(state)).toBe(true);

    const fast = seeded(9);
    startGame(fast, T0, 10);
    syncToClock(fast, T0 + 89_999);
    expect(isOver(fast)).toBe(false);
    syncToClock(fast, T0 + 90_000);
    expect(isOver(fast)).toBe(true);
  });

  it("pause extends the end by the paused time; a reloaded host resumes in the same place", () => {
    const state = seeded(9);
    startGame(state, T0, 1);
    pauseGame(state, T0 + 10_000);
    expect(elapsedMs(state, T0 + 70_000)).toBe(10_000);
    resumeGame(state, T0 + 70_000);
    syncToClock(state, T0 + 959_999);
    expect(isOver(state)).toBe(false);
    syncToClock(state, T0 + 960_000);
    expect(isOver(state)).toBe(true);

    const live = seeded(9);
    startGame(live, T0, 1);
    syncToClock(live, T0 + 100_000);
    const resumed = JSON.parse(JSON.stringify(live)) as GameState;
    syncToClock(resumed, T0 + 400_000);
    syncToClock(live, T0 + 400_000);
    expect(JSON.stringify(resumed)).toBe(JSON.stringify(live));
  });
});

describe("manual mode", () => {
  it("plays a whole game from facilitator clicks with no phones", () => {
    const state = createGame("MANU", 77);
    state.manualMode = true;
    startGame(state, T0, 1);
    while (!isOver(state)) {
      const phase = currentPhase(state)!;
      if (phase.kind === "reveal") state.manual.pass = [true, false, true, false, null, false];
      else if (phase.kind === "vote") state.manual.dests[0] = "hold"; // the operator parks team 0; the rest fly themselves
      else if (phase.kind === "spotRate") state.manual.stars[phase.meta!.slot as 0 | 1] = 5;
      advancePhase(state);
      if (phase.kind === "reveal") expect(state.cur!.teamResults!.map((r) => r.points)).toEqual([30, 20, 30, 20, 30, 20]);
    }
    expect(key(state.teams[0].pos)).toBe(key(state.teams[0].home));
    expect(state.teams.slice(1).every((t) => t.docked !== null)).toBe(true);
    // Re-scoring during the reveal must not double-count: 3 questions (30 each), 2 rounds in the
    // audience (30 each) and its own pitch at 5★ (40). Team 0 never moved, so no map bonuses.
    expect(state.teams[0].score).toBe(3 * 30 + 2 * 30 + 40);
    expect(state.debrief!.takeaways.length).toBe(3);
  });
});

describe("content and debrief", () => {
  it("teams are Group 1 to Group 6", () => {
    expect(TEAM_DEFS.map((t) => t.name)).toEqual(["Group 1", "Group 2", "Group 3", "Group 4", "Group 5", "Group 6"]);
    expect(createGame("ABCD", 1).teams.map((t) => t.name)).toEqual(TEAM_DEFS.map((t) => t.name));
  });

  it("every question has four options and a valid answer; there is a topic for every team", () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(6);
    for (const q of QUESTIONS) {
      expect(q.options.length).toBe(4);
      expect(q.correct).toBeGreaterThanOrEqual(0);
      expect(q.correct).toBeLessThan(4);
      expect(q.why.length).toBeGreaterThan(20);
    }
    expect(SPOTLIGHT_TOPICS.length).toBe(6);
    expect(SPOTLIGHT_TOPICS.every((t) => t.length > 15)).toBe(true);
  });

  it("debrief lists the hardest question first and the pitch strengths", () => {
    const d = computeDebrief(["P1", "P2", "P4"], { P1: { correct: 9, total: 10 }, P2: { correct: 2, total: 10 }, P4: { correct: 5, total: 10 } }, { hook: 8, clarity: 6, confidence: 7, n: 2 });
    expect(d.questions.map((q) => q.id)).toEqual(["P2", "P4", "P1"]);
    expect(d.strongest).toBe("hook");
    expect(d.weakest).toBe("clarity");
    expect(computeDebrief([], {}, { hook: 0, clarity: 0, confidence: 0, n: 0 }).takeaways.length).toBe(3);
  });

  it("room codes are 4 unambiguous capitals", () => {
    for (let i = 0; i < 100; i++) expect(makeRoomCode(mulberry32(i))).toMatch(/^[A-HJ-NP-Z]{4}$/);
    expect(normalizeRoomCode(" ab-cd ")).toBe("ABCD");
  });
});
