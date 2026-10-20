import "server-only";
import type { ObjectId } from "mongodb";
import { db } from "./mongodb";
import type { Difficulty, GameMode, Move, PuzzleSource } from "@/lib/sudoku/types";

export type PuzzleUsage = "pool" | "daily" | "room";

export interface PuzzleDoc {
  _id: ObjectId;
  /** Stable public identifier; one seed always maps to this puzzle. */
  seed: string;
  source: PuzzleSource;
  externalPuzzleId: string | null;
  difficulty: Difficulty;
  /** 81 digits, 0 = empty. */
  puzzle: string;
  /** 81 digits. Never sent to clients. */
  solution: string;
  validationStatus: "valid" | "rejected";
  /** Pool puzzles are reused for Classic; daily/room puzzles are reserved. */
  usage: PuzzleUsage;
  createdAt: Date;
  metadata: {
    requestedDifficulty?: string;
    reportedDifficulty?: string;
    clues: number;
    logicLevel?: number;
    latencyMs?: number;
    solutionSource?: "api" | "solver" | "generator";
    fallbackReason?: string;
    rejectionReason?: string;
  };
}

export type GameStatus = "active" | "completed";

export interface GameDoc {
  _id: ObjectId;
  userId: string;
  puzzleId: ObjectId;
  /** Denormalized from the puzzle so a game loads with one read. */
  seed: string;
  source: PuzzleSource;
  mode: GameMode;
  difficulty: Difficulty;
  roomId?: ObjectId;
  roomCode?: string;
  round?: number;
  dailyKey?: string;
  givens: string;
  board: string;
  notes: number[];
  moves: Move[];
  mistakes: number;
  /** Hints counted by the client. */
  hintsUsed: number;
  /** Hints granted by the server (ranked modes). */
  serverHints: number;
  elapsedSeconds: number;
  status: GameStatus;
  /** Incremented on every accepted save; used for optimistic concurrency. */
  version: number;
  /** Server clock when the game was created. */
  startedAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface EligibilityInfo {
  ranked: boolean;
  /** Why the result is not ranked, when it is not. */
  reason: string | null;
}

export interface GameResultDoc {
  _id: ObjectId;
  userId: string;
  gameId: ObjectId;
  puzzleId: ObjectId;
  mode: GameMode;
  difficulty: Difficulty;
  roomId: ObjectId | null;
  round: number | null;
  dailyKey: string | null;
  /** Ranked time in milliseconds (see lib/games/complete.ts for the rules). */
  timeMs: number;
  /** Wall-clock milliseconds between server start and server completion. */
  wallMs: number;
  /** Time the client reported as actively played. */
  clientMs: number;
  mistakes: number;
  hintsUsed: number;
  completedAt: Date;
  isRegistered: boolean;
  eligible: EligibilityInfo;
}

export interface PersonalBestDoc {
  _id: ObjectId;
  userId: string;
  mode: GameMode;
  difficulty: Difficulty;
  resultId: ObjectId;
  timeMs: number;
  mistakes: number;
  completedAt: Date;
}

export interface DailyChallengeDoc {
  _id: ObjectId;
  /** UTC date, YYYY-MM-DD. */
  dateKey: string;
  puzzleId: ObjectId;
  difficulty: Difficulty;
  createdAt: Date;
}

export interface RoomParticipant {
  userId: string;
  name: string;
  joinedAt: Date;
}

export interface RoomRound {
  round: number;
  seed: string;
  puzzleId: ObjectId;
  difficulty: Difficulty;
  startedAt: Date;
}

export interface RoomDoc {
  _id: ObjectId;
  code: string;
  hostUserId: string;
  participants: RoomParticipant[];
  rounds: RoomRound[];
  currentRound: number;
  status: "open" | "closed";
  settings: { difficulty: Difficulty; maxPlayers: number };
  createdAt: Date;
  expiresAt: Date;
}

export interface UserStatsDoc {
  _id: ObjectId;
  userId: string;
  completed: Partial<Record<Difficulty, number>>;
  totalTimeMs: Partial<Record<Difficulty, number>>;
  hintsUsed: number;
  mistakes: number;
  dailyStreak: { current: number; best: number; lastDateKey: string | null };
  updatedAt: Date;
}

export const collections = {
  puzzles: () => db.collection<PuzzleDoc>("puzzles"),
  games: () => db.collection<GameDoc>("games"),
  results: () => db.collection<GameResultDoc>("gameResults"),
  personalBests: () => db.collection<PersonalBestDoc>("personalBests"),
  daily: () => db.collection<DailyChallengeDoc>("dailyChallenges"),
  rooms: () => db.collection<RoomDoc>("multiplayerRooms"),
  stats: () => db.collection<UserStatsDoc>("userStats"),
};

let indexesReady: Promise<void> | null = null;

/** Creates indexes once per function instance (createIndexes is idempotent). */
export function ensureIndexes(): Promise<void> {
  indexesReady ??= createAllIndexes().catch((error) => {
    indexesReady = null;
    throw error;
  });
  return indexesReady;
}

async function createAllIndexes() {
  await Promise.all([
    collections.puzzles().createIndexes([
      { key: { seed: 1 }, unique: true, name: "seed_unique" },
      { key: { puzzle: 1 }, unique: true, name: "puzzle_unique" },
      { key: { source: 1, externalPuzzleId: 1 }, name: "source_external" },
      { key: { usage: 1, difficulty: 1, validationStatus: 1 }, name: "pool_lookup" },
    ]),
    collections.games().createIndexes([
      { key: { userId: 1, updatedAt: -1 }, name: "user_recent" },
      { key: { userId: 1, status: 1, updatedAt: -1 }, name: "user_status" },
      {
        key: { userId: 1, dailyKey: 1 },
        unique: true,
        name: "one_daily_game_per_user",
        partialFilterExpression: { mode: "daily" },
      },
      {
        key: { roomId: 1, round: 1, userId: 1 },
        unique: true,
        name: "one_room_game_per_round",
        partialFilterExpression: { mode: "room" },
      },
    ]),
    collections.results().createIndexes([
      { key: { gameId: 1 }, unique: true, name: "one_result_per_game" },
      { key: { userId: 1, completedAt: -1 }, name: "user_history" },
      {
        key: { mode: 1, dailyKey: 1, "eligible.ranked": 1, timeMs: 1, mistakes: 1, completedAt: 1, _id: 1 },
        name: "daily_board",
      },
      { key: { roomId: 1, round: 1, timeMs: 1, mistakes: 1, completedAt: 1, _id: 1 }, name: "room_board" },
    ]),
    collections.personalBests().createIndexes([
      { key: { userId: 1, mode: 1, difficulty: 1 }, unique: true, name: "one_best_per_category" },
      { key: { mode: 1, difficulty: 1, timeMs: 1, mistakes: 1, completedAt: 1, _id: 1 }, name: "global_board" },
    ]),
    collections.daily().createIndexes([{ key: { dateKey: 1 }, unique: true, name: "one_puzzle_per_date" }]),
    collections.rooms().createIndexes([
      { key: { code: 1 }, unique: true, name: "code_unique" },
      { key: { expiresAt: 1 }, expireAfterSeconds: 0, name: "room_ttl" },
      { key: { "participants.userId": 1, createdAt: -1 }, name: "user_rooms" },
    ]),
    collections.stats().createIndexes([{ key: { userId: 1 }, unique: true, name: "stats_user" }]),
  ]);
}

export function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === 11000;
}
