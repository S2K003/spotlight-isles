import {
  addPlayer,
  buildPublic,
  createGame,
  currentPhase,
  elapsedMs,
  emptyManual,
  isOver,
  pauseGame,
  remaining,
  removePlayer,
  resumeGame,
  startGame,
  STATE_VERSION,
  submitAnswer,
  submitRating,
  submitVote,
  syncToClock,
  teamMembers,
} from "@/lib/engine/game";
import { makeRoomCode } from "@/lib/engine/rng";
import { TIMELINE } from "@/lib/engine/timeline";
import type { GameState, Phase, PublicData, TeamId } from "@/lib/engine/types";
import {
  cleanName,
  isTeamId,
  type ClientEvents,
  type LobbyMsg,
  type PhaseMsg,
  type PlayerInfo,
  type PresenceMeta,
  type VoteTallyMsg,
} from "./messages";
import { createTransport, type Transport, type TransportStatus } from "./transport";

const SNAPSHOT_KEY = "spotlight-isles:host";
const LOOP_MS = 50;
const SNAPSHOT_EVERY_MS = 2000;
const MAP_PHASES = new Set(["intro", "challenge", "spotReady", "vote", "resolve", "results"]);

export interface HostView {
  state: GameState;
  phase: Phase | null;
  publicData: PublicData;
  over: boolean;
  status: TransportStatus;
  mode: "supabase" | "local";
  /** Bumped on every change so React can use it as a cheap dependency. */
  version: number;
  /** Bumped only when the phase changes. */
  phaseVersion: number;
}

/**
 * Host-authoritative game loop. Runs in the projector browser: owns the master clock, the
 * engine state and the answer keys; phones only send inputs and render what they receive.
 */
export class HostController {
  state!: GameState;
  private transport: Transport | null = null;
  private listeners = new Set<() => void>();
  private view!: HostView;
  private version = 0;
  private phaseVersion = 0;
  private status: TransportStatus = "connecting";
  private loop: ReturnType<typeof setInterval> | null = null;
  private lastTick = 0;
  private lastSnapshot = 0;
  private tallyTimer: ReturnType<typeof setTimeout> | null = null;
  private helloTimer: ReturnType<typeof setTimeout> | null = null;
  private lobbyTimer: ReturnType<typeof setTimeout> | null = null;
  private notifyTimer: ReturnType<typeof setTimeout> | null = null;
  private unsub: (() => void)[] = [];
  private presentIds = new Set<string>();
  private speed: number;
  private noStore: boolean;

  constructor(opts: { speed?: number; fresh?: boolean; noStore?: boolean } = {}) {
    this.speed = Math.max(1, Math.min(60, opts.speed ?? 1));
    this.noStore = !!opts.noStore;
    const saved = opts.fresh ? null : this.loadSnapshot();
    if (saved) {
      this.state = saved;
      for (const p of Object.values(this.state.players)) p.connected = false;
      // Recalculate the current phase from the epoch start time, so the 15:00 end doesn't move.
      syncToClock(this.state, Date.now());
    } else {
      this.state = createGame(makeRoomCode(), (Math.random() * 2 ** 31) >>> 0);
      this.saveSnapshot();
    }
    this.rebuildView();
  }

  /* ---------- lifecycle ---------- */

  connect(): void {
    this.disconnect();
    const t = createTransport(this.state.roomCode);
    this.transport = t;
    this.unsub.push(
      t.on((event, payload) => this.onMessage(event, payload)),
      t.onPresence((metas) => this.onPresence(metas)),
      t.onStatus((s) => {
        this.status = s;
        if (s === "connected") this.broadcastAll();
        this.changed();
      }),
    );
    this.loop = setInterval(() => this.step(), LOOP_MS);
  }

  disconnect(): void {
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
    for (const u of this.unsub) u();
    this.unsub = [];
    this.transport?.close();
    this.transport = null;
  }

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  getView = (): HostView => this.view;

  private rebuildView(): void {
    this.view = {
      state: this.state,
      phase: currentPhase(this.state),
      publicData: buildPublic(this.state),
      over: isOver(this.state),
      status: this.status,
      mode: this.transport?.mode ?? "local",
      version: ++this.version,
      phaseVersion: this.phaseVersion,
    };
  }

  private changed(): void {
    this.rebuildView();
    for (const cb of Array.from(this.listeners)) cb();
  }

