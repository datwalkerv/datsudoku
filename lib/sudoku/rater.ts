import { ALL_UNITS, CELLS, PEERS, UNITS, boxOf, candidatesMask, colOf, popcount, rowOf } from "./board";

/**
 * Logical difficulty of a puzzle:
 * 1 = solvable with naked/hidden singles,
 * 2 = also needs locked candidates or naked pairs,
 * 3 = needs techniques beyond those (or is unsolvable by logic here).
 */
export type LogicLevel = 1 | 2 | 3;

export interface Rating {
  level: LogicLevel;
  clues: number;
}

export function rate(puzzle: ArrayLike<number>): Rating {
  const grid = Array.from(puzzle);
  const cands = new Array<number>(CELLS);
  let clues = 0;
  for (let i = 0; i < CELLS; i++) {
    if (grid[i] !== 0) clues++;
    cands[i] = candidatesMask(grid, i);
  }

  const place = (i: number, d: number) => {
    grid[i] = d;
    cands[i] = 0;
    const b = 1 << d;
    for (const p of PEERS[i]) cands[p] &= ~b;
  };

  const applySingles = (): boolean => {
    let progress = false;
    for (let i = 0; i < CELLS; i++) {
      if (grid[i] === 0 && popcount(cands[i]) === 1) {
        place(i, Math.log2(cands[i]));
        progress = true;
      }
    }
    for (const unit of ALL_UNITS) {
      for (let d = 1; d <= 9; d++) {
        const b = 1 << d;
        let only = -1;
        let n = 0;
        for (const i of unit) {
          if (grid[i] === d) {
            n = -1;
            break;
          }
          if (cands[i] & b) {
            n++;
            only = i;
          }
        }
        if (n === 1) {
          place(only, d);
          progress = true;
        }
      }
    }
    return progress;
  };

  const eliminate = (cells: number[], b: number, keep: (i: number) => boolean): boolean => {
    let changed = false;
    for (const i of cells) {
      if (!keep(i) && cands[i] & b) {
        cands[i] &= ~b;
        changed = true;
      }
    }
    return changed;
  };

  const applyIntermediate = (): boolean => {
    let changed = false;
    // Pointing: a digit confined to one row/column inside a box.
    for (let bx = 0; bx < 9; bx++) {
      const box = UNITS.boxes[bx];
      for (let d = 1; d <= 9; d++) {
        const b = 1 << d;
        const cells = box.filter((i) => cands[i] & b);
        if (cells.length < 2) continue;
        const r = rowOf(cells[0]);
        const c = colOf(cells[0]);
        if (cells.every((i) => rowOf(i) === r)) {
          changed = eliminate(UNITS.rows[r], b, (i) => boxOf(i) === bx) || changed;
        }
        if (cells.every((i) => colOf(i) === c)) {
          changed = eliminate(UNITS.cols[c], b, (i) => boxOf(i) === bx) || changed;
        }
      }
    }
    // Claiming: a digit confined to one box inside a row/column.
    for (const unit of [...UNITS.rows, ...UNITS.cols]) {
      for (let d = 1; d <= 9; d++) {
        const b = 1 << d;
        const cells = unit.filter((i) => cands[i] & b);
        if (cells.length < 2) continue;
        const bx = boxOf(cells[0]);
        if (cells.every((i) => boxOf(i) === bx)) {
          changed = eliminate(UNITS.boxes[bx], b, (i) => unit.includes(i)) || changed;
        }
      }
    }
    // Naked pairs.
    for (const unit of ALL_UNITS) {
      for (let a = 0; a < 9; a++) {
        const ia = unit[a];
        if (popcount(cands[ia]) !== 2) continue;
        for (let k = a + 1; k < 9; k++) {
          const ib = unit[k];
          if (cands[ib] !== cands[ia]) continue;
          const pair = cands[ia];
          for (const i of unit) {
            if (i !== ia && i !== ib && cands[i] & pair) {
              cands[i] &= ~pair;
              changed = true;
            }
          }
        }
      }
    }
    return changed;
  };

  let level: LogicLevel = 1;
  for (;;) {
    if (!grid.includes(0)) return { level, clues };
    if (applySingles()) continue;
    if (applyIntermediate()) {
      level = 2;
      continue;
    }
    return { level: 3, clues };
  }
}
