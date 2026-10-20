import type { Difficulty, GameMode } from "@/lib/sudoku/types";
import { addDays } from "@/lib/daily/date";

/**
 * Competitive rules, enforced on the server.
 *
 * - Only registered users are ranked; guests still get verified results.
 * - Any hint makes a game unranked (it still counts for stats and streaks).
 * - Ranked time is server wall-clock in every mode: created → verified
 *   completion. The browser's timer is never trusted. Pausing hides the board
 *   but does not stop the ranked clock.
 * - A result needs a move log that reproduces the submitted board.
 * - Times faster than MIN_MS_PER_EMPTY_CELL per empty cell are implausible.
 * - Daily results are ranked only when completed on the challenge's UTC date.
 */
export const MIN_MS_PER_EMPTY_CELL = 1000;

export type IneligibleReason = "guest" | "hints" | "replay-mismatch" | "implausible-time" | "late";

export const INELIGIBLE_LABEL: Record<IneligibleReason, string> = {
  guest: "Sign in to appear on leaderboards",
  hints: "Hints were used",
  "replay-mismatch": "Move history could not be verified",
  "implausible-time": "Completion time could not be verified",
  late: "Completed after the challenge day",
};

export interface EligibilityInput {
  mode: GameMode;
  isRegistered: boolean;
  hints: number;
  replayConsistent: boolean;
  timeMs: number;
  emptyCells: number;
  dailyKey: string | null;
  completedDateKey: string;
}

/** Returns the first reason a result is unranked, or null when it is ranked. */
export function ineligibility(input: EligibilityInput): IneligibleReason | null {
  if (!input.replayConsistent) return "replay-mismatch";
  if (input.timeMs < input.emptyCells * MIN_MS_PER_EMPTY_CELL) return "implausible-time";
  if (input.mode === "daily" && input.dailyKey !== input.completedDateKey) return "late";
  if (input.hints > 0) return "hints";
  if (!input.isRegistered) return "guest";
  return null;
}

export interface StreakState {
  current: number;
  best: number;
  lastDateKey: string | null;
}

/** Advances a daily streak after completing the challenge for `dateKey` on that day. */
export function advanceStreak(streak: StreakState, dateKey: string): StreakState {
  if (streak.lastDateKey === dateKey) return streak;
  const current = streak.lastDateKey === addDays(dateKey, -1) ? streak.current + 1 : 1;
  return { current, best: Math.max(streak.best, current), lastDateKey: dateKey };
}

/** The streak as it should be displayed today (it lapses after a missed day). */
export function displayStreak(streak: StreakState, todayKey: string): number {
  if (!streak.lastDateKey) return 0;
  if (streak.lastDateKey === todayKey || streak.lastDateKey === addDays(todayKey, -1)) return streak.current;
  return 0;
}

/** Daily difficulty rotates through the week (UTC). */
export function dailyDifficulty(dateKey: string): Difficulty {
  const day = new Date(`${dateKey}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  if (day === 1 || day === 2) return "easy";
  if (day === 3 || day === 4) return "medium";
  return "hard";
}
