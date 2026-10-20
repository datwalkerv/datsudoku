import { CELLS, PEERS, bit, boxOf, candidatesMask, colOf, parseGrid, rowOf } from "./board";
import { findConflicts, isSolved } from "./validation";
import { MoveKind, type Grid, type Move } from "./types";

/** One cell change inside a patch, enough to apply it in either direction. */
export interface CellChange {
  i: number;
  prevValue: number;
  prevNotes: number;
  nextValue: number;
  nextNotes: number;
}
export type Patch = CellChange[];

export type GameStatus = "playing" | "paused" | "completed";

export interface GameState {
  /** Original clues, 81 digits. */
  givens: Grid;
  /** Current board including givens. */
  values: Grid;
  /** Candidate bitmasks per cell (bit d set = note d). */
  notes: number[];
  /** Known solution, if available. Used only for mistake checks and hints. */
  solution: Grid | null;
  selected: number | null;
  notesMode: boolean;
  mistakes: number;
  hintsUsed: number;
  past: Patch[];
  future: Patch[];
  moves: Move[];
  elapsedMs: number;
  status: GameStatus;
}

export interface EngineOptions {
  /** Remove a placed digit from its peers' notes. */
  autoCleanup: boolean;
}

export const DEFAULT_ENGINE_OPTIONS: EngineOptions = { autoCleanup: true };

/** Upper bound on the move log to keep saves small. */
export const MAX_MOVES = 4000;

export function createGame(givens: string | Grid, solution?: string | Grid | null): GameState {
  const g = typeof givens === "string" ? parseGrid(givens) : givens.slice();
  const s = solution == null ? null : typeof solution === "string" ? parseGrid(solution) : solution.slice();
  return {
    givens: g,
    values: g.slice(),
    notes: new Array<number>(CELLS).fill(0),
    solution: s,
    selected: null,
    notesMode: false,
    mistakes: 0,
    hintsUsed: 0,
    past: [],
    future: [],
    moves: [],
    elapsedMs: 0,
    status: "playing",
  };
}

export const isGiven = (state: GameState, i: number) => state.givens[i] !== 0;

function applyChanges(values: Grid, notes: number[], patch: Patch, forward: boolean) {
  for (const ch of patch) {
    values[ch.i] = forward ? ch.nextValue : ch.prevValue;
    notes[ch.i] = forward ? ch.nextNotes : ch.prevNotes;
  }
}

function appendMoves(moves: Move[], patch: Patch, forward: boolean, kind: MoveKind): Move[] {
  const added: Move[] = [];
  for (const ch of patch) {
    const before = forward ? ch.prevValue : ch.nextValue;
    const after = forward ? ch.nextValue : ch.prevValue;
    if (before !== after) added.push([ch.i, after, kind]);
  }
  if (added.length === 0) return moves;
  const next = moves.concat(added);
  return next.length > MAX_MOVES ? next.slice(next.length - MAX_MOVES) : next;
}

function finalize(state: GameState): GameState {
  if (state.status !== "completed" && isSolved(state.values)) {
    return { ...state, status: "completed", notesMode: false };
  }
  return state;
}

/** Commits a patch to the board and history. */
function commit(state: GameState, patch: Patch, kind: MoveKind, extra: Partial<GameState> = {}): GameState {
  if (patch.length === 0) return state;
  const values = state.values.slice();
  const notes = state.notes.slice();
  applyChanges(values, notes, patch, true);
  return finalize({
    ...state,
    ...extra,
    values,
    notes,
    past: [...state.past, patch],
    future: [],
    moves: appendMoves(state.moves, patch, true, kind),
  });
}

function canEdit(state: GameState, i: number | null): i is number {
  return i !== null && state.status === "playing" && !isGiven(state, i);
}

/** Places (or toggles off) a value in the selected cell. */
export function setValue(
  state: GameState,
  value: number,
  options: EngineOptions = DEFAULT_ENGINE_OPTIONS,
  cell: number | null = state.selected,
): GameState {
  if (!canEdit(state, cell) || value < 1 || value > 9) return state;
  const i = cell;
  const current = state.values[i];
  const next = current === value ? 0 : value;
  const patch: Patch = [
    { i, prevValue: current, prevNotes: state.notes[i], nextValue: next, nextNotes: next ? 0 : state.notes[i] },
  ];
  if (next && options.autoCleanup) {
    const b = bit(next);
    for (const p of PEERS[i]) {
      if (state.values[p] === 0 && state.notes[p] & b) {
        patch.push({
          i: p,
          prevValue: 0,
          prevNotes: state.notes[p],
          nextValue: 0,
          nextNotes: state.notes[p] & ~b,
        });
      }
    }
  }
  const wrong = next !== 0 && state.solution !== null && state.solution[i] !== next;
  return commit(state, patch, MoveKind.Place, wrong ? { mistakes: state.mistakes + 1 } : {});
}

