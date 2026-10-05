import type { CardId, Rating, TeamId, Tile } from "@/lib/engine/types";
import type { LobbyMsg, MapMsg, PhaseMsg, TickMsg, VoteTallyMsg } from "./messages";
import { createTransport, type Transport, type TransportStatus } from "./transport";

export interface Identity {
  playerId: string;
  name: string;
  teamId: TeamId | null;
}

export interface ClientView {
  status: TransportStatus;
  mode: "supabase" | "local";
  me: Identity;
  lobby: LobbyMsg | null;
  phase: PhaseMsg | null;
  /** performance.now() timestamps for smooth local countdowns. */
  phaseEndsAt: number;
  globalEndsAt: number;
  paused: boolean;
  tiles: Tile[] | null;
  /** Live votes of my own team: destination → count. */
  tally: Record<string, number>;
  /** What I have already sent in the current phase. */
  sent: { answer?: number | number[]; vote?: { dest: string; card: CardId | "none" }; rating?: Rating };
  kicked: boolean;
}

const idKey = (code: string) => `spotlight-isles:player:${code}`;

function newId(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 14);
}

export function loadIdentity(code: string): Identity {
  try {
    const raw = localStorage.getItem(idKey(code));
    if (raw) {
      const v = JSON.parse(raw) as Identity;
      if (v && typeof v.playerId === "string") return { playerId: v.playerId, name: v.name ?? "", teamId: v.teamId ?? null };
    }
  } catch {
    /* private mode */
  }
  return { playerId: newId(), name: "", teamId: null };
}

function saveIdentity(code: string, me: Identity): void {
  try {
    localStorage.setItem(idKey(code), JSON.stringify(me));
  } catch {
    /* private mode */
  }
}

