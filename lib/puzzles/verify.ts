import { parseGrid, serializeGrid, countFilled } from "@/lib/sudoku/board";
import { search } from "@/lib/sudoku/solver";
import { isConsistent, solutionMatchesPuzzle } from "@/lib/sudoku/validation";

export type Verification =
  | { ok: true; solution: string; solutionSource: "api" | "solver"; clues: number }
  | { ok: false; reason: string };

/**
 * Accepts a puzzle only if its givens are consistent and it has exactly one
 * solution. A supplied solution is used only when it matches that solution.
 */
export function verifyPuzzle(puzzle: string, suppliedSolution: string | null): Verification {
  const grid = parseGrid(puzzle);
  const clues = countFilled(grid);
  if (clues < 17) return { ok: false, reason: `too few clues (${clues})` };
  if (!isConsistent(grid)) return { ok: false, reason: "givens conflict" };
  const { count, solution } = search(grid, { limit: 2 });
  if (count === 0 || !solution) return { ok: false, reason: "no solution" };
  if (count > 1) return { ok: false, reason: "multiple solutions" };
  const solved = serializeGrid(solution);
  if (suppliedSolution && suppliedSolution === solved && solutionMatchesPuzzle(grid, parseGrid(suppliedSolution))) {
    return { ok: true, solution: solved, solutionSource: "api", clues };
  }
  return { ok: true, solution: solved, solutionSource: "solver", clues };
}
