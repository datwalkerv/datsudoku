"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flame, Loader2 } from "lucide-react";
import { Group, PageHeader, PageShell, SectionLabel } from "@/components/layout/page-header";
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
      <div className="space-y-8 pt-2 pb-6">
        {!online ? (
          <Note>Statistics need a connection.</Note>
        ) : failed ? (
          <Note>Couldn&apos;t load your statistics.</Note>
        ) : !stats ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {account?.isAnonymous && (
              <p className="rounded-xl bg-accent px-3 py-2 text-[13px] text-accent-foreground">
                Guest statistics live on this device&apos;s session.{" "}
                <Link href="/sign-up" className="font-medium underline-offset-2 hover:underline">
                  Create an account
                </Link>{" "}
                to keep them.
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              <Tile label="Solved" value={String(stats.totalCompleted)} />
              <Tile
                label="Streak"
                value={
                  <span className="inline-flex items-center gap-1">
                    <Flame className="size-5 text-orange-500" />
                    {stats.streak.current}
                  </span>
                }
              />
              <Tile label="Best streak" value={String(stats.streak.best)} />
            </div>

            <section>
              <SectionLabel>By difficulty</SectionLabel>
              <Group>
                {stats.byDifficulty.map((d) => {
                  const best = stats.personalBests
                    .filter((b) => b.difficulty === d.difficulty)
                    .sort((a, b) => a.timeMs - b.timeMs)[0];
                  return (
                    <div key={d.difficulty} className="grid min-h-12 grid-cols-4 items-center px-4 text-sm tabular-nums">
                      <span className="text-[15px]">{DIFFICULTY_LABEL[d.difficulty]}</span>
                      <Cell label="Solved" value={String(d.completed)} />
                      <Cell label="Average" value={d.averageMs ? formatDuration(d.averageMs) : "—"} />
                      <Cell label="Best" value={best ? formatDuration(best.timeMs) : "—"} />
                    </div>
                  );
                })}
              </Group>
            </section>

            <section>
              <SectionLabel>Recent games</SectionLabel>
              {stats.recent.length === 0 ? (
                <Note>No completed games yet.</Note>
              ) : (
                <Group>
                  {stats.recent.map((r) => (
                    <div key={r.id} className="flex min-h-12 items-center gap-3 px-4 py-2 text-sm tabular-nums">
                      <span className="flex-1">
                        <span className="block">
                          {MODE_LABEL[r.mode]} · {DIFFICULTY_LABEL[r.difficulty]}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {relativeTime(r.completedAt)} · {r.ranked ? "Ranked" : r.reason ? INELIGIBLE_LABEL[r.reason] : "Unranked"}
                        </span>
                      </span>
                      <span className="text-xs text-muted-foreground">{r.mistakes} ✕</span>
                      <span className="w-14 text-right font-medium">{formatDuration(r.timeMs)}</span>
                    </div>
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

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border bg-card px-3 py-4 text-center">
      <div className="text-2xl font-medium tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-right">
      <span className="block">{value}</span>
      <span className="block text-[11px] text-muted-foreground">{label}</span>
    </span>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="rounded-[14px] border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{children}</p>;
}
