import { CELLS, boxOf, colOf, rowOf } from "./board";
import type { Grid } from "./types";

const ROW = Array.from({ length: CELLS }, (_, i) => rowOf(i));
const COL = Array.from({ length: CELLS }, (_, i) => colOf(i));
const BOX = Array.from({ length: CELLS }, (_, i) => boxOf(i));
const FULL = 0b1111111110;

export interface SearchOptions {
  /** Stop after this many solutions. */
  limit?: number;
  /** Randomizes digit order (used by the generator). Returns a float in [0, 1). */
  random?: () => number;
}

export interface SearchResult {
  count: number;
  /** The first solution found, if any. */
  solution: Grid | null;
}

/**
 * Backtracking search using row/column/box bitmasks and the
 * minimum-remaining-values heuristic. Returns 0 solutions for grids
 * whose givens already conflict.
 */
export function search(input: ArrayLike<number>, options: SearchOptions = {}): SearchResult {
  const limit = options.limit ?? 1;
  const random = options.random;
  const grid = new Uint8Array(CELLS);
  const rows = new Uint16Array(9);
  const cols = new Uint16Array(9);
  const boxes = new Uint16Array(9);

  for (let i = 0; i < CELLS; i++) {
    const v = input[i] ?? 0;
    if (v === 0) continue;
    const b = 1 << v;
    if ((rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]) & b) return { count: 0, solution: null };
    grid[i] = v;
    rows[ROW[i]] |= b;
    cols[COL[i]] |= b;
    boxes[BOX[i]] |= b;
  }

  let count = 0;
  let solution: Grid | null = null;
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  const recurse = (): boolean => {
    // Pick the empty cell with the fewest candidates.
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < CELLS; i++) {
      if (grid[i] !== 0) continue;
      const mask = FULL & ~(rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]);
      let n = 0;
      for (let m = mask; m; m &= m - 1) n++;
      if (n < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = n;
        if (n <= 1) break;
      }
    }
    if (best === -1) {
      count++;
      if (!solution) solution = Array.from(grid);
      return count >= limit;
    }
    if (bestCount === 0) return false;

    let order = digits;
    if (random) {
      order = digits.slice();
      for (let k = order.length - 1; k > 0; k--) {
        const j = Math.floor(random() * (k + 1));
        [order[k], order[j]] = [order[j], order[k]];
      }
    }
    const r = ROW[best];
    const c = COL[best];
    const bx = BOX[best];
    for (const d of order) {
      const b = 1 << d;
      if (!(bestMask & b)) continue;
      grid[best] = d;
      rows[r] |= b;
      cols[c] |= b;
      boxes[bx] |= b;
      if (recurse()) return true;
      grid[best] = 0;
      rows[r] &= ~b;
      cols[c] &= ~b;
      boxes[bx] &= ~b;
    }
    return false;
  };

  recurse();
  return { count, solution };
}

/** Solves a puzzle, returning null when it has no solution. */
export function solve(grid: ArrayLike<number>): Grid | null {
  return search(grid, { limit: 1 }).solution;
}

/** Counts solutions up to `limit` (2 is enough to prove uniqueness). */
export function countSolutions(grid: ArrayLike<number>, limit = 2): number {
  return search(grid, { limit }).count;
}

export function hasUniqueSolution(grid: ArrayLike<number>): boolean {
  return countSolutions(grid, 2) === 1;
}
