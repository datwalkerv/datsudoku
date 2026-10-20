"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, Flame, Loader2 } from "lucide-react";
import { PageHeader, PageShell, SectionLabel } from "@/components/layout/page-header";
import { LeaderboardList } from "@/components/leaderboard/leaderboard-list";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/components/providers/account-provider";
import { useOnline } from "@/hooks/use-online";
import { api } from "@/lib/client/api";
import { startDaily } from "@/lib/client/start";
import type { DailyStatus } from "@/lib/daily/types";
import { formatDateKey, formatDuration } from "@/lib/format";
import { msUntilNextUtcDay } from "@/lib/daily/date";
import { DIFFICULTY_LABEL } from "@/lib/sudoku/types";
import { INELIGIBLE_LABEL, type IneligibleReason } from "@/lib/games/rules";

export function DailyScreen() {
  const router = useRouter();
  const online = useOnline();
  const { account, pending } = useAccount();
  const [status, setStatus] = useState<DailyStatus | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!online || pending) return;
    let cancelled = false;
    api
      .daily()
      .then((s) => !cancelled && setStatus(s))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [online, pending, account?.id]);

  useEffect(() => {
    const update = () => setNow(Date.now());
    const first = setTimeout(update, 0);
    const id = setInterval(update, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  const play = async () => {
    setBusy(true);
    try {
      const id = await startDaily(account?.id ?? null);
      router.push(`/play?id=${encodeURIComponent(id)}`);
    } catch {
      toast.error("Couldn't load today's challenge.");
      setBusy(false);
    }
  };

  const remaining = now === null ? 0 : msUntilNextUtcDay(new Date(now));
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);

  return (
    <PageShell>
      <PageHeader title="Daily Challenge" />
      <div className="space-y-8 pt-2">
        <section className="rounded-[18px] border bg-card p-6 text-center">
          <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-accent text-tint">
            <CalendarDays className="size-5" strokeWidth={1.75} />
          </span>
          {!online ? (
            <p className="text-sm text-muted-foreground">The Daily Challenge needs a connection.</p>
          ) : error ? (
            <p className="text-sm text-muted-foreground">Couldn&apos;t load today&apos;s challenge.</p>
          ) : !status ? (
            <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
          ) : (
            <>
              <h2 className="text-xl font-semibold tracking-tight">
                {formatDateKey(status.dateKey, { weekday: "long", month: "long", day: "numeric" })}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {DIFFICULTY_LABEL[status.difficulty]} · {status.participants}{" "}
                {status.participants === 1 ? "player" : "players"} solved
              </p>
              {status.result ? (
                <div className="mt-5 space-y-1">
                  <p className="text-3xl font-medium tabular-nums">{formatDuration(status.result.timeMs)}</p>
                  <p className="text-[13px] text-muted-foreground">
                    {status.result.ranked
                      ? "Ranked on today's leaderboard"
                      : (INELIGIBLE_LABEL[status.result.reason as IneligibleReason] ?? "Not ranked")}
                  </p>
                </div>
              ) : (
                <Button onClick={play} disabled={busy} className="mt-5 h-12 w-full rounded-[12px] text-[15px]">
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  {status.game ? "Continue today's puzzle" : "Play today's puzzle"}
                </Button>
              )}
              <div className="mt-5 flex items-center justify-center gap-4 text-[13px] text-muted-foreground tabular-nums">
                <span className="inline-flex items-center gap-1">
                  <Flame className="size-4 text-orange-500" /> {status.streak} day streak
                </span>
                {now !== null && (
                  <span>
                    Next in {hours}h {minutes}m
                  </span>
                )}
              </div>
            </>
          )}
        </section>

        <section>
          <SectionLabel>Today&apos;s leaderboard</SectionLabel>
          <LeaderboardList
            query={{ scope: "daily" }}
            pageSize={10}
            compact
            refreshKey={status?.result?.timeMs}
            emptyText="No ranked completions yet today."
          />
        </section>

        <section className="space-y-2 px-1 text-[13px] leading-relaxed text-muted-foreground">
          <SectionLabel className="px-0">Rules</SectionLabel>
          <p>Everyone gets the same puzzle for each UTC day, and you get one attempt — reopening resumes it.</p>
          <p>
            Your time is measured by the server from when you first open the puzzle. Pausing hides the board, but the
            clock keeps running.
          </p>
          <p>Completing the puzzle on its day extends your streak. Hints are allowed but make the result unranked.</p>
        </section>
      </div>
    </PageShell>
  );
}
