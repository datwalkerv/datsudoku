import { describe, expect, it } from "vitest";
import {
  CellFlag,
  applyHint,
  cellFlags,
  createGame,
  erase,
  fillCandidates,
  findHint,
  input,
  moveSelection,
  pause,
  redo,
  restart,
  select,
  setValue,
  tick,
  toggleNote,
  toggleNotesMode,
  undo,
  type GameState,
} from "@/lib/sudoku/engine";
import { bit, parseGrid, serializeGrid } from "@/lib/sudoku/board";
import { replayMoves } from "@/lib/games/replay";
import { API_PUZZLE, API_SOLUTION } from "../fixtures";

const solution = parseGrid(API_SOLUTION);
const firstEmpty = API_PUZZLE.indexOf("0"); // cell 0
const wrongFor = (i: number) => (solution[i] % 9) + 1;

function fresh(): GameState {
  return select(createGame(API_PUZZLE, API_SOLUTION), firstEmpty);
}

function solveAll(state: GameState): GameState {
  let s = state;
  for (let i = 0; i < 81; i++) {
    if (s.values[i] === 0) s = setValue(select(s, i), solution[i]);
  }
  return s;
}

describe("value entry", () => {
  it("places values, ignores givens and toggles same value off", () => {
    let s = setValue(fresh(), 2);
    expect(s.values[firstEmpty]).toBe(2);
    s = setValue(s, 2);
    expect(s.values[firstEmpty]).toBe(0);
    const given = API_PUZZLE.indexOf("7");
    const before = select(s, given);
    expect(setValue(before, 3)).toBe(before);
  });

  it("counts mistakes against the solution", () => {
    const s = setValue(fresh(), wrongFor(firstEmpty));
    expect(s.mistakes).toBe(1);
    expect(cellFlags(s, true)[firstEmpty] & CellFlag.Incorrect).toBeTruthy();
    expect(cellFlags(s, false)[firstEmpty] & CellFlag.Incorrect).toBeFalsy();
  });

  it("flags conflicts with peers", () => {
    // 7 is a given at index 1 in row 0.
    const s = setValue(fresh(), 7);
    expect(cellFlags(s, false)[firstEmpty] & CellFlag.Conflict).toBeTruthy();
  });
});

describe("notes", () => {
  it("toggles multiple candidates", () => {
    let s = toggleNotesMode(fresh());
    s = input(s, 2);
    s = input(s, 8);
    expect(s.notes[firstEmpty]).toBe(bit(2) | bit(8));
    s = input(s, 2);
    expect(s.notes[firstEmpty]).toBe(bit(8));
  });

  it("does not add notes to filled cells", () => {
    const s = setValue(fresh(), 2);
    expect(toggleNote(s, 3)).toBe(s);
  });

  it("cleans up peer notes when a value is placed, only with autoCleanup", () => {
    const peer = 2; // same row as cell 0, empty in API_PUZZLE
    expect(API_PUZZLE[peer]).toBe("0");
    let s = toggleNote(select(fresh(), peer), 2);
    s = toggleNote(s, 9);
    const withCleanup = setValue(select(s, firstEmpty), 2, { autoCleanup: true });
    expect(withCleanup.notes[peer]).toBe(bit(9));
    const without = setValue(select(s, firstEmpty), 2, { autoCleanup: false });
    expect(without.notes[peer]).toBe(bit(2) | bit(9));
    // Cleanup never touches committed values.
    expect(withCleanup.values.filter((v, i) => v !== s.values[i])).toEqual([2]);
  });

  it("fills candidates as one undoable step", () => {
    const s = fillCandidates(fresh());
    expect(s.notes[firstEmpty]).toBeGreaterThan(0);
    expect(s.notes.every((n, i) => (s.values[i] !== 0 ? n === 0 : n > 0))).toBe(true);
    const u = undo(s);
    expect(u.notes.every((n) => n === 0)).toBe(true);
  });

  it("erases values first, then notes", () => {
    let s = toggleNote(fresh(), 4);
    s = setValue(s, 2);
    expect(s.notes[firstEmpty]).toBe(0);
    s = erase(s);
    expect(s.values[firstEmpty]).toBe(0);
  });
});

