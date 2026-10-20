import type { Grid } from "./types";

export const SIZE = 9;
export const CELLS = 81;

export const rowOf = (i: number) => Math.floor(i / 9);
export const colOf = (i: number) => i % 9;
export const boxOf = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);
export const indexOf = (row: number, col: number) => row * 9 + col;

function build<T>(fn: (i: number) => T): T[] {
  return Array.from({ length: CELLS }, (_, i) => fn(i));
}

/** Cell indices of every row, column and box. */
export const UNITS: { rows: number[][]; cols: number[][]; boxes: number[][] } = {
  rows: Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => indexOf(r, c))),
  cols: Array.from({ length: 9 }, (_, c) => Array.from({ length: 9 }, (_, r) => indexOf(r, c))),
  boxes: Array.from({ length: 9 }, (_, b) =>
    Array.from({ length: 9 }, (_, k) =>
      indexOf(Math.floor(b / 3) * 3 + Math.floor(k / 3), (b % 3) * 3 + (k % 3)),
    ),
  ),
};
export const ALL_UNITS: number[][] = [...UNITS.rows, ...UNITS.cols, ...UNITS.boxes];

/** The 20 peers of each cell (same row, column or box, excluding itself). */
export const PEERS: number[][] = build((i) => {
  const set = new Set<number>([
    ...UNITS.rows[rowOf(i)],
    ...UNITS.cols[colOf(i)],
    ...UNITS.boxes[boxOf(i)],
  ]);
  set.delete(i);
  return [...set];
});

const GRID_PATTERN = /^[0-9]{81}$/;

export function isGridString(value: unknown): value is string {
  return typeof value === "string" && GRID_PATTERN.test(value);
}

/** Parses an 81-character grid string ("0" or "." for empty). */
export function parseGrid(input: string): Grid {
  const normalized = input.replace(/\./g, "0");
  if (!isGridString(normalized)) {
    throw new Error("Grid must contain exactly 81 digits");
  }
  return Array.from(normalized, (ch) => ch.charCodeAt(0) - 48);
}

export function serializeGrid(grid: ArrayLike<number>): string {
  let out = "";
  for (let i = 0; i < CELLS; i++) out += String(grid[i] ?? 0);
  return out;
}

export function emptyGrid(): Grid {
  return new Array<number>(CELLS).fill(0);
}

export function countFilled(grid: ArrayLike<number>): number {
  let n = 0;
  for (let i = 0; i < CELLS; i++) if (grid[i] !== 0) n++;
  return n;
}

/* Digit bitmasks: bit d (1..9) set means digit d is present. */
export const ALL_DIGITS_MASK = 0b1111111110;
export const bit = (d: number) => 1 << d;
export const hasBit = (mask: number, d: number) => (mask & (1 << d)) !== 0;

export function maskToDigits(mask: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (mask & (1 << d)) out.push(d);
  return out;
}

export function popcount(mask: number): number {
  let n = 0;
  while (mask) {
    mask &= mask - 1;
    n++;
  }
  return n;
}

/** Digits that can legally go in `i` given the values of its peers. */
export function candidatesMask(grid: ArrayLike<number>, i: number): number {
  if (grid[i] !== 0) return 0;
  let used = 0;
  for (const p of PEERS[i]) used |= 1 << grid[p];
  return ALL_DIGITS_MASK & ~used;
}
