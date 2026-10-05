import {
  CHEST_RESPAWN_COUNT,
  CHEST_RESPAWN_EVERY_ROUNDS,
  FAIR_JUDGE_BONUS,
  FINAL,
  MAP_RADIUS,
  SPOTLIGHT_AUDIENCE_MP,
  SPOTLIGHT_MIN_MP,
  TOTAL_ROUNDS,
} from "@/config/balance";
import { CRITERIA } from "@/config/rubric";
import { TEAM_DEFS } from "@/config/teams";
import { ROUNDS } from "@/config/timeline";
import { FINAL_BY_ID, FINAL_POOL, QUESTION_BY_ID, QUESTIONS, type Question } from "@/content/questions";
import { SPOTLIGHT_TOPICS, SPOTLIGHT_TWISTS } from "@/content/spotlight";
import { computeAwards, personalStats } from "./awards";
import { computeDebrief } from "./debrief";
import { bottomTeams, finalClaims, stageWinner } from "./final";
import { corners, key } from "./hex";
import { generateMap } from "./mapgen";
import { homesOf, indexTiles, reachable } from "./pathfinding";
import { resolveRound } from "./resolve";
import { pick, rngFor, shuffle } from "./rng";
import { applyMods, median, rankTeams, scoreChallenge, scoreManual, teamScores, type TeamAnswers } from "./scoring";
import { clampStars, isFairJudge, judgeDeviation, mpFromSpotlight, ratingOverall, speakerResult } from "./spotlight";
import { phaseIndexAt, TIMELINE, TIMELINE_TOTAL_MS } from "./timeline";
import type {
  CardId,
  CriterionKey,
  GameState,
  ManualState,
  Mod,
  Phase,
  PhaseInputs,
  Player,
  PublicData,
  PublicQuestion,
  Rating,
  RevealData,
  RoundWork,
  SpeakerResult,
  TeamId,
  TeamPublic,
  TeamRoundResult,
} from "./types";

export const STATE_VERSION = 4;
const TF_OPTIONS = ["True", "False"];

export const emptyInputs = (): PhaseInputs => ({ answers: {}, votes: {}, ratings: {} });

export const emptyManual = (): ManualState => ({
  bands: [null, null, null, null, null, null],
  quickDraw: null,
  dests: [null, null, null, null, null, null],
  cards: [null, null, null, null, null, null],
  stars: [null, null],
  finalAnswers: [null, null, null, null, null, null],
});

export function createGame(roomCode: string, seed: number): GameState {
  const { tiles } = generateMap(seed);
  const homes = corners(MAP_RADIUS);
  const critStats = {} as GameState["critStats"];
  for (const c of CRITERIA) critStats[c] = { correct: 0, total: 0 };
  const state: GameState = {
    version: STATE_VERSION,
    roomCode,
    seed,
    startedAt: null,
    pausedMs: 0,
    pausedAt: null,
    speed: 1,
    phaseIndex: -1,
    tiles,
    teams: TEAM_DEFS.map((d) => ({
      id: d.id,
      name: d.name,
      color: d.color,
      emblem: d.emblem,
      pos: { ...homes[d.id] },
      home: { ...homes[d.id] },
      cards: [],
      pendingMods: [],
      score: 0,
    })),
    players: {},
    inputs: emptyInputs(),
    history: [],
    cur: null,
    final: null,
    usedQuestions: [],
    usedCriteria: [],
    critStats,
    questionStats: {},
    spotTotals: { hook: 0, clarity: 0, confidence: 0, n: 0 },
    stageOwner: null,
    manualMode: false,
    manual: emptyManual(),
    results: null,
    debrief: null,
  };
  updateScores(state);
  return state;
}

/* ---------- players ---------- */