/** Toggles a pencil note. Ignored on filled cells. */
export function toggleNote(state: GameState, value: number, cell: number | null = state.selected): GameState {
  if (!canEdit(state, cell) || value < 1 || value > 9) return state;
  const i = cell;
  if (state.values[i] !== 0) return state;
  const prev = state.notes[i];
  return commit(state, [{ i, prevValue: 0, prevNotes: prev, nextValue: 0, nextNotes: prev ^ bit(value) }], MoveKind.History);
}

/** Enters a digit as a value or a note depending on notes mode. */
export function input(state: GameState, value: number, options: EngineOptions = DEFAULT_ENGINE_OPTIONS): GameState {
  return state.notesMode ? toggleNote(state, value) : setValue(state, value, options);
}

/** Clears the value, or the notes when the cell has no value. */
export function erase(state: GameState, cell: number | null = state.selected): GameState {
  if (!canEdit(state, cell)) return state;
  const i = cell;
  const v = state.values[i];
  const n = state.notes[i];
  if (v === 0 && n === 0) return state;
  const patch: Patch = [{ i, prevValue: v, prevNotes: n, nextValue: 0, nextNotes: v !== 0 ? n : 0 }];
  return commit(state, patch, MoveKind.History);
}

export function undo(state: GameState): GameState {
  if (state.status !== "playing" || state.past.length === 0) return state;
  const patch = state.past[state.past.length - 1];
  const values = state.values.slice();
  const notes = state.notes.slice();
  applyChanges(values, notes, patch, false);
  return {
    ...state,
    values,
    notes,
    selected: patch[0].i,
    past: state.past.slice(0, -1),
    future: [...state.future, patch],
    moves: appendMoves(state.moves, patch, false, MoveKind.History),
  };
}

export function redo(state: GameState): GameState {
  if (state.status !== "playing" || state.future.length === 0) return state;
  const patch = state.future[state.future.length - 1];
  const values = state.values.slice();
  const notes = state.notes.slice();
  applyChanges(values, notes, patch, true);
  return finalize({
    ...state,
    values,
    notes,
    selected: patch[0].i,
    past: [...state.past, patch],
    future: state.future.slice(0, -1),
    moves: appendMoves(state.moves, patch, true, MoveKind.History),
  });
}

/** Fills every empty cell's notes with its legal candidates (one undo step). */
export function fillCandidates(state: GameState): GameState {
  if (state.status !== "playing") return state;
  const patch: Patch = [];
  for (let i = 0; i < CELLS; i++) {
    if (state.values[i] !== 0) continue;
    const mask = candidatesMask(state.values, i);
    if (mask !== state.notes[i]) {
      patch.push({ i, prevValue: 0, prevNotes: state.notes[i], nextValue: 0, nextNotes: mask });
    }
  }
  return commit(state, patch, MoveKind.History);
}

/** Resets the board to the givens. Mistakes and hints stay counted. */
export function restart(state: GameState): GameState {
  const patch: Patch = [];
  for (let i = 0; i < CELLS; i++) {
    if (state.givens[i] !== 0) continue;
    if (state.values[i] !== 0 || state.notes[i] !== 0) {
      patch.push({ i, prevValue: state.values[i], prevNotes: state.notes[i], nextValue: 0, nextNotes: 0 });
    }
  }
  const values = state.givens.slice();
  return {
    ...state,
    values,
    notes: new Array<number>(CELLS).fill(0),
    selected: null,
    past: [],
    future: [],
    moves: appendMoves(state.moves, patch, true, MoveKind.History),
    status: "playing",
    notesMode: false,
  };
}

export interface Hint {
  i: number;
  value: number;
  /** Why this cell was chosen. */
  reason: "incorrect" | "selected" | "fewest-candidates";
}

/**
 * Picks a helpful cell to reveal: an incorrect entry first, then the
 * selected cell, then the empty cell with the fewest candidates.
 */
