"use client";

import { cn } from "@/lib/utils";

interface NumberPadProps {
  /** "value" places numbers; "note" is the blue copy shown below it while Notes is on. */
  kind: "value" | "note";
  counts: number[];
  disabled: boolean;
  onDigit: (d: number) => void;
}

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** Digit entry. Value keys show how many of that digit are still missing. */
export function NumberPad({ kind, counts, disabled, onDigit }: NumberPadProps) {
  const notes = kind === "note";
  return (
    <div
      role="group"
      aria-label={notes ? "Enter note" : "Enter number"}
      className={cn("grid grid-cols-9 gap-1 sm:gap-1.5", notes && "animate-fade-up text-ink-entry")}
    >
      {DIGITS.map((d) => {
        const remaining = Math.max(0, 9 - counts[d]);
        const done = remaining === 0;
        return (
          <button
            key={d}
            type="button"
            disabled={disabled}
            onClick={() => onDigit(d)}
            aria-label={notes ? `Note ${d}` : `Number ${d}${done ? ", all placed" : `, ${remaining} left`}`}
            className={cn(
              "group flex h-14 flex-col items-center justify-center rounded-[10px] touch-manipulation select-none sm:h-16",
              !notes && "text-foreground",
              "transition-[background-color,transform,opacity] duration-100 active:scale-[0.94] active:bg-secondary",
              "hover:bg-secondary/70 disabled:opacity-40",
              "focus-visible:outline-2 focus-visible:outline-ring",
              done && "opacity-30",
            )}
          >
            <span
              className="text-[1.65rem] leading-none font-normal tabular-nums sm:text-[1.85rem]"
            >
              {d}
            </span>
            <span className="mt-1 h-3 text-[10px] leading-none tabular-nums text-muted-foreground">
              {done || notes ? "" : remaining}
            </span>
          </button>
        );
      })}
    </div>
  );
}
