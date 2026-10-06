import { MAP_RADIUS, POINTS, TOTAL_ROUNDS } from "@/config/balance";
import { TEAM_DEFS } from "@/config/teams";
import { ROUNDS } from "@/config/timeline";
import { QUESTION_BY_ID, QUESTIONS, type Question } from "@/content/questions";
import { SPOTLIGHT_TOPICS } from "@/content/spotlight";
import { computeDebrief } from "./debrief";
import { corners } from "./hex";
import { generateMap } from "./mapgen";
import { homesOf, indexTiles } from "./pathfinding";
import { resolveRound } from "./resolve";
import { pick, rngFor, shuffle } from "./rng";
import { findKey, reachableFor, suggestMove } from "./route";
import { audienceResult, groundDocked, moveOrder, rankTeams, scoreManual, scoreQuestion, stepsFromPitch, type TeamAnswers } from "./scoring";
import { clampStars, didRate, speakerResult } from "./spotlight";
import { phaseIndexAt, TIMELINE, TIMELINE_TOTAL_MS } from "./timeline";
import type {
  GameState,
  ManualState,
  Phase,
  PhaseInputs,
  Player,
  PublicData,
  PublicQuestion,
  Rating,
  RevealData,
  SpeakerResult,
  SpotPublic,
  TeamId,
  TeamPublic,
  TeamRoundResult,
} from "./types";

export const STATE_VERSION = 6;

export const emptyInputs = (): PhaseInputs => ({ answers: {}, votes: {}, ratings: {} });

export const emptyManual = (): ManualState => ({
  pass: [null, null, null, null, null, null],
  dests: [null, null, null, null, null, null],
  stars: [null, null],
});

export function createGame(roomCode: string, seed: number): GameState {
  const { tiles } = generateMap(seed);
  const homes = corners(MAP_RADIUS);
  return {
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
      score: 0,
      hasKey: false,
      stars: 0,
      docked: null,
    })),
    players: {},
    inputs: emptyInputs(),
    cur: null,
    dockCount: 0,
    usedQuestions: [],
    questionStats: {},
    spotTotals: { hook: 0, clarity: 0, confidence: 0, n: 0 },
    pitches: [null, null, null, null, null, null],
    pitchOrder: [],
    manualMode: false,
    manual: emptyManual(),
    results: null,
    debrief: null,
  };
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
  const player: Player = { id, name, teamId, connected: true, stats: { answered: 0, correct: 0, ratings: 0 } };
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

function pickQuestion(state: GameState, round: number): Question {
  const rng = rngFor(state.seed, `q:${round}`);
  const unused = QUESTIONS.filter((q) => !state.usedQuestions.includes(q.id));
  // Prefer a criterion the room hasn't seen yet, for variety.
  const seen = new Set(state.usedQuestions.map((id) => QUESTION_BY_ID[id]?.criterion));
  const fresh = unused.filter((q) => !seen.has(q.criterion));
  const q = pick(rng, fresh.length ? fresh : unused.length ? unused : QUESTIONS);
  state.usedQuestions.push(q.id);
  return q;
}

function choiceIsCorrect(state: GameState, choice: number): boolean {
  const q = state.cur?.q;
  return !!q && q.perm[choice] === QUESTION_BY_ID[q.id].correct;
}

function spotlightIndex(round: number): number {
  return ROUNDS.slice(0, round - 1).filter((r) => r === "spotlight").length;
}

/** Add this round's points to the scores, then work out the move order (most points first). */
function settleRound(state: GameState, results: TeamRoundResult[]): void {
  const cur = state.cur!;
  for (const r of results) state.teams[r.teamId].score += r.points;
  cur.teamResults = groundDocked(results, state.teams);
  cur.order = moveOrder(state.teams, rngFor(state.seed, `order:${cur.round}`));
}

/** Take back a round's points (Manual Mode lets the facilitator re-score while the answer is showing). */
function unsettleRound(state: GameState): void {
  for (const r of state.cur?.teamResults ?? []) state.teams[r.teamId].score -= r.points;
}

