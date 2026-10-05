import { describe, expect, it } from "vitest";
import { ROUNDS } from "@/config/timeline";
import { FINAL_BY_ID, QUESTION_BY_ID } from "@/content/questions";
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
import { key } from "@/lib/engine/hex";
import { mulberry32 } from "@/lib/engine/rng";
import { TIMELINE } from "@/lib/engine/timeline";
import type { GameState, TeamId } from "@/lib/engine/types";

const T0 = 1_700_000_000_000;

function seeded(seed = 11, perTeam = [3, 1, 4, 2, 2, 5]): GameState {
  const state = createGame("TEST", seed);
  perTeam.forEach((n, team) => {
    for (let i = 0; i < n; i++) addPlayer(state, `p${team}-${i}`, `P${team}${i}`, team as TeamId);
  });
  return state;
}

/** Index (into the shuffled options) of the right answer for the current question. */
function correctChoice(state: GameState): number | number[] {
  const { id, perm } = state.cur!.q!;
  const fq = FINAL_BY_ID[id];
  if (fq) return fq.answer ? 0 : 1;
  const q = QUESTION_BY_ID[id];
  if (q.type === "order") return q.options.map((_, i) => perm.indexOf(i));
  return perm.indexOf(q.correct);
}

/** Play the current phase with random-but-seeded inputs, as bots would. */
function playPhase(state: GameState, rng: () => number, now: number) {
  const phase = currentPhase(state)!;
  const players = Object.values(state.players);
  if (phase.kind === "challenge" || phase.kind === "finalQ") {
    const right = correctChoice(state);
    for (const p of players) {
      if (rng() < 0.1) continue;
      const good = rng() < 0.6;
      const wrong = Array.isArray(right) ? right.slice().reverse() : (right + 1) % state.cur!.q!.perm.length;
      submitAnswer(state, p.id, phase.id, good ? right : wrong, now + Math.floor(rng() * 5000));
    }
  } else if (phase.kind === "vote") {
    for (const p of players) {
      const reach = state.cur!.reach![p.teamId];
      const dest = reach.length && rng() < 0.9 ? reach[Math.floor(rng() * reach.length)].key : "hold";
      const hand = state.teams[p.teamId].cards;
      submitVote(state, p.id, phase.id, dest, hand.length && rng() < 0.7 ? hand[0] : "none");
    }
  } else if (phase.kind === "spotRate") {
    for (const p of players) {
      const s = () => 1 + Math.floor(rng() * 5);
      submitRating(state, p.id, phase.id, { hook: s(), clarity: s(), confidence: s() });
    }
  }
}

function playFullGame(seed: number, perTeam?: number[]): GameState {
  const state = seeded(seed, perTeam);
  const rng = mulberry32(seed);
  startGame(state, T0, 1);
  while (!isOver(state)) {
    const phase = currentPhase(state)!;
    playPhase(state, rng, T0 + phase.startOffsetMs + 1000);
    // Invariants that must hold in every phase.
    expect(new Set(state.teams.map((t) => key(t.pos))).size).toBe(6);
    for (const t of state.teams) {
      expect(state.tiles.find((x) => x.q === t.home.q && x.r === t.home.r)!.owner).toBe(t.id);
      expect(t.cards.length).toBeLessThanOrEqual(2);
    }
    JSON.stringify(buildPublic(state));
    advancePhase(state);
  }
  return state;
}

describe("full game simulation", () => {
  it("runs every phase to the end and produces results + debrief", () => {
    const state = playFullGame(11);
    expect(state.phaseIndex).toBe(TIMELINE.length);
    expect(state.history.length).toBe(12);
    expect(state.results!.ranking.length).toBe(6);
    expect(state.results!.awards.length).toBe(4);
    expect(state.debrief!.takeaways.length).toBe(3);
    expect(state.usedQuestions.length).toBe(9);
    expect(new Set(state.usedQuestions).size).toBe(9);
    expect(state.final!.perQ.length).toBe(3);
    const pub = buildPublic(state);
    expect(pub.results).toBeTruthy();
    expect(pub.debrief).toBeTruthy();
  });

  it("is deterministic: same seed and inputs give the same end state", () => {
    expect(JSON.stringify(playFullGame(23))).toBe(JSON.stringify(playFullGame(23)));
  });

  it("survives many seeds, including teams of 1 and empty teams", () => {
    for (let seed = 1; seed <= 25; seed++) playFullGame(seed, [1, 0, 6, 1, 3, 0]);
  });

  it("the state is JSON-serialisable at every phase (snapshot + resume)", () => {
    let state = seeded(5);
    const rng = mulberry32(5);
    startGame(state, T0, 1);
    while (!isOver(state)) {
      playPhase(state, rng, T0 + currentPhase(state)!.startOffsetMs + 500);
      state = JSON.parse(JSON.stringify(state)) as GameState;
      advancePhase(state);
    }
    expect(state.results).toBeTruthy();
  });

  it("the debrief matches the engine's stats", () => {
    const state = playFullGame(31);
    for (const c of Object.keys(state.critStats) as (keyof typeof state.critStats)[]) {
      const s = state.critStats[c];
      expect(state.debrief!.criteria[c]).toBe(s.total ? s.correct / s.total : null);
    }
    const totalCorrect = Object.values(state.players).reduce((s, p) => s + p.stats.correct, 0);
    const qCorrect = Object.values(state.questionStats).reduce((s, q) => s + q.correct, 0);
    expect(qCorrect).toBe(totalCorrect);
  });
});

