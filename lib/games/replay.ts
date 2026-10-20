import { CELLS } from "@/lib/sudoku/board";
import { MoveKind, type Grid, type Move } from "@/lib/sudoku/types";

export interface ReplayResult {
  /** The move log reproduces the submitted board exactly. */
  consistent: boolean;
  /** Final board equals the solution. */
  solved: boolean;
  /** Player-typed values that disagreed with the solution. */
  mistakes: number;
  /** Values revealed by hints. */
  hints: number;
}

/**
 * Replays a client move log against the stored puzzle so the server can
 * compute mistakes and hints itself instead of trusting client counters.
 */
export function replayMoves(givens: Grid, solution: Grid, moves: Move[], submittedBoard: Grid): ReplayResult {
  const board = givens.slice();
  let mistakes = 0;
  let hints = 0;
  let consistent = true;

  for (const move of moves) {
    const [i, v, kind] = move;
    if (!Number.isInteger(i) || i < 0 || i >= CELLS || !Number.isInteger(v) || v < 0 || v > 9 || givens[i] !== 0) {
      consistent = false;
      break;
    }
    board[i] = v;
    if (kind === MoveKind.Place && v !== 0 && v !== solution[i]) mistakes++;
    if (kind === MoveKind.Hint) hints++;
  }

  const solved = submittedBoard.length === CELLS && submittedBoard.every((v, i) => v === solution[i]);
  if (consistent) consistent = board.every((v, i) => v === submittedBoard[i]);
  return { consistent, solved, mistakes, hints };
}