function scoreAnswers(state: GameState): TeamRoundResult[] {
  const cur = state.cur!;
  const playerCorrect: Record<string, boolean> = {};
  const inputs: TeamAnswers[] = state.teams.map((team) => {
    const members = teamMembers(state, team.id).filter((p) => p.connected || state.inputs.answers[p.id] !== undefined);
    let correct = 0;
    for (const p of members) {
      const ans = state.inputs.answers[p.id];
      if (!ans) continue;
      const ok = choiceIsCorrect(state, ans.choice);
      playerCorrect[p.id] = ok;
      p.stats.answered++;
      if (ok) {
        p.stats.correct++;
        correct++;
      }
    }
    return { teamId: team.id, members: members.length, correct };
  });
  cur.playerCorrect = playerCorrect;

  const total = inputs.reduce((s, r) => s + r.members, 0);
  if (cur.q && total > 0) {
    const qs = (state.questionStats[cur.q.id] ??= { correct: 0, total: 0 });
    qs.correct += inputs.reduce((s, r) => s + r.correct, 0);
    qs.total += total;
  }
  return scoreQuestion(inputs);
}

function scoreSpotlight(state: GameState): TeamRoundResult[] {
  const spot = state.cur!.spot!;
  const results = [0, 1].map((slot) => {
    const speakerTeam = spot.teams[slot];
    let res: SpeakerResult;
    if (state.manualMode) {
      const v = state.manual.stars[slot as 0 | 1] ?? null;
      res = { hook: v, clarity: v, confidence: v, overall: v, teamAverages: {}, raterTeams: 0, trimmed: false };
    } else {
      const byTeam: Record<number, Rating[]> = {};
      for (const pid of Object.keys(spot.ratings[slot]).sort()) {
        const p = state.players[pid];
        // Self-team ratings are blocked in the UI and ignored here too.
        if (!p || p.teamId === speakerTeam) continue;
        (byTeam[p.teamId] ??= []).push(spot.ratings[slot][pid]);
        p.stats.ratings++;
      }
      res = speakerResult(byTeam);
    }
    if (res.overall !== null) {
      state.spotTotals.hook += res.hook as number;
      state.spotTotals.clarity += res.clarity as number;
      state.spotTotals.confidence += res.confidence as number;
      state.spotTotals.n++;
      state.pitches[speakerTeam] = res.overall;
    }
    return res;
  }) as [SpeakerResult, SpeakerResult];
  spot.results = results;

  return state.teams.map((team) => {
    const slot = spot.teams.indexOf(team.id);
    const members = teamMembers(state, team.id, true).length;
    const base = { teamId: team.id, members, correct: 0 };
    if (slot >= 0) {
      // An unrated pitch (nobody rated, or no stars clicked in Manual Mode) counts as a solid 3.
      const overall = results[slot].overall;
      const steps = stepsFromPitch(overall ?? 3);
      return { ...base, accuracy: (overall ?? 3) / 5, steps, points: steps * POINTS.perStep, speaker: true, spotOverall: overall };
    }
    // The audience moves the standard distance and earns bonus points for marking the pitches.
    const rated = state.manualMode || didRate(results, team.id);
    return { ...base, accuracy: rated ? 1 : 0, ...audienceResult(rated), rated };
  });
}

/** Majority vote. A tie goes to `prefer` (the suggested move) if it is among the leaders, otherwise to a seeded draw. */
function tally(state: GameState, votes: string[], label: string, prefer?: string): string | null {
  if (!votes.length) return null;
  const counts: Record<string, number> = {};
  for (const v of votes) counts[v] = (counts[v] ?? 0) + 1;
  const max = Math.max(...Object.values(counts));
  const top = Object.keys(counts)
    .filter((k) => counts[k] === max)
    .sort();
  if (top.length === 1) return top[0];
  return prefer && top.includes(prefer) ? prefer : pick(rngFor(state.seed, label), top);
}

/* ---------- phase transitions ---------- */

