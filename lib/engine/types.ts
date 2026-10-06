export type CriterionKey = "structure" | "visuals" | "delivery" | "engagement" | "timing" | "qa";
export type TileType = "land" | "water" | "stage" | "plaza";
export type TeamId = 0 | 1 | 2 | 3 | 4 | 5;

export interface Hex {
  q: number;
  r: number;
}

export interface Tile {
  q: number;
  r: number;
  type: TileType;
  region: CriterionKey | "plaza";
  /** The last team to fly over this tile. A trail only: it has no effect on the rules. */
  owner?: TeamId;
  /** A key belonging to this team. A team needs its own key to enter the Keynote Stage. */
  key?: TeamId;
  /** A bonus star: worth points to the first team to fly over it. */
  star?: boolean;
  height: number;
}

export interface Team {
  id: TeamId;
  name: string;
  color: string;
  emblem: string;
  pos: Hex;
  home: Hex;
  score: number;
  hasKey: boolean;
  stars: number;
  /** Arrival order at the Keynote Stage (1 = first), or null while still flying. */
  docked: number | null;
}

export interface PlayerStats {
  answered: number;
  correct: number;
  ratings: number;
}

export interface Player {
  id: string;
  name: string;
  teamId: TeamId;
  connected: boolean;
  stats: PlayerStats;
}

export type PhaseKind =
  | "intro"
  | "challenge"
  | "reveal"
  | "vote"
  | "resolve"
  | "spotReady"
  | "spotSpeak"
  | "spotRate"
  | "spotReveal"
  | "results"
  | "debrief"
  | "over";

export interface Phase {
  id: string;
  kind: PhaseKind;
  round?: number;
  startOffsetMs: number;
  durationMs: number;
  meta?: Record<string, unknown>;
}

export interface Rating {
  hook: number;
  clarity: number;
  confidence: number;
}

export interface PhaseInputs {
  answers: Record<string, { choice: number; atMs: number }>;
  votes: Record<string, { dest: string }>;
  ratings: Record<string, Rating>;
}

/** What one team earned in a round. Points are added to the score at the reveal. */
export interface TeamRoundResult {
  teamId: TeamId;
  members: number;
  correct: number;
  accuracy: number;
  /** Steps this team may move this round (0 once docked at the Stage). */
  steps: number;
  points: number;
  /** Pitch rounds only. */
  speaker?: boolean;
  rated?: boolean;
  spotOverall?: number | null;
}

export interface SpeakerResult {
  hook: number | null;
  clarity: number | null;
  confidence: number | null;
  overall: number | null;
  /** Overall average rating given by each rating team (before trimming). */
  teamAverages: Record<number, number>;
  raterTeams: number;
  trimmed: boolean;
}

export interface MoveResult {
  teamId: TeamId;
  /** Position in the move order this round (0 = moved first). */
  order: number;
  /** Final path, origin first. Length 1 means the ship did not move. */
  path: Hex[];
  gotKey?: boolean;
  /** Keys of the star tiles collected on this move. */
  stars: string[];
  /** Arrival order at the Stage if the ship docked on this move. */
  docked?: number;
  /** Points gained on this move (key, stars, docking bonus). */
  bonus: number;
}

export interface SpotState {
  /** Teams that had not pitched before this round's spin. */
  pool: TeamId[];
  teams: [TeamId, TeamId];
  topics: [string, string];
  ratings: [Record<string, Rating>, Record<string, Rating>];
  results?: [SpeakerResult, SpeakerResult];
}

export interface ReachItem {
  key: string;
  cost: number;
}

export interface RoundWork {
  round: number;
  kind: "question" | "spotlight";
  /** Current question id + option permutation: shuffled[i] = original[perm[i]]. */
  q?: { id: string; perm: number[] };
  teamResults?: TeamRoundResult[];
  playerCorrect?: Record<string, boolean>;
  /** Move order for this round: highest score first. */
  order?: TeamId[];
  reach?: Record<number, ReachItem[]>;
  /** The best move for each team ("q,r" or "hold"): flown automatically if the team doesn't choose. */
  suggest?: string[];
  dests?: (string | null)[];
  moves?: MoveResult[];
  spot?: SpotState;
}

