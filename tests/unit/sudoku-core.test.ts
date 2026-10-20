import { describe, expect, it } from "vitest";
import { PEERS, UNITS, candidatesMask, maskToDigits, parseGrid, serializeGrid } from "@/lib/sudoku/board";
import { findConflicts, isConsistent, isSolved, respectsGivens, solutionMatchesPuzzle } from "@/lib/sudoku/validation";
import { countSolutions, hasUniqueSolution, solve } from "@/lib/sudoku/solver";
import { generatePuzzle } from "@/lib/sudoku/generator";
import { rate } from "@/lib/sudoku/rater";
import { createRng, randomSeed, isSeed } from "@/lib/sudoku/seeds";
import { API_PUZZLE, API_SOLUTION, AMBIGUOUS_PUZZLE, CONFLICTING_PUZZLE, SOLVED_GRID } from "../fixtures";

describe("board", () => {
  it("parses and serializes 81-digit grids", () => {
    const g = parseGrid(API_PUZZLE);
    expect(g).toHaveLength(81);
    expect(serializeGrid(g)).toBe(API_PUZZLE);
    expect(parseGrid("." + API_PUZZLE.slice(1))[0]).toBe(0);
  });

  it("rejects malformed grids", () => {
    expect(() => parseGrid("123")).toThrow();
    expect(() => parseGrid("x".repeat(81))).toThrow();
  });

  it("has 20 peers per cell and 9 cells per unit", () => {
    for (const peers of PEERS) expect(peers).toHaveLength(20);
    for (const unit of [...UNITS.rows, ...UNITS.cols, ...UNITS.boxes]) expect(new Set(unit).size).toBe(9);
    expect(PEERS[0]).toContain(80 - 80 + 10); // r1c1 is in box 0
    expect(PEERS[0]).not.toContain(0);
  });

  it("computes candidates from peers", () => {
    const g = parseGrid(API_PUZZLE);
    const solution = parseGrid(API_SOLUTION);
    for (let i = 0; i < 81; i++) {
      if (g[i] === 0) expect(maskToDigits(candidatesMask(g, i))).toContain(solution[i]);
    }
  });
});

describe("constraints", () => {
  it("detects row, column and box conflicts", () => {
    const g = parseGrid("0".repeat(81));
    g[0] = 5;
    g[8] = 5; // same row
    expect([...findConflicts(g)].sort((a, b) => a - b)).toEqual([0, 8]);
    g[8] = 0;
    g[72] = 5; // same column
    expect(findConflicts(g).has(72)).toBe(true);
    g[72] = 0;
    g[20] = 5; // same box
    expect(findConflicts(g).has(20)).toBe(true);
    g[20] = 0;
    g[40] = 5; // unrelated
    expect(findConflicts(g).size).toBe(0);
  });

  it("validates solved grids", () => {
    expect(isSolved(parseGrid(SOLVED_GRID))).toBe(true);
    expect(isSolved(parseGrid(API_PUZZLE))).toBe(false);
    expect(isConsistent(parseGrid(CONFLICTING_PUZZLE))).toBe(false);
    expect(solutionMatchesPuzzle(parseGrid(API_PUZZLE), parseGrid(API_SOLUTION))).toBe(true);
    expect(respectsGivens(parseGrid(API_PUZZLE), parseGrid(SOLVED_GRID))).toBe(false);
  });
});

describe("solver", () => {
  it("solves a real API puzzle to its published solution", () => {
    expect(serializeGrid(solve(parseGrid(API_PUZZLE))!)).toBe(API_SOLUTION);
  });

  it("verifies uniqueness", () => {
    expect(hasUniqueSolution(parseGrid(API_PUZZLE))).toBe(true);
    expect(countSolutions(parseGrid(AMBIGUOUS_PUZZLE), 2)).toBe(2);
    expect(countSolutions(parseGrid(CONFLICTING_PUZZLE), 2)).toBe(0);
    expect(solve(parseGrid(CONFLICTING_PUZZLE))).toBeNull();
  });
});

describe("generator and seeds", () => {
  it("is deterministic for a seed", () => {
    const a = generatePuzzle("seed-abc", "medium");
    const b = generatePuzzle("seed-abc", "medium");
    expect(serializeGrid(a.puzzle)).toBe(serializeGrid(b.puzzle));
    expect(serializeGrid(generatePuzzle("seed-xyz", "medium").puzzle)).not.toBe(serializeGrid(a.puzzle));
  });

  it.each(["easy", "medium", "hard", "expert"] as const)("generates unique %s puzzles", (difficulty) => {
    const { puzzle, solution, clues, level } = generatePuzzle(`test-${difficulty}`, difficulty);
    expect(hasUniqueSolution(puzzle)).toBe(true);
    expect(solutionMatchesPuzzle(puzzle, solution)).toBe(true);
    expect(rate(puzzle).clues).toBe(clues);
    if (difficulty === "easy") expect(level).toBe(1);
    if (difficulty === "expert") expect(clues).toBeLessThanOrEqual(26);
  });

  it("produces reproducible PRNG streams", () => {
    const r1 = createRng("x");
    const r2 = createRng("x");
    for (let k = 0; k < 10; k++) expect(r1()).toBe(r2());
  });

  it("creates url-safe random seeds", () => {
    const seed = randomSeed();
    expect(isSeed(seed)).toBe(true);
    expect(seed).not.toBe(randomSeed());
  });
});