function enterPhase(state: GameState): void {
  const phase = TIMELINE[state.phaseIndex];
  const round = phase.round ?? 0;
  switch (phase.kind) {
    case "challenge": {
      const q = pickQuestion(state, round);
      const perm = shuffle(
        rngFor(state.seed, `perm:${q.id}`),
        q.options.map((_, i) => i),
      );
      state.cur = { round, kind: "question", q: { id: q.id, perm } };
      state.manual = emptyManual();
      break;
    }
    case "spotReady": {
      // The spin: two teams are drawn from those that have not pitched yet, so every team pitches
      // exactly once and nobody knows the order in advance.
      const pool = state.teams.map((t) => t.id).filter((id) => !state.pitchOrder.includes(id));
      const drawn = shuffle(rngFor(state.seed, `spin:${round}`), pool).slice(0, 2);
      const teams = [drawn[0] ?? 0, drawn[1] ?? drawn[0] ?? 1] as [TeamId, TeamId];
      state.pitchOrder.push(...drawn);
      const si = spotlightIndex(round);
      const topics = shuffle(rngFor(state.seed, "topics"), SPOTLIGHT_TOPICS);
      state.cur = {
        round,
        kind: "spotlight",
        spot: { pool, teams, topics: [topics[(si * 2) % topics.length], topics[(si * 2 + 1) % topics.length]], ratings: [{}, {}] },
      };
      state.manual = emptyManual();
      break;
    }
    case "spotReveal":
      settleRound(state, scoreSpotlight(state));
      break;
    case "vote": {
      const cur = state.cur!;
      const index = indexTiles(state.tiles);
      const homes = homesOf(state.teams);
      cur.reach = {};
      cur.suggest = [];
      for (const team of state.teams) {
        const steps = cur.teamResults?.[team.id].steps ?? 0;
        const keyHex = findKey(state.tiles, team.id);
        const flying = team.docked === null;
        cur.reach[team.id] = flying ? reachableFor(index, team, steps, homes, keyHex) : [];
        cur.suggest[team.id] = flying ? suggestMove(index, team, steps, homes, keyHex) : "hold";
      }
      break;
    }
    case "resolve": {
      const cur = state.cur!;
      const out = resolveRound({
        tiles: state.tiles,
        teams: state.teams,
        steps: state.teams.map((t) => cur.teamResults?.[t.id]?.steps ?? 0),
        order: cur.order ?? state.teams.map((t) => t.id),
        dests: cur.dests ?? state.teams.map(() => null),
        dockCount: state.dockCount,
      });
      state.tiles = out.tiles;
      state.teams = out.teams;
      state.dockCount = out.dockCount;
      cur.moves = out.moves;
      break;
    }
    case "results": {
      const players = Object.values(state.players);
      const ranking = rankTeams(state.teams).map((t) => ({
        teamId: t.id,
        rank: t.rank,
        score: t.score,
        stars: t.stars,
        hasKey: t.hasKey,
        docked: t.docked,
        pitch: state.pitches[t.id],
      }));
      let bestPitch: TeamId | null = null;
      state.pitches.forEach((p, i) => {
        if (p !== null && (bestPitch === null || p > (state.pitches[bestPitch] as number))) bestPitch = i as TeamId;
      });
      const personal: Record<string, { correct: number; answered: number; ratings: number }> = {};
      for (const p of players) personal[p.id] = { ...p.stats };
      state.results = { ranking, bestPitch, personal };
      break;
    }
    case "debrief":
      state.debrief = computeDebrief(state.usedQuestions, state.questionStats, state.spotTotals);
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
      const scored = scoreAnswers(state);
      settleRound(state, state.manualMode ? scoreManual(state.manual.pass) : scored);
      break;
    }
    case "reveal":
      // Manual Mode: the facilitator may still be clicking accuracy bands while the answer is on screen.
      if (cur && state.manualMode) {
        unsettleRound(state);
        settleRound(state, scoreManual(state.manual.pass));
      }
      break;
    case "spotRate": {
      const slot = (phase.meta?.slot as 0 | 1) ?? 0;
      if (cur?.spot) cur.spot.ratings[slot] = { ...state.inputs.ratings };
      break;
    }
    case "vote": {
      if (!cur) break;
      // A team that doesn't choose flies the suggested route, so nobody is left behind.
      cur.dests = state.teams.map((team) => {
        const votes = state.manualMode
          ? []
          : teamMembers(state, team.id)
              .map((p) => state.inputs.votes[p.id]?.dest)
              .filter((v): v is string => !!v);
        const chosen = state.manualMode ? state.manual.dests[team.id] : tally(state, votes, `vote:${cur.round}:${team.id}`, cur.suggest?.[team.id]);
        const dest = chosen ?? cur.suggest?.[team.id] ?? "hold";
        return dest !== "hold" ? dest : null;
      });
      break;
    }
    default:
      break;
  }
}