describe("rounds", () => {
  it("each team speaks exactly once, and the speaker is on the featured team", () => {
    const state = seeded(3);
    startGame(state, T0, 1);
    const spoke: TeamId[] = [];
    while (!isOver(state)) {
      const phase = currentPhase(state)!;
      if (phase.kind === "spotReady") {
        const spot = state.cur!.spot!;
        spot.teams.forEach((teamId, slot) => {
          spoke.push(teamId);
          expect(state.players[spot.speakers[slot]!].teamId).toBe(teamId);
        });
        expect(spot.topics[0]).not.toBe(spot.topics[1]);
      }
      advancePhase(state);
    }
    expect(spoke.slice().sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("uses a different topic and twist for all six speakers", () => {
    const state = seeded(8);
    startGame(state, T0, 1);
    const topics: string[] = [];
    const twists: string[] = [];
    while (!isOver(state)) {
      if (currentPhase(state)!.kind === "spotReady") {
        topics.push(...state.cur!.spot!.topics);
        twists.push(...state.cur!.spot!.twists);
      }
      advancePhase(state);
    }
    expect(new Set(topics).size).toBe(6);
    expect(new Set(twists).size).toBe(6);
  });

  it("self-team rating is impossible", () => {
    const state = seeded(3);
    startGame(state, T0, 1);
    while (currentPhase(state)!.kind !== "spotRate") advancePhase(state);
    const phase = currentPhase(state)!;
    const speakerTeam = state.cur!.spot!.teams[0];
    const mate = Object.values(state.players).find((p) => p.teamId === speakerTeam)!;
    const rival = Object.values(state.players).find((p) => p.teamId !== speakerTeam)!;
    expect(submitRating(state, mate.id, phase.id, { hook: 5, clarity: 5, confidence: 5 })).toBe(false);
    expect(submitRating(state, rival.id, phase.id, { hook: 9, clarity: 0, confidence: 3 })).toBe(true);
    expect(state.inputs.ratings[rival.id]).toEqual({ hook: 5, clarity: 1, confidence: 3 });
    // Even a forged rating that somehow reached the stored set is ignored when scoring.
    state.inputs.ratings[mate.id] = { hook: 5, clarity: 5, confidence: 5 };
    advancePhase(state);
    while (currentPhase(state)!.kind !== "spotReveal") advancePhase(state);
    expect(state.cur!.spot!.results![0].teamAverages[speakerTeam]).toBeUndefined();
    expect(state.players[mate.id].stats.ratings).toBe(0);
  });

  it("speaking earns at least 1 MP; the audience gets 2 (+1 Fair Judge)", () => {
    const state = seeded(3);
    startGame(state, T0, 1);
    while (currentPhase(state)!.kind !== "spotReveal") {
      const phase = currentPhase(state)!;
      if (phase.kind === "spotRate") {
        for (const p of Object.values(state.players)) {
          submitRating(state, p.id, phase.id, { hook: 1, clarity: 1, confidence: 1 });
        }
      }
      advancePhase(state);
    }
    const res = state.cur!.teamResults!;
    const [a, b] = state.cur!.spot!.teams;
    expect(res[a].baseMp).toBe(1);
    expect(res[b].baseMp).toBe(1);
    for (const r of res) {
      if (r.speaker) continue;
      expect(r.fairJudge).toBe(true); // everyone agreed
      expect(r.baseMp).toBe(3);
    }
  });

  it("rounds 10–12 revisit the criteria the room did worst on", () => {
    const state = seeded(4);
    startGame(state, T0, 1);
    while (!isOver(state)) {
      const phase = currentPhase(state)!;
      if (phase.kind === "challenge") {
        // Get everything right except Timing and Q&A.
        const bad = ["timing", "qa"].includes(state.cur!.criterion!);
        const right = correctChoice(state);
        const wrong = Array.isArray(right) ? right.slice().reverse() : (right + 1) % 4;
        for (const p of Object.values(state.players)) submitAnswer(state, p.id, phase.id, bad ? wrong : right, T0);
      }
      advancePhase(state);
    }
    const late = state.history.filter((h) => h.round >= 10).map((h) => h.criterion);
    expect(late.slice(0, 2).sort()).toEqual(["qa", "timing"]);
    expect(new Set(late).size).toBe(3);
    expect(state.debrief!.strongest).not.toBe("timing");
    expect(["timing", "qa"]).toContain(state.debrief!.weakest);
  });

  it("standard rounds follow the configured criteria", () => {
    const state = playFullGame(2);
    ROUNDS.forEach((def, i) => {
      if (def.kind === "standard" && def.criterion !== "random") expect(state.history[i].criterion).toBe(def.criterion);
      expect(state.history[i].kind).toBe(def.kind);
    });
  });
});

describe("inputs", () => {
  it("ignores stale phase ids, unknown players, bad choices and second answers", () => {
    const state = seeded(6);
    startGame(state, T0, 1);
    advancePhase(state); // → r1-challenge
    const phase = currentPhase(state)!;
    expect(phase.id).toBe("r1-challenge");
    expect(submitAnswer(state, "p0-0", "intro", 0, T0)).toBe(false);
    expect(submitAnswer(state, "ghost", phase.id, 0, T0)).toBe(false);
    expect(submitAnswer(state, "p0-0", phase.id, 9, T0)).toBe(false);
    expect(submitAnswer(state, "p0-0", phase.id, "1", T0)).toBe(false);
    expect(submitAnswer(state, "p0-0", phase.id, 1, T0 + 44_000)).toBe(true);
    expect(submitAnswer(state, "p0-0", phase.id, 2, T0 + 45_000)).toBe(false);
    expect(state.inputs.answers["p0-0"]).toEqual({ choice: 1, atMs: 4000 }); // host-stamped
    expect(submitVote(state, "p0-0", phase.id, "hold", "none")).toBe(false); // not a vote phase
  });

  it("never sends the answer key before the reveal", () => {
    const state = seeded(6);
    startGame(state, T0, 1);
    advancePhase(state);
    const during = JSON.stringify(buildPublic(state));
    expect(during).not.toContain("why");
    expect(buildPublic(state).reveal).toBeUndefined();
    advancePhase(state);
    expect(buildPublic(state).reveal!.why.length).toBeGreaterThan(5);
  });

  it("votes: majority wins, only reachable hexes count, the latest vote wins", () => {
    const state = seeded(6, [5, 1, 1, 1, 1, 1]);
    startGame(state, T0, 1);
    advancePhase(state);
    const ch = currentPhase(state)!;
    for (const p of Object.values(state.players)) submitAnswer(state, p.id, ch.id, correctChoice(state), T0);
    advancePhase(state);
    advancePhase(state); // → vote
    const phase = currentPhase(state)!;
    expect(phase.kind).toBe("vote");
    const reach = state.cur!.reach![0];
    expect(reach.length).toBeGreaterThan(1);
    const [a, b] = [reach[0].key, reach[1].key];
    expect(submitVote(state, "p0-0", phase.id, "0,0", "none")).toBe(false);
    submitVote(state, "p0-0", phase.id, a, "none");
    submitVote(state, "p0-1", phase.id, a, "none");
    submitVote(state, "p0-2", phase.id, b, "none");
    submitVote(state, "p0-3", phase.id, b, "none");
    submitVote(state, "p0-4", phase.id, a, "none");
    submitVote(state, "p0-4", phase.id, b, "none"); // changes their mind
    submitVote(state, "p0-0", phase.id, a, "micdrop"); // not held → treated as none
    expect(state.inputs.votes["p0-0"].card).toBe("none");
    advancePhase(state);
    expect(state.cur!.dests![0]).toBe(b);
    expect(state.cur!.dests![1]).toBeNull(); // nobody voted → hold
    expect(key(state.teams[0].pos)).toBe(b);
  });

  it("Stage Fright: a team with 0% can't move", () => {
    const state = seeded(6, [2, 2, 2, 2, 2, 2]);
    startGame(state, T0, 1);
    advancePhase(state);
    const ch = currentPhase(state)!;
    const right = correctChoice(state) as number;
    for (const p of Object.values(state.players)) {
      submitAnswer(state, p.id, ch.id, p.teamId === 0 ? (right + 1) % 4 : right, T0);
    }
    advancePhase(state);
    expect(state.cur!.teamResults![0].stageFright).toBe(true);
    expect(state.cur!.teamResults![0].mp).toBe(0);
    advancePhase(state);
    expect(state.cur!.reach![0]).toEqual([]);
  });
});

describe("master clock", () => {
  it("phases follow startedAt + cumulative offset and the game ends at exactly 15:00", () => {
    const state = seeded(9);
    startGame(state, T0, 1);
    expect(syncToClock(state, T0 + 39_999)).toBe(false);
    expect(syncToClock(state, T0 + 40_000)).toBe(true);
    expect(currentPhase(state)!.id).toBe("r1-challenge");
    // A late tick (e.g. a throttled tab) jumps straight to the right phase without drifting.
    syncToClock(state, T0 + 219_500);
    expect(currentPhase(state)!.id).toBe("r4-challenge");
    expect(remaining(state, T0 + 219_500).phaseMs).toBe(19_500);
    syncToClock(state, T0 + 899_999);
    expect(isOver(state)).toBe(false);
    syncToClock(state, T0 + 900_000);
    expect(isOver(state)).toBe(true);
    expect(remaining(state, T0 + 900_000).globalMs).toBe(0);
  });

  it("speed 10 finishes in 90 s", () => {
    const state = seeded(9);
    startGame(state, T0, 10);
    syncToClock(state, T0 + 89_999);
    expect(isOver(state)).toBe(false);
    syncToClock(state, T0 + 90_000);
    expect(isOver(state)).toBe(true);
  });

  it("pause freezes the clock and extends the end time by the paused duration", () => {
    const state = seeded(9);
    startGame(state, T0, 1);
    pauseGame(state, T0 + 10_000);
    expect(elapsedMs(state, T0 + 70_000)).toBe(10_000);
    expect(syncToClock(state, T0 + 70_000)).toBe(false);
    resumeGame(state, T0 + 70_000);
    expect(state.pausedMs).toBe(60_000);
    syncToClock(state, T0 + 959_999);
    expect(isOver(state)).toBe(false);
    syncToClock(state, T0 + 960_000);
    expect(isOver(state)).toBe(true);
  });

  it("a reloaded host resumes in the right phase from a snapshot", () => {
    const state = seeded(9);
    startGame(state, T0, 1);
    syncToClock(state, T0 + 100_000);
    const snapshot = JSON.stringify(state);
    const resumed = JSON.parse(snapshot) as GameState;
    syncToClock(resumed, T0 + 400_000); // tab was gone for five minutes
    syncToClock(state, T0 + 400_000);
    expect(currentPhase(resumed)!.id).toBe(currentPhase(state)!.id);
    expect(JSON.stringify(resumed)).toBe(JSON.stringify(state));
  });
});

describe("manual mode", () => {
  it("plays a whole game from facilitator clicks with no phones", () => {
    const state = createGame("MANU", 77);
    state.manualMode = true;
    startGame(state, T0, 1);
    let moved = false;
    while (!isOver(state)) {
      const phase = currentPhase(state)!;
      if (phase.kind === "reveal") {
        state.manual.bands = [3, 2, 1, 0, 3, 2];
        state.manual.quickDraw = 4;
      } else if (phase.kind === "vote") {
        state.teams.forEach((t) => {
          const reach = state.cur!.reach![t.id];
          state.manual.dests[t.id] = reach.length ? reach[reach.length - 1].key : null;
        });
      } else if (phase.kind === "spotRate") {
        state.manual.stars[(phase.meta!.slot as 0 | 1)] = 5;
      } else if (phase.kind === "finalQ") {
        const right = FINAL_BY_ID[state.cur!.q!.id].answer ? 0 : 1;
        state.manual.finalAnswers = [right, 1 - right, right, null, right, 1 - right];
      }
      advancePhase(state);
      if (phase.kind === "reveal") {
        expect(state.cur!.teamResults!.map((r) => r.mp)).toEqual(expect.arrayContaining([0, 1, 2, 3, 4]));
        expect(state.cur!.teamResults![3].stageFright).toBe(true);
      }
      if (state.teams.some((t) => key(t.pos) !== key(t.home))) moved = true;
    }
    expect(moved).toBe(true);
    expect(state.final!.perQ.every((q) => q.passed[0] && !q.passed[1])).toBe(true);
    expect([0, 2, 4]).toContain(state.stageOwner);
    expect(state.results!.ranking[0].score).toBeGreaterThan(50);
    expect(state.debrief!.takeaways.length).toBe(3);
  });
});
