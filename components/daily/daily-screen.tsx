"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, Clock3, CloudOff, Flame, Loader2, Timer, Users } from "lucide-react";
import { EmptyState, Group, ListRow, PageHeader, PageShell, SectionLabel } from "@/components/layout/page-header";
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
  const { account, pending, ensureAccount } = useAccount();
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
      const owner = await ensureAccount();
      const id = await startDaily(owner?.id ?? null);
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
      <PageHeader title="Daily Challenge" backHref={null} />
      <div className="space-y-10">
        <section className="rounded-[20px] bg-card p-5 shadow-[var(--shadow-card)]">
          {!online ? (
            <EmptyState icon={CloudOff} title="You're offline">
              The Daily Challenge needs a connection.
            </EmptyState>
          ) : error ? (
            <EmptyState icon={CalendarDays} title="Couldn't load today's challenge">
              Check your connection and try again.
            </EmptyState>
          ) : !status ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <CalendarTile dateKey={status.dateKey} />
                <div className="min-w-0">
                  <h2 className="type-title2">
                    {formatDateKey(status.dateKey, { weekday: "long" })}
                  </h2>
                  <p className="type-subhead text-muted-foreground">
                    {DIFFICULTY_LABEL[status.difficulty]} · {status.participants}{" "}
                    {status.participants === 1 ? "player" : "players"} solved
                  </p>
                </div>
              </div>
              {status.result ? (
                <div className="mt-5 flex items-center justify-between rounded-[14px] bg-fill px-4 py-3">
                  <div>
                    <p className="type-caption text-muted-foreground">Your time</p>
                    <p className="type-title1 tabular-nums">{formatDuration(status.result.timeMs)}</p>
                  </div>
                  <p className="max-w-40 text-right type-footnote text-muted-foreground">
                    {status.result.ranked
                      ? "Ranked on today's leaderboard"
                      : (INELIGIBLE_LABEL[status.result.reason as IneligibleReason] ?? "Not ranked")}
                  </p>
                </div>
              ) : (
                <Button onClick={play} disabled={busy} className="mt-5 w-full">
                  {busy && <Loader2 className="animate-spin" />}
                  {status.game ? "Continue Today's Puzzle" : "Play Today's Puzzle"}
                </Button>
              )}
            </>
          )}
        </section>

        {status && (
          <div className="grid grid-cols-2 gap-3">
            <Tile label="Streak" value={`${status.streak}`} unit={status.streak === 1 ? "day" : "days"} icon={<Flame className="size-3.5" strokeWidth={1.6} />} />
            <Tile label="Next puzzle" value={now === null ? "–" : `${hours}h ${minutes}m`} icon={<Clock3 className="size-3.5" strokeWidth={1.6} />} />
          </div>
        )}

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

        <section>
          <SectionLabel>How it works</SectionLabel>
          <Group>
            <ListRow icon={Users} title="One puzzle for everyone" detail="New each UTC day, one attempt" />
            <ListRow icon={Timer} title="Timed by the server" detail="The clock keeps running while paused" />
            <ListRow icon={Flame} title="Keep your streak" detail="Solve it on its day; hints make it unranked" />
          </Group>
        </section>
      </div>
    </PageShell>
  );
}

/** An Apple Calendar–style date tile. */
function CalendarTile({ dateKey }: { dateKey: string }) {
  return (
    <div className="flex w-16 shrink-0 flex-col overflow-hidden rounded-[14px] bg-background text-center shadow-[var(--shadow-card)]">
      <span className="bg-primary py-0.5 type-eyebrow text-primary-foreground">
        {formatDateKey(dateKey, { weekday: "short" })}
      </span>
      <span className="py-1 text-[1.9rem] leading-tight font-semibold tabular-nums">
        {formatDateKey(dateKey, { day: "numeric" })}
      </span>
    </div>
  );
}

function Tile({ label, value, unit, icon }: { label: string; value: string; unit?: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-[16px] bg-card p-4">
      <p className="flex items-center gap-1.5 type-footnote font-medium text-muted-foreground">
        {icon} {label}
      </p>
      <p className="mt-1 type-title2 tabular-nums">
        {value}
        {unit && <span className="ml-1 type-subhead font-normal text-muted-foreground">{unit}</span>}
      </p>
    </div>
  );
}
