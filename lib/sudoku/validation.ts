import { CELLS, PEERS, ALL_UNITS } from "./board";
import type { Grid } from "./types";

/** Indices of cells whose value duplicates a peer's value. */
export function findConflicts(grid: ArrayLike<number>): Set<number> {
  const conflicts = new Set<number>();
  for (const unit of ALL_UNITS) {
    const seen = new Map<number, number>();
    for (const i of unit) {
      const v = grid[i];
      if (v === 0) continue;
      const prev = seen.get(v);
      if (prev !== undefined) {
        conflicts.add(prev);
        conflicts.add(i);
      } else {
        seen.set(v, i);
      }
    }
  }
  return conflicts;
}

export function hasConflict(grid: ArrayLike<number>, i: number): boolean {
  const v = grid[i];
  if (v === 0) return false;
  for (const p of PEERS[i]) if (grid[p] === v) return true;
  return false;
}

/** True when the grid has no duplicate values in any row, column or box. */
export function isConsistent(grid: ArrayLike<number>): boolean {
  for (let i = 0; i < CELLS; i++) {
    const v = grid[i];
    if (v < 0 || v > 9 || !Number.isInteger(v)) return false;
  }
  return findConflicts(grid).size === 0;
}

export function isFilled(grid: ArrayLike<number>): boolean {
  for (let i = 0; i < CELLS; i++) if (grid[i] === 0) return false;
  return true;
}

/** A filled grid with no conflicts is a valid Sudoku solution. */
export function isSolved(grid: ArrayLike<number>): boolean {
  return isFilled(grid) && findConflicts(grid).size === 0;
}

/** True when `board` keeps every given of `givens` unchanged. */
export function respectsGivens(givens: ArrayLike<number>, board: ArrayLike<number>): boolean {
  for (let i = 0; i < CELLS; i++) {
    if (givens[i] !== 0 && board[i] !== givens[i]) return false;
  }
  return true;
}

/** True when `solution` is a complete valid grid that extends `puzzle`. */
export function solutionMatchesPuzzle(puzzle: Grid, solution: Grid): boolean {
  return isSolved(solution) && respectsGivens(puzzle, solution);
}
