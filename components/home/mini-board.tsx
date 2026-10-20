import { cn } from "@/lib/utils";

/** A tiny, decorative preview of a game's board. */
export function MiniBoard({ givens, values, className }: { givens: string; values: number[]; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("grid aspect-square grid-cols-9 overflow-hidden rounded-[6px] border border-grid-strong/70 bg-board", className)}
    >
      {values.map((v, i) => {
        const r = Math.floor(i / 9);
        const c = i % 9;
        return (
          <span
            key={i}
            className={cn(
              "flex items-center justify-center text-[6px] leading-none tabular-nums",
              c === 2 || c === 5 ? "border-r border-r-grid-strong/60" : "",
              r === 2 || r === 5 ? "border-b border-b-grid-strong/60" : "",
              givens[i] !== "0" ? "text-ink-given" : "text-ink-entry",
            )}
          >
            {v || ""}
          </span>
        );
      })}
    </div>
  );
}
