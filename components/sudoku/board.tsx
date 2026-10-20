"use client";

import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { CellFlag, type GameState } from "@/lib/sudoku/engine";
import { colOf, rowOf } from "@/lib/sudoku/board";
import type { Settings } from "@/lib/client/settings";

interface BoardProps {
  state: GameState;
  flags: number[];
  settings: Settings;
  onSelect: (i: number) => void;
  /** Cell the completion ripple starts from. */
  rippleOrigin: number | null;
}

/**
 * The 9×9 board. Rendered as an ARIA grid; the cell under selection is the
 * single tab stop and arrow keys are handled by the game screen.
 */
export function Board({ state, flags, settings, onSelect, rippleOrigin }: BoardProps) {
  const completed = state.status === "completed";
  const rows = useMemo(() => Array.from({ length: 9 }, (_, r) => r), []);

  return (
    <div
      role="grid"
      aria-label="Sudoku board"
      aria-rowcount={9}
      aria-colcount={9}
      className={cn(
        "@container relative grid aspect-square w-full grid-rows-9 overflow-hidden rounded-[22px] bg-board select-none",
        "shadow-[var(--shadow-card)] touch-manipulation",
        // Outer frame drawn above the cells so their backgrounds never cover it.
        "after:pointer-events-none after:absolute after:inset-0 after:z-10 after:rounded-[22px] after:ring-[1.5px] after:ring-grid-strong/70 after:ring-inset",
      )}
    >
      {rows.map((r) => (
        <div role="row" key={r} className="grid grid-cols-9" aria-rowindex={r + 1}>
          {rows.map((c) => {
            const i = r * 9 + c;
            const ripple = completed && rippleOrigin !== null ? Math.abs(rowOf(i) - rowOf(rippleOrigin)) + Math.abs(colOf(i) - colOf(rippleOrigin)) : null;
            return (
              <Cell
                key={i}
                index={i}
                value={state.values[i]}
                notes={state.notes[i]}
                flags={flags[i]}
                highlightRelated={settings.highlightRelated}
                highlightMatches={settings.highlightMatches}
                selectedValue={state.selected !== null ? state.values[state.selected] : 0}
                tabStop={state.selected === null ? i === 0 : i === state.selected}
                ripple={ripple}
                onSelect={onSelect}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

interface CellProps {
  index: number;
  value: number;
  notes: number;
  flags: number;
  highlightRelated: boolean;
  highlightMatches: boolean;
  selectedValue: number;
  tabStop: boolean;
  ripple: number | null;
  onSelect: (i: number) => void;
}

const NOTE_DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const Cell = memo(function Cell({
  index,
  value,
  notes,
  flags,
  highlightRelated,
  highlightMatches,
  selectedValue,
  tabStop,
  ripple,
  onSelect,
}: CellProps) {
  const r = rowOf(index);
  const c = colOf(index);
  const selected = (flags & CellFlag.Selected) !== 0;
  const given = (flags & CellFlag.Given) !== 0;
  const wrong = (flags & (CellFlag.Conflict | CellFlag.Incorrect)) !== 0;
  const related = highlightRelated && (flags & CellFlag.Related) !== 0;
  const match = highlightMatches && (flags & CellFlag.SameValue) !== 0;

  const label = value
    ? `Row ${r + 1}, column ${c + 1}, ${value}${given ? ", given" : ""}${wrong ? ", incorrect" : ""}`
    : notes
      ? `Row ${r + 1}, column ${c + 1}, empty, notes ${NOTE_DIGITS.filter((d) => notes & (1 << d)).join(" ")}`
      : `Row ${r + 1}, column ${c + 1}, empty`;

  return (
    <button
      type="button"
      role="gridcell"
      aria-colindex={c + 1}
      aria-selected={selected}
      aria-label={label}
      tabIndex={tabStop ? 0 : -1}
      data-cell={index}
      onPointerDown={(e) => {
        // Select on press for snappy touch response; keep focus for keyboard users.
        e.preventDefault();
        onSelect(index);
      }}
      onClick={() => onSelect(index)}
      style={ripple !== null ? ({ "--ripple-delay": `${ripple * 45}ms` } as React.CSSProperties) : undefined}
      className={cn(
        "relative flex items-center justify-center outline-none transition-colors duration-150",
        "border-grid-line",
        c < 8 && "border-r",
        (c === 2 || c === 5) && "border-r-[1.5px] border-r-grid-strong",
        r < 8 && "border-b",
        (r === 2 || r === 5) && "border-b-[1.5px] border-b-grid-strong",
        "bg-board",
        related && "bg-cell-related",
        match && "bg-cell-match",
        wrong && !given && "bg-cell-conflict",
        selected && "bg-cell-selected",
        "focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-tint focus-visible:ring-inset",
        ripple !== null && "animate-cell-complete",
      )}
    >
      {value ? (
        <span
          key={value}
          className={cn(
            "text-[7.2cqw] leading-none tabular-nums tracking-tight",
            given ? "font-semibold text-ink-given" : "font-medium text-ink-entry animate-cell-pop",
            wrong && !given && "text-ink-error",
          )}
        >
          {value}
        </span>
      ) : notes ? (
        <span aria-hidden className="grid h-full w-full grid-cols-3 grid-rows-3 p-[0.35cqw]">
          {NOTE_DIGITS.map((d) => (
            <span
              key={d}
              className={cn(
                "flex items-center justify-center text-[2.5cqw] leading-none font-medium tabular-nums tracking-normal text-ink-note",
                selectedValue === d && notes & (1 << d) && "font-semibold text-ink-entry",
              )}
            >
              {notes & (1 << d) ? d : ""}
            </span>
          ))}
        </span>
      ) : null}
    </button>
  );
});