export interface ManualState {
  /** Show of hands per team: did at least half get it right? null = not clicked yet (counts as yes). */
  pass: (boolean | null)[];
  dests: (string | null)[];
  stars: [number | null, number | null];
}

export interface StatCount {
  correct: number;
  total: number;
}

export interface GameState {
  version: number;
  roomCode: string;
  seed: number;
  startedAt: number | null;
  pausedMs: number;
  pausedAt: number | null;
  speed: number;
  /** -1 = lobby, TIMELINE.length = over. */
  phaseIndex: number;
  tiles: Tile[];
  teams: Team[];
  players: Record<string, Player>;
  inputs: PhaseInputs;
  cur: RoundWork | null;
  /** How many ships have reached the Stage so far. */
  dockCount: number;
  usedQuestions: string[];
  questionStats: Record<string, StatCount>;
  spotTotals: { hook: number; clarity: number; confidence: number; n: number };
  /** Each team's pitch score (star average), once it has pitched. */
  pitches: (number | null)[];
  /** Teams in the order the spin picked them to pitch. Every team appears exactly once by the end. */
  pitchOrder: TeamId[];
  manualMode: boolean;
  manual: ManualState;
  results: ResultsData | null;
  debrief: DebriefData | null;
}

/* ---------- data sent to phones / rendered by the projector ---------- */

export interface SlideSpec {
  title: string;
  kind: "textwall" | "lowcontrast";
  bullets: string[];
}

export interface PublicQuestion {
  id: string;
  type: "mcq" | "slide";
  prompt: string;
  options: string[];
  slide?: SlideSpec;
}

export interface RevealData {
  /** Index of the correct option in the shuffled options. */
  correct: number;
  correctText: string;
  why: string;
  playerCorrect: Record<string, boolean>;
}

export interface TeamPublic {
  id: TeamId;
  name: string;
  color: string;
  emblem: string;
  pos: Hex;
  home: Hex;
  score: number;
  hasKey: boolean;
  stars: number;
  docked: number | null;
  /** Steps available this round, once known. */
  steps: number | null;
  /** Position in this round's move order (0 = first), once known. */
  order: number | null;
  players: number;
}

export interface SpotPublic {
  /** Teams that had not pitched before this round's spin (the wheel's segments). */
  pool: TeamId[];
  teams: [TeamId, TeamId];
  topics: [string, string];
  slot: 0 | 1;
  results?: [SpeakerResult, SpeakerResult];
}

export interface RankRow {
  teamId: TeamId;
  rank: number;
  score: number;
  stars: number;
  hasKey: boolean;
  docked: number | null;
  pitch: number | null;
}

export interface PersonalStats {
  correct: number;
  answered: number;
  ratings: number;
}

export interface ResultsData {
  ranking: RankRow[];
  /** The team with the highest-rated pitch. */
  bestPitch: TeamId | null;
  personal: Record<string, PersonalStats>;
}

export interface DebriefData {
  /** The questions asked, hardest for the room first. */
  questions: { id: string; prompt: string; accuracy: number | null; why: string }[];
  /** Room-average stars for the three pitch criteria. */
  spotlight: Rating | null;
  strongest: keyof Rating | null;
  weakest: keyof Rating | null;
  takeaways: string[];
  prompt: string;
}

export interface PublicData {
  teams: TeamPublic[];
  round: number;
  totalRounds: number;
  roundKind: "question" | "spotlight" | null;
  question?: PublicQuestion;
  reveal?: RevealData;
  teamResults?: TeamRoundResult[];
  order?: TeamId[];
  reach?: Record<number, ReachItem[]>;
  suggest?: string[];
  moves?: MoveResult[];
  spot?: SpotPublic;
  results?: ResultsData;
  debrief?: DebriefData;
  manualMode: boolean;
}
