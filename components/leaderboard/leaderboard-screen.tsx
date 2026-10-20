"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader, PageShell, SectionFooter } from "@/components/layout/page-header";
import { LeaderboardList } from "./leaderboard-list";
import { Segmented } from "@/components/ui/segmented";
import { DIFFICULTIES, DIFFICULTY_LABEL, type Difficulty } from "@/lib/sudoku/types";
import { utcDateKey, addDays } from "@/lib/daily/date";
import { formatDateKey } from "@/lib/format";
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
      <PageHeader title="Leaderboards" backHref={null} />
      <div className="space-y-6">
        <Segmented
          label="Leaderboard"
          options={[
            ["global", "Personal Bests"],
            ["daily", "Daily Challenge"],
          ]}
          value={scope}
          onChange={setScope}
        />

        {scope === "global" ? (
          <>
            <div className="space-y-2">
              <Segmented
                label="Mode"
                options={(["classic", "daily", "room"] as Mode[]).map((m) => [m, MODE_LABEL[m]] as const)}
                value={mode}
                onChange={setMode}
              />
              <Segmented
                label="Difficulty"
                options={DIFFICULTIES.map((d) => [d, DIFFICULTY_LABEL[d]] as const)}
                value={difficulty}
                onChange={setDifficulty}
              />
            </div>
            <LeaderboardList
              query={{ scope: "global", mode, difficulty }}
              emptyText="No ranked results here yet. Be the first."
            />
          </>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-[12px] bg-card p-1">
              <button
                type="button"
                aria-label="Previous day"
                onClick={() => setDateKey((d) => addDays(d, -1))}
                className="pressable inline-flex size-10 items-center justify-center rounded-[9px] text-tint active:bg-fill"
              >
                <ChevronLeft className="size-6" strokeWidth={2.2} />
              </button>
              <span className="type-headline">
                {dateKey === today ? "Today" : formatDateKey(dateKey, { weekday: "short", month: "short", day: "numeric" })}
              </span>
              <button
                type="button"
                aria-label="Next day"
                disabled={dateKey >= today}
                onClick={() => setDateKey((d) => addDays(d, 1))}
                className="pressable inline-flex size-10 items-center justify-center rounded-[9px] text-tint active:bg-fill disabled:opacity-30"
              >
                <ChevronRight className="size-6" strokeWidth={2.2} />
              </button>
            </div>
            <LeaderboardList query={{ scope: "daily", dateKey }} emptyText="No ranked completions for this day yet." />
          </>
        )}

        <SectionFooter>
          Only server‑verified, hint‑free games by registered players are ranked. Times are measured by the server.
          Ties go to fewer mistakes, then to whoever finished first.
        </SectionFooter>
      </div>
    </PageShell>
  );
}