export function addPlayer(state: GameState, id: string, name: string, teamId: TeamId): Player {
  const existing = state.players[id];
  if (existing) {
    existing.name = name || existing.name;
    existing.connected = true;
    // Switching team is only allowed in the lobby, so nobody can jump ship mid-game.
    if (state.phaseIndex < 0) existing.teamId = teamId;
    return existing;
  }
  const player: Player = {
    id,
    name,
    teamId,
    connected: true,
    stats: { answered: 0, correct: 0, correctMs: 0, ratings: 0, ratingDev: 0 },
  };
  state.players[id] = player;
  return player;
}

export function removePlayer(state: GameState, id: string): void {
  delete state.players[id];
}

export function teamMembers(state: GameState, teamId: TeamId, connectedOnly = false): Player[] {
  return Object.values(state.players)
    .filter((p) => p.teamId === teamId && (!connectedOnly || p.connected))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/* ---------- clock ---------- */

export function startGame(state: GameState, now: number, speed = 1): void {
  state.startedAt = now;
  state.pausedMs = 0;
  state.pausedAt = null;
  state.speed = speed;
  state.phaseIndex = 0;
  state.inputs = emptyInputs();
  enterPhase(state);
}

/** Game-time milliseconds since START (0–900,000), excluding paused time. */
export function elapsedMs(state: GameState, now: number): number {
  if (state.startedAt === null) return 0;
  const real = (state.pausedAt ?? now) - state.startedAt - state.pausedMs;
  return Math.max(0, real * state.speed);
}

export function pauseGame(state: GameState, now: number): void {
  if (state.startedAt !== null && state.pausedAt === null) state.pausedAt = now;
}

export function resumeGame(state: GameState, now: number): void {
  if (state.pausedAt !== null) {
    state.pausedMs += now - state.pausedAt;
    state.pausedAt = null;
  }
}

export function currentPhase(state: GameState): Phase | null {
  return state.phaseIndex >= 0 && state.phaseIndex < TIMELINE.length ? TIMELINE[state.phaseIndex] : null;
}

export const isOver = (state: GameState): boolean => state.phaseIndex >= TIMELINE.length;

/** Real milliseconds until the current phase ends and until the whole game ends. */
export function remaining(state: GameState, now: number): { phaseMs: number; globalMs: number; phaseDurationMs: number } {
  const phase = currentPhase(state);
  const el = elapsedMs(state, now);
  const speed = state.speed || 1;
  return {
    phaseMs: phase ? Math.max(0, (phase.startOffsetMs + phase.durationMs - el) / speed) : 0,
    globalMs: Math.max(0, (TIMELINE_TOTAL_MS - el) / speed),
    phaseDurationMs: phase ? phase.durationMs / speed : 0,
  };
}

/**
 * Advance through phases until the state matches the master clock. Phase boundaries always come
 * from `startedAt + cumulative offset`, never from "previous phase end + duration".
 * Returns true if the phase changed.
 */
export function syncToClock(state: GameState, now: number): boolean {
  if (state.startedAt === null || state.phaseIndex < 0) return false;
  const target = phaseIndexAt(elapsedMs(state, now));
  let changed = false;
  while (state.phaseIndex < target && state.phaseIndex < TIMELINE.length) {
    advancePhase(state);
    changed = true;
  }
  return changed;
}

export function advancePhase(state: GameState): void {
  if (state.phaseIndex >= TIMELINE.length) return;
  exitPhase(state);
  state.phaseIndex++;
  state.inputs = emptyInputs();
  if (state.phaseIndex < TIMELINE.length) enterPhase(state);
}

/* ---------- helpers ---------- */

function updateScores(state: GameState): void {
  const scores = teamScores(state.tiles, state.teams, state.stageOwner);
  for (const s of scores) state.teams[s.teamId].score = s.score;
}

function takeMods(state: GameState): Mod[][] {
  return state.teams.map((t) => {
    const mods = t.pendingMods;
    t.pendingMods = [];
    return mods;
  });
}

function getQuestion(id: string): Question {
  return QUESTION_BY_ID[id];
}

function choiceIsCorrect(state: GameState, choice: number | number[]): boolean {
  const q = state.cur?.q;
  if (!q) return false;
  const fq = FINAL_BY_ID[q.id];
  if (fq) return typeof choice === "number" && (choice === 0) === fq.answer;
  const question = getQuestion(q.id);
  if (question.type === "order") {
    return Array.isArray(choice) && choice.length === q.perm.length && choice.every((c, i) => q.perm[c] === i);
  }
  return typeof choice === "number" && q.perm[choice] === question.correct;
}

function pickCriterion(state: GameState, round: number): CriterionKey {
  const def = ROUNDS[round - 1];
  if (def.kind === "standard" && def.criterion !== "random") return def.criterion;
  // Rounds 10–12 revisit the criteria the room has done worst on so far.
  const rng = rngFor(state.seed, `crit:${round}`);
  const pool = CRITERIA.filter((c) => !state.usedCriteria.includes(c));
  const acc = (c: CriterionKey) => (state.critStats[c].total ? state.critStats[c].correct / state.critStats[c].total : 1);
  const ordered = shuffle(rng, pool.length ? pool : CRITERIA).sort((a, b) => acc(a) - acc(b));
  const chosen = ordered[0];
  state.usedCriteria.push(chosen);
  return chosen;
}

function pickQuestion(state: GameState, criterion: CriterionKey, round: number): Question {
  const rng = rngFor(state.seed, `q:${round}`);
  const unused = QUESTIONS.filter((q) => !state.usedQuestions.includes(q.id));
  const pool = unused.filter((q) => q.criterion === criterion);
  const q = pick(rng, pool.length ? pool : unused.length ? unused : QUESTIONS);
  state.usedQuestions.push(q.id);
  return q;
}

function eligibleByTeam(state: GameState): Player[][] {
  return state.teams.map((t) =>
    teamMembers(state, t.id).filter((p) => p.connected || state.inputs.answers[p.id] !== undefined),
  );
}

/** Score the answers of the current challenge / final question. Returns per-team results. */
function scoreAnswers(state: GameState, mods: Mod[][], criterion?: CriterionKey): TeamRoundResult[] {
  const cur = state.cur!;
  const eligible = eligibleByTeam(state);
  const playerCorrect: Record<string, boolean> = {};
  const inputs: TeamAnswers[] = state.teams.map((team, i) => {
    const correctTimes: number[] = [];
    for (const p of eligible[i]) {
      const ans = state.inputs.answers[p.id];
      if (!ans) continue;
      const ok = choiceIsCorrect(state, ans.choice);
      playerCorrect[p.id] = ok;
      p.stats.answered++;
      if (ok) {
        p.stats.correct++;
        p.stats.correctMs += ans.atMs;
        correctTimes.push(ans.atMs);
      }
    }
    return { teamId: team.id, members: eligible[i].length, correctTimes };
  });
  cur.playerCorrect = playerCorrect;

  const totalMembers = inputs.reduce((s, r) => s + r.members, 0);
  const totalCorrect = inputs.reduce((s, r) => s + r.correctTimes.length, 0);
  if (cur.q && totalMembers > 0) {
    const qs = (state.questionStats[cur.q.id] ??= { correct: 0, total: 0 });
    qs.correct += totalCorrect;
    qs.total += totalMembers;
    if (criterion) {
      state.critStats[criterion].correct += totalCorrect;
      state.critStats[criterion].total += totalMembers;
    }
  }
  return scoreChallenge(inputs, mods);
}

function tally<T extends string>(state: GameState, votes: T[], label: string): T | null {
  if (!votes.length) return null;
  const counts: Record<string, number> = {};
  for (const v of votes) counts[v] = (counts[v] ?? 0) + 1;
  const max = Math.max(...Object.values(counts));
  const top = Object.keys(counts)
    .filter((k) => counts[k] === max)
    .sort();
  return (top.length === 1 ? top[0] : pick(rngFor(state.seed, label), top)) as T;
}

function spotlightIndex(round: number): number {
  return ROUNDS.slice(0, round - 1).filter((r) => r.kind === "spotlight").length;
}

/* ---------- phase transitions ---------- */

function enterPhase(state: GameState): void {
  const phase = TIMELINE[state.phaseIndex];
  const round = phase.round ?? 0;
  switch (phase.kind) {
    case "challenge": {
      const criterion = pickCriterion(state, round);
      const q = pickQuestion(state, criterion, round);
      const perm = shuffle(
        rngFor(state.seed, `perm:${q.id}`),
        q.options.map((_, i) => i),
      );
      state.cur = { round, kind: "standard", criterion, q: { id: q.id, perm }, mods: takeMods(state) };
      state.manual = emptyManual();
      break;
    }
    case "spotReady": {
      const def = ROUNDS[round - 1];
      const teams = def.kind === "spotlight" ? def.teams : ([0, 1] as [TeamId, TeamId]);
      const si = spotlightIndex(round);
      const topics = shuffle(rngFor(state.seed, "topics"), SPOTLIGHT_TOPICS);
      const twists = shuffle(rngFor(state.seed, "twists"), SPOTLIGHT_TWISTS);
      const speakers: [string | null, string | null] = [null, null];
      const names: [string, string] = ["", ""];
      teams.forEach((teamId, slot) => {
        const pool = teamMembers(state, teamId, true);
        if (pool.length) {
          const p = pick(rngFor(state.seed, `speaker:${round}:${slot}`), pool);
          speakers[slot] = p.id;
          names[slot] = p.name;
        } else {
          names[slot] = state.manualMode ? `A volunteer from ${state.teams[teamId].name}` : "No speaker connected";
        }
      });
      state.cur = {
        round,
        kind: "spotlight",
        mods: takeMods(state),
        spot: {
          teams,
          speakers,
          speakerNames: names,
          topics: [topics[(si * 2) % topics.length], topics[(si * 2 + 1) % topics.length]],
          twists: [twists[(si * 2) % twists.length], twists[(si * 2 + 1) % twists.length]],
          ratings: [{}, {}],
        },
      };
      state.manual = emptyManual();
      break;
    }
    case "spotReveal":
      scoreSpotlight(state);
      break;
    case "vote": {
      const cur = state.cur!;
      const index = indexTiles(state.tiles);
      const homes = homesOf(state.teams);
      cur.reach = {};
      for (const team of state.teams) {
        const mp = cur.teamResults?.[team.id].mp ?? 0;
        cur.reach[team.id] = reachable(index, team.pos, mp, { teamId: team.id, homes });
      }
      break;
    }
    case "resolve": {
      const cur = state.cur!;
      const results = cur.teamResults ?? [];
      const out = resolveRound({
        tiles: state.tiles,
        teams: state.teams,
        mp: state.teams.map((t) => results[t.id]?.mp ?? 0),
        roundScore: state.teams.map((t) => results[t.id]?.roundScore ?? 0),
        dests: cur.dests ?? state.teams.map(() => null),
        cards: cur.cards ?? state.teams.map(() => null),
        rng: rngFor(state.seed, `resolve:${cur.round}`),
      });
      state.tiles = out.tiles;
      state.teams = out.teams;
      cur.moves = out.moves;
      updateScores(state);
      state.history.push({
        round: cur.round,
        kind: cur.kind,
        criterion: cur.criterion,
        questionId: cur.q?.id,
        mp: state.teams.map((t) => results[t.id]?.mp ?? 0),
        scores: state.teams.map((t) => t.score),
      });
      break;
    }
    case "finalBanner": {
      const qids = shuffle(rngFor(state.seed, "final"), FINAL_POOL)
        .slice(0, FINAL.questions)
        .map((q) => q.id);
      state.final = { qids, bottom3: bottomTeams(state.teams), perQ: [] };
      state.cur = { round: TOTAL_ROUNDS + 1, kind: "final", mods: state.teams.map(() => []) };
      state.manual = emptyManual();
      break;
    }
    case "finalQ": {
      const qi = (phase.meta?.qIndex as number) ?? 0;
      state.cur = {
        round: TOTAL_ROUNDS + 1,
        kind: "final",
        mods: state.teams.map(() => []),
        q: { id: state.final!.qids[qi], perm: [0, 1] },
      };
      state.manual.finalAnswers = state.teams.map(() => null);
      break;
    }
    case "finalFlood": {
      const fin = state.final!;
      const { claims, tiles } = finalClaims(state.tiles, state.teams, fin.perQ, fin.bottom3);
      fin.claims = claims;
      fin.stageWinner = stageWinner(fin.perQ, state.teams.length, rngFor(state.seed, "stage"));
      state.tiles = tiles;
      state.stageOwner = fin.stageWinner;
      const stage = state.tiles.find((t) => t.type === "stage");
      if (stage && fin.stageWinner !== null) stage.owner = fin.stageWinner;
      updateScores(state);
      break;
    }
    case "results": {
      updateScores(state);
      const players = Object.values(state.players);
      const ranking = rankTeams(teamScores(state.tiles, state.teams, state.stageOwner));
      state.results = { ranking, awards: computeAwards(players), personal: personalStats(players) };
      break;
    }
    case "debrief":
      state.debrief = computeDebrief(state.critStats, state.questionStats, state.spotTotals);
      break;
    default:
      break;
  }
}

function exitPhase(state: GameState): void {
  const phase = currentPhase(state);
  if (!phase) return;
  const cur = state.cur;
  switch (phase.kind) {
    case "challenge": {
      if (!cur) break;
      const scored = scoreAnswers(state, cur.mods, cur.criterion);
      cur.teamResults = state.manualMode ? scoreManual(state.manual.bands, state.manual.quickDraw, cur.mods) : scored;
      break;
    }
    case "reveal":
      // Manual Mode: the facilitator may still be clicking accuracy bands while the answer is on screen.
      if (cur && state.manualMode) cur.teamResults = scoreManual(state.manual.bands, state.manual.quickDraw, cur.mods);
      break;
    case "spotRate": {
      const slot = (phase.meta?.slot as 0 | 1) ?? 0;
      if (cur?.spot) cur.spot.ratings[slot] = { ...state.inputs.ratings };
      break;
    }
    case "vote": {
      if (!cur) break;
      if (state.manualMode) {
        cur.dests = state.manual.dests.slice();
        cur.cards = state.manual.cards.slice();
        break;
      }
      cur.dests = [];
      cur.cards = [];
      for (const team of state.teams) {
        const votes = teamMembers(state, team.id)
          .map((p) => state.inputs.votes[p.id])
          .filter(Boolean);
        const dest = tally(
          state,
          votes.map((v) => v.dest),
          `vote:${cur.round}:${team.id}`,
        );
        const card = tally(
          state,
          votes.map((v) => v.card),
          `card:${cur.round}:${team.id}`,
        );
        cur.dests[team.id] = dest && dest !== "hold" ? dest : null;
        cur.cards[team.id] = card && card !== "none" ? (card as CardId) : null;
      }
      break;
    }
    case "resolve": {
      if (cur && cur.round % CHEST_RESPAWN_EVERY_ROUNDS === 0) respawnChests(state, cur.round);
      break;
    }
    case "finalQ": {
      const fin = state.final!;
      let results: TeamRoundResult[];
      const scored = scoreAnswers(state, state.teams.map(() => []));
      if (state.manualMode) {
        results = scored.map((r, i) => {
          const a = state.manual.finalAnswers[i];
          return { ...r, accuracy: a !== null && choiceIsCorrect(state, a) ? 1 : 0, medianMs: null };
        });
      } else {
        results = scored;
      }
      fin.perQ.push({
        accuracy: results.map((r) => r.accuracy),
        medianMs: results.map((r) => r.medianMs),
        passed: results.map((r) => r.accuracy >= FINAL.passAccuracy),
      });
      break;
    }
    default:
      break;
  }
}

function respawnChests(state: GameState, round: number): void {
  const rng = rngFor(state.seed, `chests:${round}`);
  const occupied = new Set(state.teams.map((t) => key(t.pos)));
  const homes = homesOf(state.teams);
  const options = shuffle(
    rng,
    state.tiles.filter((t) => t.type === "land" && !t.chest && !occupied.has(key(t)) && homes[key(t)] === undefined),
  );
  options.slice(0, CHEST_RESPAWN_COUNT).forEach((t) => (t.chest = true));
}

function scoreSpotlight(state: GameState): void {
  const cur = state.cur!;
  const spot = cur.spot!;
  const results = [0, 1].map((slot) => {
    const speakerTeam = spot.teams[slot];
    if (state.manualMode) {
      const stars = state.manual.stars[slot as 0 | 1];
      const v = stars ?? null;
      return {
        hook: v,
        clarity: v,
        confidence: v,
        overall: v,
        teamAverages: {},
        raterTeams: 0,
        trimmed: false,
      } as SpeakerResult;
    }
    const byTeam: Record<number, Rating[]> = {};
    for (const pid of Object.keys(spot.ratings[slot]).sort()) {
      const p = state.players[pid];
      // Self-team ratings are blocked in the UI and ignored here too.
      if (!p || p.teamId === speakerTeam) continue;
      (byTeam[p.teamId] ??= []).push(spot.ratings[slot][pid]);
    }
    const res = speakerResult(byTeam);
    if (res.overall !== null) {
      for (const pid of Object.keys(spot.ratings[slot])) {
        const p = state.players[pid];
        if (!p || p.teamId === speakerTeam) continue;
        p.stats.ratings++;
        p.stats.ratingDev += Math.abs(ratingOverall(spot.ratings[slot][pid]) - res.overall);
      }
      state.spotTotals.hook += res.hook as number;
      state.spotTotals.clarity += res.clarity as number;
      state.spotTotals.confidence += res.confidence as number;
      state.spotTotals.n++;
      const speaker = spot.speakers[slot];
      if (speaker && state.players[speaker]) state.players[speaker].stats.spotlight = res.overall;
    }
    return res;
  }) as [SpeakerResult, SpeakerResult];
  spot.results = results;

  cur.teamResults = state.teams.map((team) => {
    const slot = spot.teams.indexOf(team.id);
    const mods = cur.mods[team.id] ?? [];
    const members = teamMembers(state, team.id, true).length;
    let base: number;
    let score: number;
    let fair = false;
    let overall: number | null = null;
    if (slot >= 0) {
      overall = results[slot].overall;
      const hasSpeaker = spot.speakers[slot] !== null || state.manualMode;
      // Unrated speeches (nobody rated, or Manual Mode with no stars clicked) count as a solid 3.
      base = hasSpeaker ? mpFromSpotlight(overall ?? 3) : SPOTLIGHT_MIN_MP;
      score = (overall ?? 3) * 200;
    } else {
      fair = !state.manualMode && isFairJudge(results, team.id);
      base = SPOTLIGHT_AUDIENCE_MP + (fair ? FAIR_JUDGE_BONUS : 0);
      score = 400 + (fair ? 100 : 0) - judgeDeviation(results, team.id) * 100;
    }
    return {
      teamId: team.id,
      members,
      correct: 0,
      accuracy: slot >= 0 ? (overall ?? 3) / 5 : fair ? 1 : 0.5,
      medianMs: null,
      baseMp: base,
      quickDraw: false,
      mods,
      mp: applyMods(base, mods),
      roundScore: score,
      stageFright: false,
      speaker: slot >= 0,
      fairJudge: fair,
      spotOverall: overall,
    };
  });
}

/* ---------- inputs from phones ---------- */

export function submitAnswer(state: GameState, playerId: string, phaseId: string, choice: unknown, now: number): boolean {
  const phase = currentPhase(state);
  const player = state.players[playerId];
  if (!phase || !player || phase.id !== phaseId) return false;
  if (phase.kind !== "challenge" && phase.kind !== "finalQ") return false;
  if (state.inputs.answers[playerId]) return false; // first answer is locked in
  const n = state.cur?.q?.perm.length ?? 0;
  let clean: number | number[];
  if (Array.isArray(choice)) {
    if (choice.length !== n || new Set(choice).size !== n) return false;
    if (!choice.every((c) => Number.isInteger(c) && c >= 0 && c < n)) return false;
    clean = choice as number[];
  } else if (Number.isInteger(choice) && (choice as number) >= 0 && (choice as number) < n) {
    clean = choice as number;
  } else {
    return false;
  }
  // The host stamps the time on receipt; client clocks are never trusted.
  state.inputs.answers[playerId] = { choice: clean, atMs: Math.max(0, elapsedMs(state, now) - phase.startOffsetMs) };
  return true;
}

export function submitVote(state: GameState, playerId: string, phaseId: string, dest: unknown, card: unknown): boolean {
  const phase = currentPhase(state);
  const player = state.players[playerId];
  if (!phase || !player || phase.id !== phaseId || phase.kind !== "vote") return false;
  const reach = state.cur?.reach?.[player.teamId] ?? [];
  if (typeof dest !== "string") return false;
  if (dest !== "hold" && !reach.some((r) => r.key === dest)) return false;
  const hand = state.teams[player.teamId].cards;
  const cleanCard = typeof card === "string" && hand.includes(card as CardId) ? (card as CardId) : "none";
  state.inputs.votes[playerId] = { dest, card: cleanCard }; // the latest vote wins
  return true;
}

export function submitRating(state: GameState, playerId: string, phaseId: string, rating: Partial<Rating>): boolean {
  const phase = currentPhase(state);
  const player = state.players[playerId];
  const spot = state.cur?.spot;
  if (!phase || !player || !spot || phase.id !== phaseId || phase.kind !== "spotRate") return false;
  const slot = (phase.meta?.slot as number) ?? 0;
  if (player.teamId === spot.teams[slot]) return false; // no self-team rating
  state.inputs.ratings[playerId] = {
    hook: clampStars(rating.hook as number),
    clarity: clampStars(rating.clarity as number),
    confidence: clampStars(rating.confidence as number),
  };
  return true;
}

/* ---------- public view ---------- */

export function teamsPublic(state: GameState): TeamPublic[] {
  const scores = teamScores(state.tiles, state.teams, state.stageOwner);
  const phase = currentPhase(state);
  const showMp = phase && ["reveal", "spotReveal", "vote", "resolve"].includes(phase.kind);
  return state.teams.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    emblem: t.emblem,
    pos: t.pos,
    home: t.home,
    cards: t.cards,
    score: scores[t.id].score,
    tiles: scores[t.id].tiles,
    mp: showMp ? (state.cur?.teamResults?.[t.id]?.mp ?? null) : null,
    players: teamMembers(state, t.id, true).length,
  }));
}

