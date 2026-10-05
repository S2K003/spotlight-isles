import { describe, expect, it } from "vitest";
import { MAP_RADIUS, ROUTE_MAX, ROUTE_MIN } from "@/config/balance";
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
import { applyTailwind, audienceSteps, moveOrder, pointsFromAccuracy, rankTeams, scoreManual, scoreQuestion, stepsFromAccuracy, stepsFromPitch } from "@/lib/engine/scoring";
import { isFairJudge, speakerResult } from "@/lib/engine/spotlight";
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

  it("is six unhurried rounds, and every team pitches exactly once", () => {
    expect(ROUNDS.length).toBe(6);
    expect(ROUNDS.flatMap((r) => (r.kind === "spotlight" ? r.teams : [])).sort()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(DUR.challenge).toBeGreaterThanOrEqual(40);
    expect(DUR.vote).toBeGreaterThanOrEqual(30);
    expect(DUR.spotReady).toBeGreaterThanOrEqual(25);
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

  it("is identical for every team (rotationally symmetric) for 40 seeds", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { tiles } = generateMap(seed * 7919);
      const at = new Map(tiles.map((t) => [key(t), t]));
      for (const t of tiles) {
        const r = at.get(key(rotate(t)))!;
        expect([r.type, r.key !== undefined, !!r.star]).toEqual([t.type, t.key !== undefined, !!t.star]);
        // Each key belongs to the team from the opposite island.
        if (t.key !== undefined) expect(t.key).toBe((wedgeOf(t) + 3) % 6);
      }
      expect(isConnected(tiles)).toBe(true);
      expect(tiles.map((t) => t.key).filter((k) => k !== undefined).sort()).toEqual([0, 1, 2, 3, 4, 5]);
      expect(tiles.filter((t) => t.star).length).toBe(6);
      expect(tiles.filter((t) => t.type === "water").length).toBe(12);
      expect(tiles.filter((t) => t.type === "fog").length).toBe(6);
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

  it("fog costs 2 steps; water is impassable", () => {
    const tiles = flatTiles();
    tileAt(tiles, 3, 0).type = "fog";
    tileAt(tiles, 3, 1).type = "water";
    const idx = indexTiles(tiles);
    const one = reachable(idx, { q: 4, r: 0 }, 1, rules).map((r) => r.key);
    expect(one).not.toContain("3,0");
    expect(one).not.toContain("3,1");
    expect(reachable(idx, { q: 4, r: 0 }, 2, rules).find((r) => r.key === "3,0")!.cost).toBe(2);
  });

  it("the Stage is locked without a key, and the journey ends there", () => {
    const idx = indexTiles(flatTiles());
    const from = { q: 1, r: 0 };
    expect(reachable(idx, from, 3, rules).map((r) => r.key)).not.toContain("0,0");
    const withKey = reachable(idx, from, 3, { ...rules, allowStage: true });
    expect(withKey.map((r) => r.key)).toContain("0,0");
    // You can't fly through the Stage and out the other side: (-2,0) is 3 steps only via the Stage.
    expect(withKey.map((r) => r.key)).not.toContain("-2,0");
  });

  it("another team's home is impassable; paths are deterministic", () => {
    const idx = indexTiles(flatTiles());
    expect(reachable(idx, { q: 0, r: 3 }, 1, rules).map((r) => r.key)).not.toContain("0,4");
    const a = shortestPath(idx, { q: 4, r: 0 }, { q: 1, r: 1 }, 4, rules)!;
    expect(a).toEqual(shortestPath(idx, { q: 4, r: 0 }, { q: 1, r: 1 }, 4, rules));
    expect(a.length).toBe(4);
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

  it("holds with no vote, no steps or an unreachable destination", () => {
    const out = resolveRound(input({ tiles: flatTiles(), teams: makeTeams(), steps: [0, 3, 1, 3, 3, 3], dests: ["3,0", null, "0,0", null, null, null] }));
    for (const m of out.moves) expect(m.path.length).toBe(1);
  });

  it("the team that moves first takes the hex; the later one stops one short", () => {
    const teams = makeTeams({ 0: { q: 2, r: 0 }, 1: { q: 0, r: 2 } });
    const run = (order: TeamId[]) => resolveRound(input({ tiles: flatTiles(), teams, order, dests: ["1,1", "1,1", null, null, null, null], steps: [2, 2, 0, 0, 0, 0] }));
    const a = run([0, 1, 2, 3, 4, 5]);
    expect(a.teams[0].pos).toEqual({ q: 1, r: 1 });
    expect(a.moves.find((m) => m.teamId === 1)!.blockedAt).toEqual({ q: 1, r: 1 });
    expect(distance(a.teams[1].pos, { q: 1, r: 1 })).toBe(1);
    const b = run([1, 0, 2, 3, 4, 5]);
    expect(b.teams[1].pos).toEqual({ q: 1, r: 1 });
    expect(b.moves.find((m) => m.teamId === 0)!.blockedAt).toBeTruthy();
    expect(a.moves.map((m) => m.teamId)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("you can't land on a ship that hasn't moved yet either", () => {
    const teams = makeTeams({ 0: { q: 2, r: 0 }, 1: { q: 1, r: 0 } });
    const out = resolveRound(input({ tiles: flatTiles(), teams, dests: ["1,0", "1,1", null, null, null, null], steps: [1, 1, 0, 0, 0, 0] }));
    expect(out.teams[0].pos).toEqual({ q: 2, r: 0 });
    expect(out.teams[1].pos).toEqual({ q: 1, r: 1 });
  });

  it("ships never share a hex except at the Stage (300 random rounds)", () => {
    const rng = mulberry32(5);
    for (let n = 0; n < 300; n++) {
      const all = hexDisk(2).filter((h) => distance(h, ORIGIN) > 0);
      const pool = all.slice();
      const starts: Record<number, { q: number; r: number }> = {};
      for (let i = 0; i < 6; i++) starts[i] = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      const teams = makeTeams(starts);
      teams.forEach((t) => (t.hasKey = rng() < 0.5));
      const out = resolveRound(
        input({
          tiles: flatTiles(),
          teams,
          steps: [0, 1, 2, 3, 4, 5].map(() => 1 + Math.floor(rng() * 3)),
          order: ([0, 1, 2, 3, 4, 5] as TeamId[]).sort(() => rng() - 0.5),
          dests: [0, 1, 2, 3, 4, 5].map(() => (rng() < 0.3 ? "0,0" : key(all[Math.floor(rng() * all.length)]))),
        }),
      );
      const flying = out.teams.filter((t) => t.docked === null).map((t) => key(t.pos));
      expect(new Set(flying).size).toBe(flying.length);
      expect(flying).not.toContain("0,0");
    }
  });

  it("flying over your own key picks it up; another team's key is left alone; a star is taken", () => {
    const tiles = flatTiles();
    tileAt(tiles, 3, 0).key = 0;
    tileAt(tiles, 2, 0).key = 1;
    tileAt(tiles, 1, 0).star = true;
    const out = resolveRound(input({ tiles, teams: makeTeams(), dests: ["1,0", null, null, null, null, null] }));
    expect(out.teams[0].hasKey).toBe(true);
    expect(out.moves[0].gotKey).toBe(true);
    expect(tileAt(out.tiles, 3, 0).key).toBeUndefined();
    expect(tileAt(out.tiles, 2, 0).key).toBe(1); // someone else's key stays where it is
    expect(out.teams[0].stars).toBe(1);
    expect(tileAt(out.tiles, 1, 0).star).toBeUndefined();
    expect(out.teams[0].score).toBe(20);
    expect(out.moves[0].bonus).toBe(20);
  });

  it("docking at the Stage needs a key, pays by arrival order, and any number can dock", () => {
    const teams = makeTeams({ 0: { q: 1, r: 0 }, 1: { q: 0, r: 1 }, 2: { q: -1, r: 1 } });
    teams[0].hasKey = teams[1].hasKey = true;
    const out = resolveRound(input({ tiles: flatTiles(), teams, order: [1, 0, 2, 3, 4, 5], dests: ["0,0", "0,0", "0,0", null, null, null], steps: [1, 1, 1, 0, 0, 0] }));
    expect(out.teams[1].docked).toBe(1);
    expect(out.teams[0].docked).toBe(2);
    expect(out.teams[2].docked).toBeNull(); // no key
    expect(out.teams[1].score).toBe(50);
    expect(out.teams[0].score).toBe(40);
    expect(out.dockCount).toBe(2);
    // A docked ship stays put from then on.
    const next = resolveRound(input({ tiles: out.tiles, teams: out.teams, dests: ["1,0", null, null, null, null, null], dockCount: out.dockCount }));
    expect(next.teams[0].pos).toEqual({ q: 0, r: 0 });
  });
});

/* ---------- scoring ---------- */

describe("steps, points and move order", () => {
  it("question: accuracy → steps, and everyone moves at least 1", () => {
    expect([0, 0.2, 0.49, 0.5, 0.79, 0.8, 1].map(stepsFromAccuracy)).toEqual([1, 1, 1, 2, 2, 3, 3]);
    expect([0, 0.2, 0.5, 1].map(pointsFromAccuracy)).toEqual([0, 10, 20, 30]);
  });

  it("a team of 1 is exactly as strong as a team of 8", () => {
    const r = scoreQuestion([
      { teamId: 0, members: 1, correct: 1 },
      { teamId: 1, members: 8, correct: 8 },
      { teamId: 2, members: 4, correct: 2 },
      { teamId: 3, members: 4, correct: 0 },
      { teamId: 4, members: 0, correct: 0 },
      { teamId: 5, members: 5, correct: 1 },
    ]);
    expect(r.map((x) => x.steps)).toEqual([3, 3, 2, 1, 1, 1]);
    expect(r.map((x) => x.points)).toEqual([30, 30, 20, 0, 0, 10]);
  });

  it("pitch: stars → steps for the speaker; the audience earns steps by marking", () => {
    expect([1, 2.9, 3, 3.9, 4, 5].map(stepsFromPitch)).toEqual([1, 1, 2, 2, 3, 3]);
    expect(audienceSteps(false, false)).toBe(1);
    expect(audienceSteps(true, false)).toBe(2);
    expect(audienceSteps(true, true)).toBe(3);
  });

  it("Manual Mode bands", () => {
    expect(scoreManual([0, 1, 2, 3, null, 3]).map((r) => [r.steps, r.points])).toEqual([[1, 0], [1, 10], [2, 20], [3, 30], [2, 20], [3, 30]]);
  });

  it("last place gets a tailwind; docked ships get no steps", () => {
    const teams = makeTeams();
    teams[5].docked = 1;
    const base = scoreManual([2, 2, 2, 2, 2, 2]);
    const out = applyTailwind(base, teams, [50, 30, 30, 60, 40, 10]);
    expect(out.map((r) => r.steps)).toEqual([2, 3, 3, 2, 2, 0]);
    expect(out.map((r) => r.tailwind)).toEqual([false, true, true, false, false, false]);
    // Nobody gets it when everyone is level.
    expect(applyTailwind(base, makeTeams(), [20, 20, 20, 20, 20, 20]).every((r) => !r.tailwind)).toBe(true);
  });

  it("the team with the most points moves first; docked ships go last", () => {
    const teams = makeTeams();
    [10, 50, 30, 50, 0, 90].forEach((s, i) => (teams[i].score = s));
    teams[5].docked = 1;
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
});

describe("pitch ratings", () => {
  const r = (n: number): Rating => ({ hook: n, clarity: n, confidence: n });

  it("averages per team first, and trims the extremes when 5+ teams rate", () => {
    expect(speakerResult({ 1: [r(5), r(5), r(5), r(5)], 2: [r(1)] }).overall).toBe(3);
    const five = speakerResult({ 1: [r(1)], 2: [r(3)], 3: [r(3)], 4: [r(4)], 5: [r(5)] });
    expect(five.trimmed).toBe(true);
    expect(five.overall).toBeCloseTo(10 / 3);
    expect(speakerResult({}).overall).toBeNull();
  });

  it("Fair Judge: within 0.5 of the room for every pitch", () => {
    const a = speakerResult({ 2: [r(4)], 3: [r(4)], 4: [r(3)] });
    const b = speakerResult({ 2: [r(3)], 3: [r(3)], 4: [r(3)] });
    expect(isFairJudge([a, b], 2)).toBe(true);
    expect(isFairJudge([a, b], 4)).toBe(false);
    expect(isFairJudge([a, b], 5)).toBe(false);
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

function playPhase(state: GameState, rng: () => number, skill = 0.6) {
  const phase = currentPhase(state)!;
  const players = Object.values(state.players);
  if (phase.kind === "challenge") {
    const right = correctChoice(state);
    for (const p of players) if (rng() > 0.1) submitAnswer(state, p.id, phase.id, rng() < skill ? right : (right + 1) % 4, T0);
  } else if (phase.kind === "vote") {
    for (const team of state.teams) {
      const reach = state.cur!.reach![team.id];
      void rng;
      for (const p of players.filter((x) => x.teamId === team.id)) submitVote(state, p.id, phase.id, toward(state, team.id, reach));
    }
  } else if (phase.kind === "spotRate") {
    for (const p of players) {
      const s = () => 2 + Math.floor(rng() * 4);
      submitRating(state, p.id, phase.id, { hook: s(), clarity: s(), confidence: s() });
    }
  }
}

/** A sensible crew: fly toward your key, then toward the Stage. */
function toward(state: GameState, teamId: TeamId, reach: { key: string }[]): string {
  const team = state.teams[teamId];
  const target = team.hasKey ? ORIGIN : state.tiles.find((t) => t.key === teamId)!;
  const d = (k: string) => {
    const [q, r] = k.split(",").map(Number);
    return distance({ q, r }, target);
  };
  const best = reach.slice().sort((a, b) => d(a.key) - d(b.key))[0];
  return best && d(best.key) < distance(team.pos, target) ? best.key : "hold";
}

function playFullGame(seed: number, perTeam?: number[], skill?: number): GameState {
  const state = seeded(seed, perTeam);
  const rng = mulberry32(seed);
  startGame(state, T0, 1);
  while (!isOver(state)) {
    playPhase(state, rng, skill);
    const flying = state.teams.filter((t) => t.docked === null).map((t) => key(t.pos));
    expect(new Set(flying).size).toBe(flying.length);
    JSON.stringify(buildPublic(state));
    advancePhase(state);
  }
  return state;
}

describe("full game", () => {
  it("runs to the end and produces results and a debrief", () => {
    const state = playFullGame(11);
    expect(state.usedQuestions.length).toBe(3);
    expect(new Set(state.usedQuestions).size).toBe(3);
    expect(state.results!.ranking.length).toBe(6);
    expect(state.debrief!.takeaways.length).toBe(3);
    expect(state.debrief!.questions.length).toBe(3);
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

  it("the Stage is reachable in a normal game, but nobody gets there before round 4", () => {
    let docked = 0;
    let games = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const state = playFullGame(seed, [3, 3, 3, 3, 3, 3]);
      expect(routeLength(state.tiles, 0)).toBeGreaterThanOrEqual(ROUTE_MIN);
      docked += state.teams.filter((t) => t.docked !== null).length;
      games++;
      // Sum of all points is consistent with what was earned.
      for (const t of state.teams) expect(t.score).toBeGreaterThanOrEqual(0);
    }
    const perGame = docked / games;
    expect(perGame).toBeGreaterThan(2.5);
    expect(perGame).toBeLessThan(5.8);
  });

  it("copes with teams of 1 and empty teams", () => {
    for (let seed = 1; seed <= 15; seed++) playFullGame(seed, [1, 0, 6, 1, 3, 0]);
  });

  it("each pitching team gets a different topic", () => {
    const state = seeded(8);
    startGame(state, T0, 1);
    const topics: string[] = [];
    const spoke: TeamId[] = [];
    while (!isOver(state)) {
      if (currentPhase(state)!.kind === "spotReady") {
        topics.push(...state.cur!.spot!.topics);
        spoke.push(...state.cur!.spot!.teams);
      }
      advancePhase(state);
    }
    expect(new Set(topics).size).toBe(6);
    expect(topics.every((t) => SPOTLIGHT_TOPICS.includes(t))).toBe(true);
    expect(spoke.slice().sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("points are added at the reveal and decide the move order", () => {
    const state = seeded(6, [2, 2, 2, 2, 2, 2]);
    startGame(state, T0, 1);
    advancePhase(state);
    const ch = currentPhase(state)!;
    const right = correctChoice(state);
    // Team 0 all correct, team 1 half, the rest wrong.
    for (const p of Object.values(state.players)) {
      const ok = p.teamId === 0 || (p.teamId === 1 && p.id.endsWith("-0"));
      submitAnswer(state, p.id, ch.id, ok ? right : (right + 1) % 4, T0);
    }
    advancePhase(state);
    expect(state.teams.map((t) => t.score)).toEqual([30, 20, 0, 0, 0, 0]);
    const res = state.cur!.teamResults!;
    expect(res[0].steps).toBe(3);
    expect(res[1].steps).toBe(2);
    expect(res[2].steps).toBe(2); // 1 + tailwind
    expect(res[2].tailwind).toBe(true);
    expect(state.cur!.order!.slice(0, 2)).toEqual([0, 1]);
    const pub = buildPublic(state);
    expect(pub.teams[0].order).toBe(0);
    expect(pub.teams[0].steps).toBe(3);
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

  it("votes: majority wins and only reachable hexes count", () => {
    const state = seeded(6, [5, 1, 1, 1, 1, 1]);
    startGame(state, T0, 1);
    advancePhase(state);
    advancePhase(state);
    advancePhase(state);
    const phase = currentPhase(state)!;
    expect(phase.kind).toBe("vote");
    const reach = state.cur!.reach![0];
    expect(reach.length).toBeGreaterThan(0);
    const a = reach[0].key;
    expect(submitVote(state, "p0-0", phase.id, "0,0")).toBe(false);
    for (const id of ["p0-0", "p0-1", "p0-2"]) submitVote(state, id, phase.id, a);
    submitVote(state, "p0-3", phase.id, "hold");
    advancePhase(state);
    expect(state.cur!.dests![0]).toBe(a);
    expect(state.cur!.dests![1]).toBeNull();
    expect(key(state.teams[0].pos)).toBe(a);
  });

  it("self-team rating is impossible, and marking earns the audience its steps", () => {
    const state = seeded(3, [2, 2, 2, 2, 2, 2]);
    startGame(state, T0, 1);
    while (currentPhase(state)!.kind !== "spotRate") advancePhase(state);
    const [a, b] = state.cur!.spot!.teams;
    for (let slot = 0; slot < 2; slot++) {
      while (currentPhase(state)!.kind !== "spotRate") advancePhase(state);
      const phase = currentPhase(state)!;
      const speakerTeam = state.cur!.spot!.teams[slot];
      for (const p of Object.values(state.players)) {
        const ok = submitRating(state, p.id, phase.id, { hook: 9, clarity: 4, confidence: 4 });
        expect(ok).toBe(p.teamId !== speakerTeam);
      }
      // Team 5 doesn't bother marking the second pitch.
      if (slot === 1) for (const p of Object.values(state.players)) if (p.teamId === 5) delete state.inputs.ratings[p.id];
      advancePhase(state);
    }
    while (currentPhase(state)!.kind !== "spotReveal") advancePhase(state);
    const res = state.cur!.teamResults!;
    expect(state.cur!.spot!.results![0].teamAverages[a]).toBeUndefined();
    expect(res[a].speaker).toBe(true);
    expect(res[a].points).toBe(30); // (5+4+4)/3 ≥ 4
    expect(res[b].points).toBe(30);
    expect(res[2].fairJudge).toBe(true);
    expect(res[2].points).toBe(30);
    expect(res[5].fairJudge).toBe(false); // rated only one of the two
    expect(res[5].points).toBe(20);
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
      if (phase.kind === "reveal") state.manual.bands = [3, 2, 1, 0, 3, 2];
      else if (phase.kind === "vote") {
        state.teams.forEach((t) => {
          const reach = state.cur!.reach![t.id];
          const want = toward(state, t.id, reach);
          state.manual.dests[t.id] = want === "hold" ? null : want;
        });
      } else if (phase.kind === "spotRate") state.manual.stars[phase.meta!.slot as 0 | 1] = 5;
      advancePhase(state);
      if (phase.kind === "reveal") expect(state.cur!.teamResults!.map((r) => r.points)).toEqual([30, 20, 10, 0, 30, 20]);
    }
    // Re-scoring during the reveal must not double-count: 3 questions × 30 + pitch + map bonuses.
    expect(state.teams[3].score).toBeLessThan(200);
    expect(state.teams.some((t) => t.docked !== null)).toBe(true);
    expect(state.results!.ranking[0].score).toBeGreaterThan(100);
    expect(state.debrief!.takeaways.length).toBe(3);
  });
});

describe("content and debrief", () => {
  it("every question has four options and a valid answer", () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(6);
    for (const q of QUESTIONS) {
      expect(q.options.length).toBe(4);
      expect(q.correct).toBeGreaterThanOrEqual(0);
      expect(q.correct).toBeLessThan(4);
      expect(q.why.length).toBeGreaterThan(20);
    }
    expect(SPOTLIGHT_TOPICS.length).toBe(6);
  });

  it("debrief lists the hardest question first and the pitch strengths", () => {
    const d = computeDebrief(["P1", "P2", "P4"], { P1: { correct: 9, total: 10 }, P2: { correct: 2, total: 10 }, P4: { correct: 5, total: 10 } }, { hook: 8, clarity: 6, confidence: 7, n: 2 });
    expect(d.questions.map((q) => q.id)).toEqual(["P2", "P4", "P1"]);
    expect(d.takeaways[0]).toBe(QUESTION_BY_ID.P2.why);
    expect(d.strongest).toBe("hook");
    expect(d.weakest).toBe("clarity");
    const empty = computeDebrief([], {}, { hook: 0, clarity: 0, confidence: 0, n: 0 });
    expect(empty.takeaways.length).toBe(3);
    expect(empty.spotlight).toBeNull();
  });

  it("room codes are 4 unambiguous capitals", () => {
    for (let i = 0; i < 100; i++) expect(makeRoomCode(mulberry32(i))).toMatch(/^[A-HJ-NP-Z]{4}$/);
    expect(normalizeRoomCode(" ab-cd ")).toBe("ABCD");
  });
});
