"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trophy } from "lucide-react";
import { EmptyState } from "@/components/layout/page-header";
import { api, ApiError } from "@/lib/client/api";
import type { LeaderboardEntryDTO, LeaderboardPageDTO } from "@/lib/leaderboard/types";
import { formatDuration } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useOnline } from "@/hooks/use-online";

export interface LeaderboardQuery {
  scope: "global" | "daily" | "room";
  mode?: string;
  difficulty?: string;
  dateKey?: string;
  roomCode?: string;
  round?: number;
}

/** Paginated leaderboard with the viewer's own position pinned below. */
export function LeaderboardList({
  query,
  pageSize = 25,
  emptyText = "No ranked results yet.",
  refreshKey,
  compact,
}: {
  query: LeaderboardQuery;
  pageSize?: number;
  emptyText?: string;
  /** Changing this value reloads the first page. */
  refreshKey?: unknown;
  compact?: boolean;
}) {
  const online = useOnline();
  const [entries, setEntries] = useState<LeaderboardEntryDTO[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [you, setYou] = useState<LeaderboardPageDTO["you"]>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const key = JSON.stringify(query);

  const load = useCallback(
    async (after?: string) => {
      const page = await api.leaderboard({ ...JSON.parse(key), limit: pageSize, cursor: after });
      return page;
    },
    [key, pageSize],
  );

  useEffect(() => {
    if (!online) return;
    let cancelled = false;
    load()
      .then((page) => {
        if (cancelled) return;
        setEntries(page.entries);
        setCursor(page.nextCursor);
        setYou(page.you);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e instanceof ApiError ? e.message : "Couldn't load the leaderboard."));
    return () => {
      cancelled = true;
    };
  }, [load, online, refreshKey]);

  const more = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await load(cursor);
      setEntries((prev) => [...(prev ?? []), ...page.entries]);
      setCursor(page.nextCursor);
    } catch {
      setError("Couldn't load more results.");
    } finally {
      setLoadingMore(false);
    }
  };

  if (!online) return <Empty>Leaderboards need a connection.</Empty>;
  if (error && !entries) return <Empty>{error}</Empty>;
  if (!entries) {
    return (
      <div className="overflow-hidden rounded-[12px] bg-card" aria-busy="true">
        {Array.from({ length: compact ? 3 : 6 }, (_, k) => (
          <div key={k} className="flex h-[52px] items-center gap-3 px-4">
            <Skeleton className="size-7 rounded-full" />
            <Skeleton className="h-4 flex-1 rounded-full" />
            <Skeleton className="h-4 w-12 rounded-full" />
          </div>
        ))}
      </div>
    );
  }
  if (entries.length === 0) return <Empty>{emptyText}</Empty>;

  const youVisible = entries.some((e) => e.isYou);
  return (
    <div className="space-y-3">
      <ol className="overflow-hidden rounded-[12px] bg-card">
        {entries.map((e) => (
          <Row key={`${e.rank}-${e.completedAt}`} entry={e} />
        ))}
      </ol>
      {you && !youVisible && (
        <div className="flex h-[52px] items-center gap-3 rounded-[12px] bg-accent px-4 tabular-nums">
          <span className="w-7 text-center type-headline text-tint">{you.rank}</span>
          <span className="flex-1 type-headline">You</span>
          <span className="type-footnote text-muted-foreground">{you.mistakes} mistakes</span>
          <span className="w-14 text-right type-headline">{formatDuration(you.timeMs)}</span>
        </div>
      )}
      {cursor && (
        <Button variant="ghost" size="sm" className="w-full" onClick={more} disabled={loadingMore}>
          {loadingMore && <Loader2 className="animate-spin" />} Show more
        </Button>
      )}
    </div>
  );
}

/** The podium is marked by weight, not color. */
const MEDAL = ["bg-primary text-primary-foreground", "bg-fill-strong text-foreground", "bg-fill text-foreground"];

function Row({ entry: e }: { entry: LeaderboardEntryDTO }) {
  return (
    <li
      className={cn(
        "group/row flex h-[52px] items-center gap-3 pl-4 tabular-nums",
        e.isYou && "bg-accent",
      )}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full type-footnote font-semibold",
          e.rank <= 3 ? MEDAL[e.rank - 1] : "text-muted-foreground",
        )}
      >
        {e.rank}
      </span>
      <span className="relative flex min-w-0 flex-1 items-center gap-2 self-stretch pr-4 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:scale-y-50 after:bg-border group-last/row:after:hidden">
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className={cn("truncate type-body", e.isYou && "font-semibold")}>{e.isYou ? `${e.name} (you)` : e.name}</span>
          {e.isGuest && <Tag>Guest</Tag>}
          {!e.ranked && e.hintsUsed > 0 && <Tag>Hints</Tag>}
        </span>
        <span className="type-footnote text-muted-foreground" title="Mistakes">
          {e.mistakes} ✕
        </span>
        <span className="w-14 text-right type-headline">{formatDuration(e.timeMs)}</span>
      </span>
    </li>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="shrink-0 rounded-full bg-fill px-2 py-0.5 type-caption font-medium text-muted-foreground">{children}</span>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <EmptyState icon={Trophy}>
      {children}
    </EmptyState>
  );
}
