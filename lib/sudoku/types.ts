export const DIFFICULTIES = ["easy", "medium", "hard", "expert"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

/** Difficulties offered by the YouDoSudoku API. Expert is generated internally. */
export const EXTERNAL_DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type ExternalDifficulty = (typeof EXTERNAL_DIFFICULTIES)[number];

export const GAME_MODES = ["classic", "daily", "room"] as const;
export type GameMode = (typeof GAME_MODES)[number];

export const PUZZLE_SOURCES = ["youdosudoku", "internal"] as const;
export type PuzzleSource = (typeof PUZZLE_SOURCES)[number];

/** 81 digits, row-major, 0 = empty. */
export type Grid = number[];

/**
 * Compact move-log entry used for server-side replay: [cell, value, kind].
 * value 0 means the cell was cleared.
 */
export type Move = [cell: number, value: number, kind: MoveKind];

export const MoveKind = {
  /** A value typed by the player. Only these can count as mistakes. */
  Place: 0,
  /** A change caused by undo/redo/erase/restart. */
  History: 1,
  /** A value revealed by a hint. */
  Hint: 2,
} as const;
export type MoveKind = (typeof MoveKind)[keyof typeof MoveKind];

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === "string" && (DIFFICULTIES as readonly string[]).includes(value);
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
};
