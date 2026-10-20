"use client";

import { cn } from "@/lib/utils";

interface NumberPadProps {
  counts: number[];
  notesMode: boolean;
  disabled: boolean;
  onDigit: (d: number) => void;
}

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Digit entry. Each key shows how many of that digit are still missing. */
export function NumberPad({ counts, notesMode, disabled, onDigit }: NumberPadProps) {
  return (
    <div role="group" aria-label={notesMode ? "Enter note" : "Enter number"} className="grid grid-cols-9 gap-1 sm:gap-1.5">
      {DIGITS.map((d) => {
        const remaining = Math.max(0, 9 - counts[d]);
        const done = remaining === 0;
        return (
          <button
            key={d}
            type="button"
            disabled={disabled}
            onClick={() => onDigit(d)}
            aria-label={`${notesMode ? "Note" : "Number"} ${d}${done ? ", all placed" : `, ${remaining} left`}`}
            className={cn(
              "group flex h-14 flex-col items-center justify-center rounded-[10px] touch-manipulation select-none sm:h-16",
              "text-foreground transition-[background-color,transform,opacity] duration-100 active:scale-[0.94] active:bg-secondary",
              "hover:bg-secondary/70 disabled:opacity-40",
              "focus-visible:outline-2 focus-visible:outline-ring",
              done && "opacity-30",
            )}
          >
            <span
              className={cn(
                "text-[1.65rem] leading-none tabular-nums sm:text-[1.85rem]",
                notesMode ? "font-light text-ink-entry" : "font-normal",
              )}
            >
              {d}
            </span>
            <span className="mt-1 h-3 text-[10px] leading-none tabular-nums text-muted-foreground">
              {done ? "" : remaining}
            </span>
          </button>
        );
      })}
    </div>
  );
}