function publicQuestion(state: GameState): PublicQuestion | undefined {
  const q = state.cur?.q;
  if (!q) return undefined;
  const fq = FINAL_BY_ID[q.id];
  if (fq) return { id: fq.id, type: "tf", prompt: fq.statement, options: TF_OPTIONS };
  const question = getQuestion(q.id);
  return {
    id: question.id,
    type: question.type,
    prompt: question.prompt,
    options: q.perm.map((i) => question.options[i]),
    slide: question.slide,
  };
}

/** The answer key. Only ever called for reveal phases, so it never leaves the host early. */
function revealData(state: GameState): RevealData | undefined {
  const q = state.cur?.q;
  if (!q) return undefined;
  const playerCorrect = state.cur?.playerCorrect ?? {};
  const fq = FINAL_BY_ID[q.id];
  if (fq) return { correct: fq.answer ? 0 : 1, correctText: fq.answer ? "True" : "False", why: fq.why, playerCorrect };
  const question = getQuestion(q.id);
  if (question.type === "order") {
    return {
      correct: question.options.map((_, i) => q.perm.indexOf(i)),
      correctText: question.options.join("  →  "),
      why: question.why,
      playerCorrect,
    };
  }
  return {
    correct: q.perm.indexOf(question.correct),
    correctText: question.options[question.correct],
    why: question.why,
    playerCorrect,
  };
}

