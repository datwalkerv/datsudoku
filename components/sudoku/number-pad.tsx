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

/** Digit keys. Value keys show how many of that digit are still missing. */
export function NumberPad({ kind, counts, disabled, onDigit }: NumberPadProps) {
  const notes = kind === "note";
  return (
    <div
      role="group"
      aria-label={notes ? "Enter note" : "Enter number"}
      className={cn("grid grid-cols-9 gap-1.5", notes && "animate-fade-up")}
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
              "flex h-[3.75rem] flex-col items-center justify-center rounded-[18px] bg-key touch-manipulation select-none",
              "transition-[transform,background-color,opacity] duration-100 active:scale-[0.93] active:bg-fill",
              "disabled:opacity-40",
              notes ? "text-ink-entry" : "text-foreground",
              done && "opacity-35",
            )}
          >
            <span className="text-[2rem] leading-none font-semibold tabular-nums tracking-tight">{d}</span>
            {!notes && (
              <span className="mt-1 h-3 text-[0.6875rem] leading-3 font-medium tabular-nums text-muted-foreground">{done ? "" : remaining}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
