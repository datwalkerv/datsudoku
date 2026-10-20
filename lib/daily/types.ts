import type { Difficulty } from "@/lib/sudoku/types";

export interface DailyStatus {
  dateKey: string;
  difficulty: Difficulty;
  game: { id: string; status: "active" | "completed"; filled: number } | null;
  result: { timeMs: number; ranked: boolean; reason: string | null } | null;
  participants: number;
  /** The viewer's current daily streak (0 when lapsed). */
  streak: number;
}