export function findHint(state: GameState, solution: Grid | null = state.solution): Hint | null {
  if (!solution || state.status === "completed") return null;
  for (let i = 0; i < CELLS; i++) {
    const v = state.values[i];
    if (v !== 0 && v !== solution[i]) return { i, value: solution[i], reason: "incorrect" };
  }
  const sel = state.selected;
  if (sel !== null && state.values[sel] === 0) return { i: sel, value: solution[sel], reason: "selected" };
  let best = -1;
  let bestCount = 10;
  for (let i = 0; i < CELLS; i++) {
    if (state.values[i] !== 0) continue;
    let n = 0;
    for (let m = candidatesMask(state.values, i); m; m &= m - 1) n++;
    if (n < bestCount) {
      best = i;
      bestCount = n;
    }
  }
  return best === -1 ? null : { i: best, value: solution[best], reason: "fewest-candidates" };
}

/** Reveals a value supplied by `findHint` or by the server. */
export function applyHint(state: GameState, hint: { i: number; value: number }, options = DEFAULT_ENGINE_OPTIONS): GameState {
  if (state.status !== "playing" || isGiven(state, hint.i)) return state;
  const { i, value } = hint;
  const patch: Patch = [{ i, prevValue: state.values[i], prevNotes: state.notes[i], nextValue: value, nextNotes: 0 }];
  if (options.autoCleanup) {
    const b = bit(value);
    for (const p of PEERS[i]) {
      if (state.values[p] === 0 && state.notes[p] & b) {
        patch.push({ i: p, prevValue: 0, prevNotes: state.notes[p], nextValue: 0, nextNotes: state.notes[p] & ~b });
      }
    }
  }
  return commit(state, patch, MoveKind.Hint, { hintsUsed: state.hintsUsed + 1, selected: i });
}

export function select(state: GameState, i: number | null): GameState {
  if (i === state.selected) return state;
  return { ...state, selected: i };
}

export type Direction = "up" | "down" | "left" | "right";

/** Moves the selection, wrapping at edges. */
export function moveSelection(selected: number | null, direction: Direction): number {
  if (selected === null) return 40;
  let r = rowOf(selected);
  let c = colOf(selected);
  if (direction === "up") r = (r + 8) % 9;
  if (direction === "down") r = (r + 1) % 9;
  if (direction === "left") c = (c + 8) % 9;
  if (direction === "right") c = (c + 1) % 9;
  return r * 9 + c;
}

export function toggleNotesMode(state: GameState): GameState {
  return { ...state, notesMode: !state.notesMode };
}

export function pause(state: GameState): GameState {
  return state.status === "playing" ? { ...state, status: "paused" } : state;
}

export function resume(state: GameState): GameState {
  return state.status === "paused" ? { ...state, status: "playing" } : state;
}

export function tick(state: GameState, ms: number): GameState {
  return state.status === "playing" ? { ...state, elapsedMs: state.elapsedMs + ms } : state;
}

/* ---------- Selectors ---------- */

export const CellFlag = {
  Selected: 1,
  Related: 2,
  SameValue: 4,
  Conflict: 8,
  Incorrect: 16,
  Given: 32,
} as const;

/** Computes highlight flags for each cell. */
export function cellFlags(state: GameState, showIncorrect: boolean): number[] {
  const flags = new Array<number>(CELLS).fill(0);
  const conflicts = findConflicts(state.values);
  const sel = state.selected;
  const selValue = sel !== null ? state.values[sel] : 0;
  for (let i = 0; i < CELLS; i++) {
    let f = 0;
    if (state.givens[i] !== 0) f |= CellFlag.Given;
    if (sel !== null) {
      if (i === sel) f |= CellFlag.Selected;
      else if (rowOf(i) === rowOf(sel) || colOf(i) === colOf(sel) || boxOf(i) === boxOf(sel)) f |= CellFlag.Related;
      if (selValue !== 0 && state.values[i] === selValue) f |= CellFlag.SameValue;
    }
    if (conflicts.has(i) && state.givens[i] === 0) f |= CellFlag.Conflict;
    if (
      showIncorrect &&
      state.solution &&
      state.givens[i] === 0 &&
      state.values[i] !== 0 &&
      state.values[i] !== state.solution[i]
    ) {
      f |= CellFlag.Incorrect;
    }
    flags[i] = f;
  }
  return flags;
}

/** How many of each digit are placed (for dimming completed digits on the pad). */
export function digitCounts(values: Grid): number[] {
  const counts = new Array<number>(10).fill(0);
  for (const v of values) counts[v]++;
  return counts;
}
