"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, CircleCheck, CloudOff, Flame, Grid3x3, Loader2, Trophy, UserPlus } from "lucide-react";
import { EmptyState, Group, ListRow, PageHeader, PageShell, SectionLabel } from "@/components/layout/page-header";
import { useAccount } from "@/components/providers/account-provider";
import { useOnline } from "@/hooks/use-online";
import { api } from "@/lib/client/api";
import type { StatsDTO } from "@/lib/stats/types";
import { DIFFICULTY_LABEL } from "@/lib/sudoku/types";
import { formatDuration, relativeTime } from "@/lib/format";
import { INELIGIBLE_LABEL } from "@/lib/games/rules";

const MODE_LABEL = { classic: "Classic", daily: "Daily", room: "Room" } as const;

export function StatsScreen() {
  const online = useOnline();
  const { account, pending } = useAccount();
  const [stats, setStats] = useState<StatsDTO | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!online || pending || !account) return;
    let cancelled = false;
    api
      .stats()
      .then((r) => !cancelled && setStats(r.stats))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [online, pending, account]);

  return (
    <PageShell>
      <PageHeader title="Statistics" />
      <div className="space-y-10 pb-6">
        {!online ? (
          <EmptyState icon={CloudOff} title="You're offline">
            Statistics need a connection.
          </EmptyState>
        ) : failed ? (
          <EmptyState icon={BarChart3} title="Couldn't load statistics">
            Check your connection and try again.
          </EmptyState>
        ) : !stats ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {account?.isAnonymous && (
              <Link href="/sign-up" className="pressable flex items-center gap-3 rounded-[14px] bg-accent p-4">
                <UserPlus className="size-5 shrink-0 text-tint" />
                <span className="flex-1 type-subhead text-accent-foreground">
                  Guest stats stay on this device. <span className="font-semibold">Create an account</span> to keep them.
                </span>
              </Link>
            )}
            <div className="grid grid-cols-3 gap-3">
              <Tile label="Solved" value={String(stats.totalCompleted)} icon={<CircleCheck className="size-3.5" strokeWidth={1.6} />} />
              <Tile label="Streak" value={String(stats.streak.current)} icon={<Flame className="size-3.5" strokeWidth={1.6} />} />
              <Tile label="Best" value={String(stats.streak.best)} icon={<Trophy className="size-3.5" strokeWidth={1.6} />} />
            </div>

            <section>
              <SectionLabel>By difficulty</SectionLabel>
              <Group>
                <div className="grid grid-cols-4 px-4 pt-2.5 pb-1 type-caption font-medium text-muted-foreground uppercase">
                  <span />
                  <span className="text-right">Solved</span>
                  <span className="text-right">Average</span>
                  <span className="text-right">Best</span>
                </div>
                {stats.byDifficulty.map((d) => {
                  const best = stats.personalBests
                    .filter((b) => b.difficulty === d.difficulty)
                    .sort((a, b) => a.timeMs - b.timeMs)[0];
                  return (
                    <div
                      key={d.difficulty}
                      className="group/row relative grid min-h-11 grid-cols-4 items-center px-4 tabular-nums after:absolute after:right-0 after:bottom-0 after:left-4 after:h-px after:scale-y-50 after:bg-border last:after:hidden"
                    >
                      <span className="type-body">{DIFFICULTY_LABEL[d.difficulty]}</span>
                      <span className="text-right type-body">{d.completed}</span>
                      <span className="text-right type-body text-muted-foreground">{d.averageMs ? formatDuration(d.averageMs) : "–"}</span>
                      <span className="text-right type-headline">{best ? formatDuration(best.timeMs) : "–"}</span>
                    </div>
                  );
                })}
              </Group>
            </section>

            <section>
              <SectionLabel>Recent games</SectionLabel>
              {stats.recent.length === 0 ? (
                <EmptyState icon={Grid3x3}>No completed games yet. Your results will appear here.</EmptyState>
              ) : (
                <Group>
                  {stats.recent.map((r) => (
                    <ListRow
                      key={r.id}
                      title={`${MODE_LABEL[r.mode]} · ${DIFFICULTY_LABEL[r.difficulty]}`}
                      detail={`${relativeTime(r.completedAt)} · ${r.ranked ? "Ranked" : r.reason ? INELIGIBLE_LABEL[r.reason] : "Unranked"}`}
                      value={formatDuration(r.timeMs)}
                    />
                  ))}
                </Group>
              )}
            </section>
          </>
        )}
      </div>
    </PageShell>
  );
}

function Tile({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-[16px] bg-card p-3.5">
      <p className="flex items-center gap-1 type-caption font-medium text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-1 type-title1 tabular-nums">{value}</p>
    </div>
  );
}