describe("history", () => {
  it("undoes and redoes value placement including peer cleanup", () => {
    const peer = 2;
    let s = toggleNote(select(fresh(), peer), 2);
    s = setValue(select(s, firstEmpty), 2);
    expect(s.notes[peer]).toBe(0);
    s = undo(s);
    expect(s.values[firstEmpty]).toBe(0);
    expect(s.notes[peer]).toBe(bit(2));
    s = redo(s);
    expect(s.values[firstEmpty]).toBe(2);
    expect(s.notes[peer]).toBe(0);
  });

  it("clears the redo stack on a new action", () => {
    let s = setValue(fresh(), 2);
    s = undo(s);
    expect(s.future).toHaveLength(1);
    s = setValue(s, 5);
    expect(s.future).toHaveLength(0);
  });

  it("is a no-op when there is nothing to undo or redo", () => {
    const s = fresh();
    expect(undo(s)).toBe(s);
    expect(redo(s)).toBe(s);
  });

  it("does not undo mistakes or hints counters", () => {
    let s = setValue(fresh(), wrongFor(firstEmpty));
    s = undo(s);
    expect(s.mistakes).toBe(1);
  });
});

describe("completion", () => {
  it("completes when every cell is correct", () => {
    const s = solveAll(fresh());
    expect(s.status).toBe("completed");
    expect(serializeGrid(s.values)).toBe(API_SOLUTION);
    // Further input is ignored after completion.
    expect(setValue(select(s, firstEmpty), 1)).toEqual(select(s, firstEmpty));
  });

  it("does not complete a full board with conflicts", () => {
    let s = solveAll(fresh());
    // Start again and fill with a wrong value in the last cell.
    s = restart({ ...s, status: "playing" });
    const empties = [...API_PUZZLE].map((c, i) => (c === "0" ? i : -1)).filter((i) => i >= 0);
    for (const i of empties.slice(0, -1)) s = setValue(select(s, i), solution[i]);
    const last = empties[empties.length - 1];
    s = setValue(select(s, last), wrongFor(last));
    expect(s.status).toBe("playing");
  });

  it("restart keeps counters but clears the board", () => {
    let s = setValue(fresh(), wrongFor(firstEmpty));
    s = restart(s);
    expect(serializeGrid(s.values)).toBe(API_PUZZLE);
    expect(s.mistakes).toBe(1);
    expect(s.past).toHaveLength(0);
  });
});

describe("hints, timer and navigation", () => {
  it("prefers fixing an incorrect entry", () => {
    const s = setValue(fresh(), wrongFor(firstEmpty));
    expect(findHint(s)).toEqual({ i: firstEmpty, value: solution[firstEmpty], reason: "incorrect" });
  });

  it("reveals the selected cell and counts the hint", () => {
    const s = fresh();
    const hint = findHint(s)!;
    expect(hint.reason).toBe("selected");
    const after = applyHint(s, hint);
    expect(after.values[firstEmpty]).toBe(solution[firstEmpty]);
    expect(after.hintsUsed).toBe(1);
  });

  it("returns null without a solution", () => {
    expect(findHint(createGame(API_PUZZLE))).toBeNull();
  });

  it("only advances the timer while playing", () => {
    let s = tick(fresh(), 1000);
    expect(s.elapsedMs).toBe(1000);
    s = tick(pause(s), 1000);
    expect(s.elapsedMs).toBe(1000);
  });

  it("wraps keyboard navigation", () => {
    expect(moveSelection(0, "left")).toBe(8);
    expect(moveSelection(0, "up")).toBe(72);
    expect(moveSelection(80, "right")).toBe(72);
    expect(moveSelection(null, "down")).toBe(40);
  });
});

describe("server replay", () => {
  it("recomputes mistakes and hints from the move log", () => {
    let s = setValue(fresh(), wrongFor(firstEmpty));
    s = undo(s);
    s = redo(s); // history replays are not new mistakes
    s = erase(s);
    s = applyHint(s, findHint(s)!);
    s = solveAll(s);
    expect(s.status).toBe("completed");
    const r = replayMoves(parseGrid(API_PUZZLE), solution, s.moves, s.values);
    expect(r).toEqual({ consistent: true, solved: true, mistakes: 1, hints: 1 });
  });

  it("detects a forged board", () => {
    const s = solveAll(fresh());
    const forged = replayMoves(parseGrid(API_PUZZLE), solution, s.moves.slice(0, -1), s.values);
    expect(forged.consistent).toBe(false);
    const givenEdit = replayMoves(parseGrid(API_PUZZLE), solution, [[1, 3, 0], ...s.moves], s.values);
    expect(givenEdit.consistent).toBe(false);
  });
});
