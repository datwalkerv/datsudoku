import type { Difficulty, GameMode, Move, PuzzleSource } from "@/lib/sudoku/types";
import type { IneligibleReason } from "./rules";

/** Game record as exchanged with the client (never contains the solution). */
export interface GameDTO {
  id: string;
  mode: GameMode;
  difficulty: Difficulty;
  seed: string;
  source: PuzzleSource;
  givens: string;
  board: string;
  notes: number[];
  moves: Move[];
  mistakes: number;
  hintsUsed: number;
  elapsedSeconds: number;
  status: "active" | "completed";
  version: number;
  startedAt: string;
  updatedAt: string;
  dailyKey: string | null;
  roomCode: string | null;
  round: number | null;
  result: ResultDTO | null;
}

export interface ResultDTO {
  id: string;
  gameId: string;
  mode: GameMode;
  difficulty: Difficulty;
  timeMs: number;
  mistakes: number;
  hintsUsed: number;
  ranked: boolean;
  reason: IneligibleReason | null;
  completedAt: string;
  /** True when this result set a new personal best. */
  personalBest?: boolean;
}

export interface GameSummaryDTO {
  id: string;
  mode: GameMode;
  difficulty: Difficulty;
  status: "active" | "completed";
  filled: number;
  elapsedSeconds: number;
  updatedAt: string;
  dailyKey: string | null;
  roomCode: string | null;
}

export interface ApiError {
  error: string;
  code: string;
}