/** Phone-side store: a thin client that sends inputs and keeps the latest state from the host. */
export class GameClient {
  private transport: Transport | null = null;
  private listeners = new Set<() => void>();
  private view: ClientView;
  private unsub: (() => void)[] = [];
  private helloTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private code: string) {
    this.view = {
      status: "connecting",
      mode: "local",
      me: loadIdentity(code),
      lobby: null,
      phase: null,
      phaseEndsAt: 0,
      globalEndsAt: 0,
      paused: false,
      tiles: null,
      tally: {},
      sent: {},
      kicked: false,
    };
  }

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };
  getView = (): ClientView => this.view;

  private set(patch: Partial<ClientView>): void {
    this.view = { ...this.view, ...patch };
    for (const cb of Array.from(this.listeners)) cb();
  }

  connect(): void {
    this.close();
    const t = createTransport(this.code);
    this.transport = t;
    this.set({ mode: t.mode });
    this.unsub.push(
      t.on((event, payload) => this.onMessage(event, payload)),
      t.onStatus((status) => {
        this.set({ status });
        if (status === "connected") this.hello();
      }),
    );
    // Keep asking until the host answers (it may open the room a little after the phone does).
    this.helloTimer = setInterval(() => {
      if (!this.view.lobby && this.view.status === "connected") this.hello();
    }, 2500);
  }

  close(): void {
    if (this.helloTimer) clearInterval(this.helloTimer);
    this.helloTimer = null;
    for (const u of this.unsub) u();
    this.unsub = [];
    this.transport?.close();
    this.transport = null;
  }

  private hello(): void {
    const { me } = this.view;
    // Reopening the link resumes instantly: re-announce the saved identity, then ask for state.
    if (me.teamId !== null && me.name) {
      this.transport?.send("join", { playerId: me.playerId, name: me.name, teamId: me.teamId });
      this.transport?.track({ playerId: me.playerId, name: me.name, teamId: me.teamId });
    }
    this.transport?.send("hello", { playerId: me.playerId });
  }

  private onMessage(event: string, payload: unknown): void {
    const now = performance.now();
    switch (event) {
      case "lobby": {
        const lobby = payload as LobbyMsg;
        const me = this.view.me;
        const mine = lobby.teams.flatMap((t) => t.players.map((p) => ({ ...p, teamId: t.id }))).find((p) => p.id === me.playerId);
        // The host is authoritative for my name (it may have been filtered) and team.
        if (mine && (mine.name !== me.name || mine.teamId !== me.teamId)) {
          const next = { ...me, name: mine.name, teamId: mine.teamId };
          saveIdentity(this.code, next);
          this.set({ lobby, me: next });
        } else {
          this.set({ lobby });
        }
        break;
      }
      case "phase": {
        const phase = payload as PhaseMsg;
        const samePhase = this.view.phase?.phaseId === phase.phaseId;
        const lobby = this.view.lobby;
        this.set({
          phase,
          // A phase message is proof the game is running, even if the lobby update was missed.
          lobby: lobby && !lobby.started && phase.kind !== "lobby" ? { ...lobby, started: true } : lobby,
          phaseEndsAt: now + phase.endsInMs,
          globalEndsAt: now + phase.globalRemainingMs,
          paused: phase.paused,
          sent: samePhase ? this.view.sent : {},
          tally: samePhase ? this.view.tally : {},
        });
        break;
      }
      case "tick": {
        const tick = payload as TickMsg;
        if (!this.view.phase || tick.phaseId !== this.view.phase.phaseId) {
          this.hello(); // we missed a phase message
          break;
        }
        const target = now + tick.endsInMs;
        if (Math.abs(target - this.view.phaseEndsAt) > 350 || tick.paused !== this.view.paused) {
          this.set({ phaseEndsAt: target, globalEndsAt: now + tick.globalRemainingMs, paused: tick.paused });
        }
        break;
      }
      case "map":
        this.set({ tiles: (payload as MapMsg).tiles });
        break;
      case "voteTally": {
        const msg = payload as VoteTallyMsg;
        const team = this.view.me.teamId;
        if (team !== null && msg.phaseId === this.view.phase?.phaseId) this.set({ tally: msg.teams[team] ?? {} });
        break;
      }
      case "kicked":
        if ((payload as { playerId: string }).playerId === this.view.me.playerId) {
          const me = { ...this.view.me, teamId: null };
          saveIdentity(this.code, me);
          this.transport?.track(null);
          this.set({ kicked: true, me });
        }
        break;
      default:
        break;
    }
  }

  /* ---------- actions ---------- */

  join(name: string, teamId: TeamId): void {
    const me = { ...this.view.me, name, teamId };
    saveIdentity(this.code, me);
    this.set({ me, kicked: false });
    this.transport?.send("join", { playerId: me.playerId, name, teamId });
    this.transport?.track({ playerId: me.playerId, name, teamId });
  }

  setName(name: string): void {
    const me = { ...this.view.me, name };
    saveIdentity(this.code, me);
    this.set({ me });
  }

  answer(choice: number | number[]): void {
    const phase = this.view.phase;
    if (!phase || this.view.sent.answer !== undefined) return;
    this.transport?.send("answer", { playerId: this.view.me.playerId, phaseId: phase.phaseId, choice });
    this.set({ sent: { ...this.view.sent, answer: choice } });
  }

  vote(dest: string, card: CardId | "none"): void {
    const phase = this.view.phase;
    if (!phase) return;
    this.transport?.send("vote", { playerId: this.view.me.playerId, phaseId: phase.phaseId, destination: dest, card });
    this.set({ sent: { ...this.view.sent, vote: { dest, card } } });
  }

  rate(speakerTeamId: TeamId, rating: Rating): void {
    const phase = this.view.phase;
    if (!phase) return;
    this.transport?.send("rating", { playerId: this.view.me.playerId, phaseId: phase.phaseId, speakerTeamId, ...rating });
    this.set({ sent: { ...this.view.sent, rating } });
  }
}