/* ---------- inputs from phones ---------- */

export function submitAnswer(state: GameState, playerId: string, phaseId: string, choice: unknown, now: number): boolean {
  const phase = currentPhase(state);
  const player = state.players[playerId];
  if (!phase || !player || phase.id !== phaseId || phase.kind !== "challenge") return false;
  const n = state.cur?.q?.perm.length ?? 0;
  if (!Number.isInteger(choice) || (choice as number) < 0 || (choice as number) >= n) return false;
  // Answers can be changed while the team is still discussing: the latest one counts.
  state.inputs.answers[playerId] = { choice: choice as number, atMs: Math.max(0, elapsedMs(state, now) - phase.startOffsetMs) };
  return true;
}

export function submitVote(state: GameState, playerId: string, phaseId: string, dest: unknown): boolean {
  const phase = currentPhase(state);
  const player = state.players[playerId];
  if (!phase || !player || phase.id !== phaseId || phase.kind !== "vote") return false;
  const reach = state.cur?.reach?.[player.teamId] ?? [];
  if (typeof dest !== "string") return false;
  if (dest !== "hold" && !reach.some((r) => r.key === dest)) return false;
  state.inputs.votes[playerId] = { dest }; // the latest vote wins
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
  const phase = currentPhase(state);
  const known = !!phase && ["reveal", "spotReveal", "vote", "resolve"].includes(phase.kind);
  const order = known ? state.cur?.order : undefined;
  return state.teams.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    emblem: t.emblem,
    pos: t.pos,
    home: t.home,
    score: t.score,
    hasKey: t.hasKey,
    stars: t.stars,
    docked: t.docked,
    steps: known ? (state.cur?.teamResults?.[t.id]?.steps ?? null) : null,
    order: order ? order.indexOf(t.id) : null,
    players: teamMembers(state, t.id, true).length,
  }));
}

function publicQuestion(state: GameState): PublicQuestion | undefined {
  const q = state.cur?.q;
  if (!q) return undefined;
  const question = QUESTION_BY_ID[q.id];
  return { id: question.id, type: question.type, prompt: question.prompt, options: q.perm.map((i) => question.options[i]), slide: question.slide };
}

/** The answer key. Only ever called for the reveal phase, so it never leaves the host early. */
function revealData(state: GameState): RevealData | undefined {
  const q = state.cur?.q;
  if (!q) return undefined;
  const question = QUESTION_BY_ID[q.id];
  return {
    correct: q.perm.indexOf(question.correct),
    correctText: question.options[question.correct],
    why: question.why,
    playerCorrect: state.cur?.playerCorrect ?? {},
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
  const spotPublic = (slot: 0 | 1, withResults = false): SpotPublic => {
    const s = cur!.spot!;
    return { pool: s.pool, teams: s.teams, topics: s.topics, slot, results: withResults ? s.results : undefined };
  };

  switch (phase.kind) {
    case "challenge":
      data.question = publicQuestion(state);
      break;
    case "reveal":
      data.question = publicQuestion(state);
      data.reveal = revealData(state);
      data.teamResults = cur?.teamResults;
      data.order = cur?.order;
      break;
    case "vote":
      data.teamResults = cur?.teamResults;
      data.order = cur?.order;
      data.reach = cur?.reach;
      data.suggest = cur?.suggest;
      break;
    case "resolve":
      data.teamResults = cur?.teamResults;
      data.order = cur?.order;
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
      data.order = cur?.order;
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
