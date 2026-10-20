"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
      <div className="space-y-px overflow-hidden rounded-[14px] border bg-card" aria-busy="true">
        {Array.from({ length: compact ? 3 : 6 }, (_, k) => (
          <div key={k} className="flex h-12 items-center gap-3 px-4">
            <Skeleton className="h-4 w-6" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    );
  }
  if (entries.length === 0) return <Empty>{emptyText}</Empty>;

  const youVisible = entries.some((e) => e.isYou);
  return (
    <div className="space-y-3">
      <ol className="overflow-hidden rounded-[14px] border bg-card divide-y divide-border">
        {entries.map((e) => (
          <Row key={`${e.rank}-${e.completedAt}`} entry={e} />
        ))}
      </ol>
      {you && !youVisible && (
        <div className="flex h-12 items-center gap-3 rounded-[14px] border border-tint/30 bg-accent px-4 text-sm tabular-nums">
          <span className="w-8 font-medium text-tint">#{you.rank}</span>
          <span className="flex-1 font-medium">You</span>
          <span className="text-muted-foreground">{you.mistakes} ✕</span>
          <span className="w-16 text-right font-medium">{formatDuration(you.timeMs)}</span>
        </div>
      )}
      {cursor && (
        <Button variant="ghost" className="w-full text-tint" onClick={more} disabled={loadingMore}>
          {loadingMore && <Loader2 className="size-4 animate-spin" />} Show more
        </Button>
      )}
    </div>
  );
}

function Row({ entry: e }: { entry: LeaderboardEntryDTO }) {
  return (
    <li className={cn("flex h-12 items-center gap-3 px-4 text-sm tabular-nums", e.isYou && "bg-accent/60")}>
      <span className={cn("w-8 text-muted-foreground", e.rank <= 3 && "font-semibold text-foreground")}>{e.rank}</span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className={cn("truncate", e.isYou && "font-medium")}>{e.isYou ? `${e.name} (you)` : e.name}</span>
        {e.isGuest && <Tag>Guest</Tag>}
        {!e.ranked && e.hintsUsed > 0 && <Tag>Hints</Tag>}
      </span>
      <span className="text-xs text-muted-foreground" title="Mistakes">
        {e.mistakes} ✕
      </span>
      <span className="w-16 text-right font-medium">{formatDuration(e.timeMs)}</span>
    </li>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">{children}</span>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[14px] border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">{children}</p>
  );
}