  /** Input bursts (40 phones answering at once) are coalesced into one React update. */
  private changedSoon(): void {
    if (this.notifyTimer) return;
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null;
      this.changed();
    }, 120);
  }

  /* ---------- clock ---------- */

  /** Rehearsal speed from `/host?speed=10` (1 = real time). */
  get rehearsalSpeed(): number {
    return this.speed;
  }

  now(): number {
    return Date.now();
  }

  remaining() {
    return remaining(this.state, this.now());
  }

  private step(): void {
    const now = this.now();
    if (this.state.startedAt === null) {
      // Lobby: keep the room code and team names across a reload.
      if (now - this.lastSnapshot >= SNAPSHOT_EVERY_MS) this.saveSnapshot();
      return;
    }
    if (!isOver(this.state) && syncToClock(this.state, now)) {
      this.onPhaseChange();
      return;
    }
    if (now - this.lastTick >= 1000 && !isOver(this.state)) {
      this.lastTick = now;
      const r = remaining(this.state, now);
      const phase = currentPhase(this.state);
      this.transport?.send("tick", {
        phaseId: phase?.id ?? "over",
        endsInMs: Math.round(r.phaseMs),
        globalRemainingMs: Math.round(r.globalMs),
        paused: this.state.pausedAt !== null,
      });
    }
    if (now - this.lastSnapshot >= SNAPSHOT_EVERY_MS) this.saveSnapshot();
  }

  private onPhaseChange(): void {
    this.phaseVersion++;
    this.lastTick = this.now();
    this.saveSnapshot();
    const phase = currentPhase(this.state);
    if (!phase || MAP_PHASES.has(phase.kind)) this.broadcastMap();
    this.broadcastPhase();
    this.changed();
  }

  /* ---------- snapshots ---------- */

  private loadSnapshot(): GameState | null {
    if (this.noStore) return null;
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as GameState;
      if (s.version !== STATE_VERSION || !s.roomCode || !Array.isArray(s.tiles)) return null;
      return s;
    } catch {
      return null;
    }
  }

  private saveSnapshot(): void {
    this.lastSnapshot = this.now();
    if (this.noStore) return;
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(this.state));
    } catch {
      /* storage full or blocked: the game still runs, it just can't resume after a reload */
    }
  }

  /* ---------- host actions ---------- */

  start(): void {
    if (this.state.startedAt !== null) return;
    startGame(this.state, this.now(), this.speed);
    this.broadcastLobby();
    this.onPhaseChange();
  }

  /** Throw the current room away and open a new lobby with a new code. */
  newRoom(): void {
    const manual = this.state.manualMode;
    const names = this.state.teams.map((t) => t.name);
    this.disconnect();
    this.state = createGame(makeRoomCode(), (Math.random() * 2 ** 31) >>> 0);
    this.state.manualMode = manual;
    this.state.teams.forEach((t, i) => (t.name = names[i]));
    this.presentIds.clear();
    this.phaseVersion++;
    this.saveSnapshot();
    this.connect();
    this.changed();
  }

  togglePause(): void {
    if (this.state.startedAt === null || isOver(this.state)) return;
    if (this.state.pausedAt === null) pauseGame(this.state, this.now());
    else resumeGame(this.state, this.now());
    this.saveSnapshot();
    this.broadcastPhase();
    this.changed();
  }

  renameTeam(teamId: TeamId, name: string): void {
    const clean = cleanName(name, this.state.teams[teamId].name).slice(0, 12);
    this.state.teams[teamId].name = clean;
    this.saveSnapshot();
    this.broadcastLobby();
    this.changed();
  }

  kick(playerId: string): void {
    removePlayer(this.state, playerId);
    this.transport?.send("kicked", { playerId });
    this.broadcastLobby();
    this.changed();
  }

  setManualMode(on: boolean): void {
    this.state.manualMode = on;
    this.state.manual = emptyManual();
    this.saveSnapshot();
    this.changed();
  }

  setManualPass(teamId: TeamId, pass: boolean): void {
    this.state.manual.pass[teamId] = pass;
    this.changed();
  }
  setManualDest(teamId: TeamId, dest: string | null): void {
    this.state.manual.dests[teamId] = dest;
    this.changed();
  }
  setManualStars(slot: 0 | 1, stars: number): void {
    this.state.manual.stars[slot] = stars;
    this.changed();
  }

  /* ---------- incoming ---------- */

  private onPresence(metas: PresenceMeta[]): void {
    const present = new Map<string, PlayerInfo>();
    for (const m of metas) {
      if (m && typeof m.playerId === "string" && isTeamId(m.teamId)) present.set(m.playerId, m);
      for (const x of m?.extra ?? []) if (x && typeof x.playerId === "string" && isTeamId(x.teamId)) present.set(x.playerId, x);
    }
    this.presentIds = new Set(present.keys());
    let lobbyChanged = false;
    // A phone that is present but unknown (e.g. the host tab was reloaded) is simply re-added.
    for (const [id, info] of present) {
      if (!this.state.players[id]) {
        addPlayer(this.state, id, cleanName(info.name), info.teamId);
        lobbyChanged = true;
      }
    }
    for (const p of Object.values(this.state.players)) {
      const on = this.presentIds.has(p.id);
      if (p.connected !== on) {
        p.connected = on;
        lobbyChanged = true;
      }
    }
    if (lobbyChanged) {
      this.broadcastLobby();
      this.changedSoon();
    }
  }

  private onMessage(event: string, payload: unknown): void {
    const p = (payload ?? {}) as Record<string, unknown>;
    const playerId = typeof p.playerId === "string" ? p.playerId.slice(0, 40) : "";
    if (!playerId) return;
    switch (event as keyof ClientEvents) {
      case "hello":
        // Many phones reconnecting together get one combined resend.
        if (!this.helloTimer) {
          this.helloTimer = setTimeout(() => {
            this.helloTimer = null;
            this.broadcastAll();
          }, 150);
        }
        break;
      case "join": {
        if (!isTeamId(p.teamId)) return;
        const player = addPlayer(this.state, playerId, cleanName(p.name), p.teamId);
        player.connected = true;
        this.broadcastLobby();
        this.changedSoon();
        break;
      }
      case "leave":
        if (this.state.startedAt === null) removePlayer(this.state, playerId);
        else if (this.state.players[playerId]) this.state.players[playerId].connected = false;
        this.broadcastLobby();
        this.changedSoon();
        break;
      case "answer":
        if (submitAnswer(this.state, playerId, String(p.phaseId), p.choice, this.now())) this.changedSoon();
        break;
      case "vote":
        if (submitVote(this.state, playerId, String(p.phaseId), p.destination)) {
          this.scheduleTally();
          this.changedSoon();
        }
        break;
      case "rating":
        if (submitRating(this.state, playerId, String(p.phaseId), p as never)) this.changedSoon();
        break;
      default:
        break;
    }
  }

  /* ---------- outgoing ---------- */

  lobbyMsg(): LobbyMsg {
    return {
      roomCode: this.state.roomCode,
      seed: this.state.seed,
      started: this.state.startedAt !== null,
      teams: this.state.teams.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        emblem: t.emblem,
        players: teamMembers(this.state, t.id).map((p) => ({ id: p.id, name: p.name, connected: p.connected })),
      })),
    };
  }

  phaseMsg(): PhaseMsg {
    const phase = currentPhase(this.state);
    const r = remaining(this.state, this.now());
    const kind = phase ? phase.kind : isOver(this.state) ? "over" : "lobby";
    return {
      phaseId: phase?.id ?? kind,
      kind,
      roundIndex: phase?.round ?? 0,
      endsInMs: Math.round(r.phaseMs),
      durationMs: Math.round(r.phaseDurationMs),
      globalRemainingMs: Math.round(r.globalMs),
      paused: this.state.pausedAt !== null,
      publicData: buildPublic(this.state),
    };
  }

  voteTallyMsg(): VoteTallyMsg {
    const teams: VoteTallyMsg["teams"] = {};
    for (const [pid, v] of Object.entries(this.state.inputs.votes)) {
      const player = this.state.players[pid];
      if (!player) continue;
      const row = (teams[player.teamId] ??= {});
      row[v.dest] = (row[v.dest] ?? 0) + 1;
    }
    return { phaseId: currentPhase(this.state)?.id ?? "", teams };
  }

  /** Lobby updates are coalesced: 40 people joining at once produce a handful of messages, not 40. */
  private broadcastLobby(): void {
    if (this.lobbyTimer) return;
    this.lobbyTimer = setTimeout(() => {
      this.lobbyTimer = null;
      this.transport?.send("lobby", this.lobbyMsg());
    }, 120);
  }
  private broadcastPhase(): void {
    this.transport?.send("phase", this.phaseMsg());
  }
  private broadcastMap(): void {
    this.transport?.send("map", { tiles: this.state.tiles });
  }
  private broadcastAll(): void {
    this.broadcastLobby();
    if (this.state.startedAt !== null) {
      this.broadcastMap();
      this.broadcastPhase();
      if (currentPhase(this.state)?.kind === "vote") this.transport?.send("voteTally", this.voteTallyMsg());
    }
  }
  private scheduleTally(): void {
    if (this.tallyTimer) return;
    this.tallyTimer = setTimeout(() => {
      this.tallyTimer = null;
      if (currentPhase(this.state)?.kind === "vote") this.transport?.send("voteTally", this.voteTallyMsg());
    }, 300);
  }

  /* ---------- derived, for the HUD ---------- */

  /** How many connected members of each team have submitted an input this phase. */
  inputProgress(): { done: number; total: number }[] {
    const phase = currentPhase(this.state);
    const src =
      phase?.kind === "vote" ? this.state.inputs.votes : phase?.kind === "spotRate" ? this.state.inputs.ratings : this.state.inputs.answers;
    return this.state.teams.map((t) => {
      const members = teamMembers(this.state, t.id).filter((p) => p.connected || src[p.id]);
      return { done: members.filter((p) => src[p.id]).length, total: members.length };
    });
  }

  elapsed(): number {
    return elapsedMs(this.state, this.now());
  }

  totalPhases(): number {
    return TIMELINE.length;
  }
}
