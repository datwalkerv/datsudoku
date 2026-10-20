import type { Difficulty, GameMode } from "@/lib/sudoku/types";
import type { ResultDTO } from "@/lib/games/types";

export interface StatsDTO {
  totalCompleted: number;
  activeGames: number;
  hintsUsed: number;
  mistakes: number;
  byDifficulty: { difficulty: Difficulty; completed: number; averageMs: number | null }[];
  personalBests: { mode: GameMode; difficulty: Difficulty; timeMs: number; mistakes: number; completedAt: string }[];
  streak: { current: number; best: number; lastDateKey: string | null };
  recent: ResultDTO[];
}