export function buildPublic(state: GameState): PublicData {
  const phase = currentPhase(state);
  const cur = state.cur;
  const data: PublicData = {
    teams: teamsPublic(state),
    round: phase?.round ?? 0,
    totalRounds: TOTAL_ROUNDS,
    roundKind: cur?.kind ?? null,
    manualMode: state.manualMode,
  };
  if (!phase) {
    if (isOver(state)) {
      data.results = state.results ?? undefined;
      data.debrief = state.debrief ?? undefined;
    }
    return data;
  }
  const spotPublic = (slot: 0 | 1, withResults = false) => {
    const s = cur!.spot!;
    return {
      teams: s.teams,
      speakers: [
        { id: s.speakers[0], name: s.speakerNames[0] },
        { id: s.speakers[1], name: s.speakerNames[1] },
      ] as [{ id: string | null; name: string }, { id: string | null; name: string }],
      slot,
      topic: s.topics[slot],
      twist: s.twists[slot],
      results: withResults ? s.results : undefined,
    };
  };
  const finalPublic = () => ({
    qIndex: (phase.meta?.qIndex as number) ?? 0,
    bottom3: state.final!.bottom3,
    perQ: state.final!.perQ,
    claims: state.final!.claims,
    stageWinner: state.final!.stageWinner,
  });

  switch (phase.kind) {
    case "challenge":
      data.criterion = cur?.criterion;
      data.question = publicQuestion(state);
      break;
    case "reveal":
      data.criterion = cur?.criterion;
      data.question = publicQuestion(state);
      data.reveal = revealData(state);
      data.teamResults = cur?.teamResults;
      break;
    case "vote":
      data.criterion = cur?.criterion;
      data.teamResults = cur?.teamResults;
      data.reach = cur?.reach;
      break;
    case "resolve":
      data.criterion = cur?.criterion;
      data.teamResults = cur?.teamResults;
      data.moves = cur?.moves;
      break;
    case "spotReady":
      data.spot = spotPublic(0);
      break;
    case "spotSpeak":
    case "spotRate":
      data.spot = spotPublic(((phase.meta?.slot as number) ?? 0) as 0 | 1);
      break;
    case "spotReveal":
      data.spot = spotPublic(1, true);
      data.teamResults = cur?.teamResults;
      break;
    case "finalBanner":
      data.final = finalPublic();
      break;
    case "finalQ":
      data.question = publicQuestion(state);
      data.final = finalPublic();
      break;
    case "finalReveal":
      data.question = publicQuestion(state);
      data.reveal = revealData(state);
      data.final = finalPublic();
      break;
    case "finalFlood":
      data.final = finalPublic();
      break;
    case "results":
      data.results = state.results ?? undefined;
      break;
    case "debrief":
      data.results = state.results ?? undefined;
      data.debrief = state.debrief ?? undefined;
      break;
    default:
      break;
  }
  return data;
}

/** Median helper re-exported for the host HUD. */
export { median };
