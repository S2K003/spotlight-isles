export type CriterionKey = "structure" | "visuals" | "delivery" | "engagement" | "timing" | "qa";
export type TileType = "land" | "water" | "fog" | "swamp" | "stage" | "plaza";
export type TeamId = 0 | 1 | 2 | 3 | 4 | 5;
export type CardId = "hook" | "rehearsed" | "heckler" | "micdrop";

export interface Hex {
  q: number;
  r: number;
}

export interface Tile {
  q: number;
  r: number;
  type: TileType;
  region: CriterionKey | "plaza";
  owner?: TeamId;
  chest?: boolean;
  height: number;
}

export interface Mod {
  kind: "hook" | "swamp" | "heckler";
  delta: number;
}

export interface Team {
  id: TeamId;
  name: string;
  color: string;
  emblem: string;
  pos: Hex;
  home: Hex;
  cards: CardId[];
  pendingMods: Mod[];
  score: number;
}

export interface PlayerStats {
  answered: number;
  correct: number;
  /** Sum of host-measured answer times for correct answers. */
  correctMs: number;
  ratings: number;
  /** Sum of |own overall rating − room overall| across the speakers this player rated. */
  ratingDev: number;
  spotlight?: number;
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
  | "finalBanner"
  | "finalQ"
  | "finalReveal"
  | "finalFlood"
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
  answers: Record<string, { choice: number | number[]; atMs: number }>;
  votes: Record<string, { dest: string; card: CardId | "none" }>;
  ratings: Record<string, Rating>;
}

export interface TeamRoundResult {
  teamId: TeamId;
  members: number;
  correct: number;
  accuracy: number;
  medianMs: number | null;
  baseMp: number;
  quickDraw: boolean;
  mods: Mod[];
  mp: number;
  roundScore: number;
  stageFright: boolean;
  /** Spotlight rounds only. */
  speaker?: boolean;
  fairJudge?: boolean;
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

export type CardFx =
  | { card: "hook" }
  | { card: "rehearsed" }
  | { card: "heckler"; target: TeamId }
  | { card: "micdrop"; tiles: string[] };

export interface MoveResult {
  teamId: TeamId;
  /** Final path, origin first. Length 1 means the ship did not move. */
  path: Hex[];
  intended: Hex[];
  clashAt?: Hex;
  cardFx: CardFx[];
  /** Keys of tiles this team ends up owning because of this move (in paint order). */
  painted: string[];
  pickup?: CardId;
  swamp?: boolean;
}

export interface SpotState {
  teams: [TeamId, TeamId];
  speakers: [string | null, string | null];
  speakerNames: [string, string];
  topics: [string, string];
  twists: [string, string];
  ratings: [Record<string, Rating>, Record<string, Rating>];
  results?: [SpeakerResult, SpeakerResult];
}

export interface FinalQResult {
  accuracy: number[];
  medianMs: (number | null)[];
  passed: boolean[];
}

export interface FinalClaim {
  teamId: TeamId;
  key: string;
  wave: number;
}

export interface FinalState {
  qids: string[];
  bottom3: TeamId[];
  perQ: FinalQResult[];
  claims?: FinalClaim[];
  stageWinner?: TeamId | null;
}

export interface RoundWork {
  round: number;
  kind: "standard" | "spotlight" | "final";
  criterion?: CriterionKey;
  /** Current question id + option permutation: shuffled[i] = original[perm[i]]. */
  q?: { id: string; perm: number[] };
  /** Modifiers taken from each team at round start (consumed this round). */
  mods: Mod[][];
  teamResults?: TeamRoundResult[];
  playerCorrect?: Record<string, boolean>;
  reach?: Record<number, ReachItem[]>;
  dests?: (string | null)[];
  cards?: (CardId | null)[];
  moves?: MoveResult[];
  spot?: SpotState;
}

export interface ReachItem {
  key: string;
  cost: number;
}

export interface RoundSummary {
  round: number;
  kind: "standard" | "spotlight" | "final";
  criterion?: CriterionKey;
  questionId?: string;
  mp: number[];
  scores: number[];
}

export interface ManualState {
  /** Accuracy band per team: 0 = 0%, 1 = 1–49, 2 = 50–79, 3 = 80+. */
  bands: (number | null)[];
  quickDraw: TeamId | null;
  dests: (string | null)[];
  cards: (CardId | null)[];
  stars: [number | null, number | null];
  /** Final Showdown: each team's show-of-hands answer (0 = True, 1 = False), so the key stays hidden. */
  finalAnswers: (number | null)[];
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
  history: RoundSummary[];
  cur: RoundWork | null;
  final: FinalState | null;
  usedQuestions: string[];
  usedCriteria: CriterionKey[];
  critStats: Record<CriterionKey, StatCount>;
  questionStats: Record<string, StatCount>;
  spotTotals: { hook: number; clarity: number; confidence: number; n: number };
  stageOwner: TeamId | null;
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
  type: "mcq" | "order" | "slide" | "tf";
  prompt: string;
  options: string[];
  slide?: SlideSpec;
}

export interface RevealData {
  /** mcq/slide/tf: index into the shuffled options. order: the shuffled indexes in the correct order. */
  correct: number | number[];
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
  cards: CardId[];
  score: number;
  tiles: number;
  mp: number | null;
  players: number;
}

export interface SpotPublic {
  teams: [TeamId, TeamId];
  speakers: [{ id: string | null; name: string }, { id: string | null; name: string }];
  slot: 0 | 1;
  topic: string;
  twist: string;
  results?: [SpeakerResult, SpeakerResult];
}

export interface FinalPublic {
  qIndex: number;
  bottom3: TeamId[];
  perQ: FinalQResult[];
  claims?: FinalClaim[];
  stageWinner?: TeamId | null;
}

export interface RankRow {
  teamId: TeamId;
  rank: number;
  score: number;
  tiles: number;
  mastery: CriterionKey[];
  stage: boolean;
}

export interface Award {
  key: "speaker" | "quick" | "judge" | "master";
  icon: string;
  title: string;
  playerId: string | null;
  name: string;
  teamId: TeamId | null;
  detail: string;
}

export interface PersonalStats {
  correct: number;
  answered: number;
  avgMs: number | null;
  ratings: number;
  spotlight: number | null;
}

export interface ResultsData {
  ranking: RankRow[];
  awards: Award[];
  personal: Record<string, PersonalStats>;
}

export interface DebriefData {
  criteria: Record<CriterionKey, number | null>;
  spotlight: { hook: number; clarity: number; confidence: number } | null;
  strongest: CriterionKey | null;
  weakest: CriterionKey | null;
  takeaways: string[];
  prompt: string;
}

export interface PublicData {
  teams: TeamPublic[];
  round: number;
  totalRounds: number;
  roundKind: "standard" | "spotlight" | "final" | null;
  criterion?: CriterionKey;
  question?: PublicQuestion;
  reveal?: RevealData;
  teamResults?: TeamRoundResult[];
  reach?: Record<number, ReachItem[]>;
  moves?: MoveResult[];
  spot?: SpotPublic;
  final?: FinalPublic;
  results?: ResultsData;
  debrief?: DebriefData;
  manualMode: boolean;
}
