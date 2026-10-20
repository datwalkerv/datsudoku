import { CELLS, emptyGrid } from "./board";
import { rate, type LogicLevel } from "./rater";
import { createRng, shuffle } from "./seeds";
import { countSolutions, search } from "./solver";
import type { Difficulty, Grid } from "./types";

interface Target {
  /** Stop removing clues once this many remain. */
  minClues: number;
  /** Also remove single cells after the symmetric pass (sparser, harder grids). */
  asymmetric?: boolean;
  /** Accept only puzzles with at most this many clues. */
  maxClues: number;
  levels: LogicLevel[];
}

const TARGETS: Record<Difficulty, Target> = {
  easy: { minClues: 38, maxClues: 44, levels: [1] },
  medium: { minClues: 31, maxClues: 35, levels: [1, 2] },
  hard: { minClues: 26, maxClues: 30, levels: [2] },
  expert: { minClues: 17, maxClues: 25, levels: [3], asymmetric: true },
};

const MAX_ATTEMPTS = 60;

export interface GeneratedPuzzle {
  puzzle: Grid;
  solution: Grid;
  clues: number;
  level: LogicLevel;
  attempts: number;
}

/** A random complete grid. */
export function generateSolution(random: () => number): Grid {
  const result = search(emptyGrid(), { limit: 1, random });
  if (!result.solution) throw new Error("Failed to generate a solution grid");
  return result.solution;
}

/**
 * Removes clues in symmetric pairs while the puzzle stays uniquely solvable.
 */
function carve(solution: Grid, random: () => number, minClues: number, asymmetric = false): Grid {
  const puzzle = solution.slice();
  let clues = CELLS;
  const order = shuffle(
    Array.from({ length: 41 }, (_, i) => i),
    random,
  );
  for (const i of order) {
    if (clues <= minClues) break;
    const j = CELLS - 1 - i;
    const removed = i === j ? 1 : 2;
    if (clues - removed < minClues) continue;
    const a = puzzle[i];
    const b = puzzle[j];
    puzzle[i] = 0;
    puzzle[j] = 0;
    if (countSolutions(puzzle, 2) !== 1) {
      puzzle[i] = a;
      puzzle[j] = b;
    } else {
      clues -= removed;
    }
  }
  if (asymmetric) {
    for (const i of shuffle(Array.from({ length: CELLS }, (_, k) => k), random)) {
      if (clues <= minClues) break;
      if (puzzle[i] === 0) continue;
      const a = puzzle[i];
      puzzle[i] = 0;
      if (countSolutions(puzzle, 2) !== 1) puzzle[i] = a;
      else clues--;
    }
  }
  return puzzle;
}

/**
 * Deterministically generates a puzzle with a unique solution for a seed.
 * The same (seed, difficulty) pair always yields the same puzzle.
 */
export function generatePuzzle(seed: string, difficulty: Difficulty): GeneratedPuzzle {
  const target = TARGETS[difficulty];
  const random = createRng(`${difficulty}:${seed}`);
  let best: GeneratedPuzzle | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const solution = generateSolution(random);
    const puzzle = carve(solution, random, target.minClues, target.asymmetric);
    const { level, clues } = rate(puzzle);
    const candidate: GeneratedPuzzle = { puzzle, solution, clues, level, attempts: attempt };
    if (target.levels.includes(level) && clues <= target.maxClues) return candidate;
    // Keep the closest miss: prefer the hardest level, then the fewest clues.
    if (!best || level > best.level || (level === best.level && clues < best.clues)) {
      best = candidate;
    }
  }
  return { ...best!, attempts: MAX_ATTEMPTS };
}
