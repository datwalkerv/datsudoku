"use client";

import { useId } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * iOS segmented control. The thumb slides between options on a critically
 * damped spring, starting from wherever it is, so rapid taps stay smooth.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("grid h-11 rounded-full bg-fill p-1", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map(([v, text]) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v)}
            className={cn(
              "relative rounded-full type-subhead transition-colors duration-150",
              active ? "font-semibold text-foreground dark:text-black" : "font-medium text-muted-foreground active:opacity-60",
            )}
          >
            {active && (
              <motion.span
                layoutId={`segmented-thumb-${id}`}
                transition={{ type: "spring", bounce: 0, duration: 0.35 }}
                className="absolute inset-0 rounded-full bg-card shadow-[var(--shadow-thumb)] dark:bg-white"
              />
            )}
            <span className="relative">{text}</span>
          </button>
        );
      })}
    </div>
  );
}
