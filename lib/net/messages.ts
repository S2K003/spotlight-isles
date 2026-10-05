import type { CardId, PhaseKind, PublicData, Rating, TeamId, Tile } from "@/lib/engine/types";

/** Channel name for a room: `spotlight:{ROOMCODE}`. */
export const channelName = (roomCode: string): string => `spotlight:${roomCode}`;

export interface PlayerInfo {
  playerId: string;
  name: string;
  teamId: TeamId;
}

/** Presence payload tracked by each phone. `extra` lets the bot simulator carry many players on one socket. */
export interface PresenceMeta extends PlayerInfo {
  extra?: PlayerInfo[];
}

/* ---------- host → all ---------- */

export interface LobbyTeam {
  id: TeamId;
  name: string;
  color: string;
  emblem: string;
  players: { id: string; name: string; connected: boolean }[];
}

export interface LobbyMsg {
  roomCode: string;
  seed: number;
  started: boolean;
  teams: LobbyTeam[];
}

export interface PhaseMsg {
  phaseId: string;
  kind: PhaseKind | "lobby";
  roundIndex: number;
  /** Real milliseconds until this phase ends. Phones run their own smooth countdown from this. */
  endsInMs: number;
  durationMs: number;
  globalRemainingMs: number;
  paused: boolean;
  /**
   * Everything a phone needs for this phase. The spec's separate `reveal`, `resolution`,
   * `spotlight`, `results` and `debrief` events are carried here so a phone that (re)joins
   * mid-phase gets the whole picture from one message.
   */
  publicData: PublicData;
}

export interface TickMsg {
  phaseId: string;
  endsInMs: number;
  globalRemainingMs: number;
  paused: boolean;
}

export interface MapMsg {
  tiles: Tile[];
}

export interface VoteTallyMsg {
  phaseId: string;
  /** teamId → destination ("q,r" or "hold") → number of votes. Each phone only shows its own team. */
  teams: Record<number, Record<string, number>>;
}

export interface KickedMsg {
  playerId: string;
}

export interface HostEvents {
  lobby: LobbyMsg;
  phase: PhaseMsg;
  tick: TickMsg;
  map: MapMsg;
  voteTally: VoteTallyMsg;
  kicked: KickedMsg;
}

/* ---------- phone → host ---------- */

export interface ClientEvents {
  /** Sent on (re)join to request the current lobby, phase and map. */
  hello: { playerId: string };
  join: PlayerInfo;
  leave: { playerId: string };
  answer: { playerId: string; phaseId: string; choice: number | number[] };
  vote: { playerId: string; phaseId: string; destination: string; card?: CardId | "none" };
  rating: { playerId: string; phaseId: string; speakerTeamId: TeamId } & Rating;
}

export type EventName = keyof HostEvents | keyof ClientEvents;
export const HOST_EVENTS: (keyof HostEvents)[] = ["lobby", "phase", "tick", "map", "voteTally", "kicked"];

const BLOCKLIST = ["fuck", "shit", "cunt", "bitch", "dick", "cock", "pussy", "nigg", "fag", "slut", "whore", "rape", "nazi", "penis", "vagina"];

/** Trim to 12 characters and apply a simple profanity filter. */
export function cleanName(raw: unknown, fallback = "Player"): string {
  const name = String(raw ?? "")
    .replace(/[\u0000-\u001f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12);
  if (!name) return fallback;
  const squashed = name.toLowerCase().replace(/[^a-z]/g, "");
  if (BLOCKLIST.some((w) => squashed.includes(w))) return `${fallback}${Math.floor(100 + Math.random() * 900)}`;
  return name;
}

export function isTeamId(v: unknown): v is TeamId {
  return Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 5;
}
