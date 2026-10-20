"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader, PageShell } from "@/components/layout/page-header";
import { LeaderboardList } from "./leaderboard-list";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DIFFICULTIES, DIFFICULTY_LABEL, type Difficulty } from "@/lib/sudoku/types";
import { utcDateKey, addDays } from "@/lib/daily/date";
import { formatDateKey } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Scope = "global" | "daily";
type Mode = "classic" | "daily" | "room";

const MODE_LABEL: Record<Mode, string> = { classic: "Classic", daily: "Daily", room: "Rooms" };

export function LeaderboardScreen() {
  const params = useSearchParams();
  const [scope, setScope] = useState<Scope>(params.get("scope") === "daily" ? "daily" : "global");
  const [mode, setMode] = useState<Mode>("classic");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const today = utcDateKey();
  const [dateKey, setDateKey] = useState(today);

  return (
    <PageShell>
      <PageHeader title="Leaderboards" />
      <div className="space-y-5 pt-2">
        <Tabs value={scope} onValueChange={(v) => setScope(v as Scope)}>
          <TabsList className="grid h-10 w-full grid-cols-2">
            <TabsTrigger value="global">Personal bests</TabsTrigger>
            <TabsTrigger value="daily">Daily Challenge</TabsTrigger>
          </TabsList>
        </Tabs>

        {scope === "global" ? (
          <>
            <div className="space-y-2">
              <Segmented
                label="Mode"
                options={(["classic", "daily", "room"] as Mode[]).map((m) => [m, MODE_LABEL[m]])}
                value={mode}
                onChange={(v) => setMode(v as Mode)}
              />
              <Segmented
                label="Difficulty"
                options={DIFFICULTIES.map((d) => [d, DIFFICULTY_LABEL[d]])}
                value={difficulty}
                onChange={(v) => setDifficulty(v as Difficulty)}
              />
            </div>
            <LeaderboardList
              query={{ scope: "global", mode, difficulty }}
              emptyText="No ranked results here yet. Be the first."
            />
          </>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-[12px] border bg-card px-1 py-1">
              <button
                type="button"
                aria-label="Previous day"
                onClick={() => setDateKey((d) => addDays(d, -1))}
                className="inline-flex size-9 items-center justify-center rounded-lg text-tint hover:bg-secondary"
              >
                <ChevronLeft className="size-5" />
              </button>
              <span className="text-sm font-medium">
                {dateKey === today ? "Today" : formatDateKey(dateKey, { weekday: "short", month: "short", day: "numeric" })}
              </span>
              <button
                type="button"
                aria-label="Next day"
                disabled={dateKey >= today}
                onClick={() => setDateKey((d) => addDays(d, 1))}
                className="inline-flex size-9 items-center justify-center rounded-lg text-tint hover:bg-secondary disabled:opacity-30"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
            <LeaderboardList query={{ scope: "daily", dateKey }} emptyText="No ranked completions for this day yet." />
          </>
        )}

        <p className="px-1 text-xs leading-relaxed text-muted-foreground">
          Only server‑verified, hint‑free games by registered players are ranked. Daily and room times are measured by
          the server. Ties are broken by fewer mistakes, then by who finished first.
        </p>
      </div>
    </PageShell>
  );
}

export function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: [string, string][];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid gap-1 rounded-[10px] bg-secondary p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "h-8 rounded-[8px] text-[13px] transition-colors",
            value === v ? "bg-card font-medium shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

