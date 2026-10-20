"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CloudOff } from "lucide-react";
import { Group, PageShell, SectionLabel } from "@/components/layout/page-header";
import { listLocalGames, type LocalGame } from "@/lib/local/db";
import { DIFFICULTY_LABEL } from "@/lib/sudoku/types";
import { formatDuration } from "@/lib/format";

/** Fallback for pages that aren't available offline: lists games saved on this device. */
export function OfflineScreen() {
  const [games, setGames] = useState<LocalGame[] | null>(null);
  useEffect(() => {
    listLocalGames(20)
      .then((g) => setGames(g.filter((x) => x.state.status !== "completed")))
      .catch(() => setGames([]));
  }, []);

  return (
    <PageShell className="gap-6 pt-16">
      <div className="text-center">
        <CloudOff className="mx-auto size-8 text-muted-foreground" />
        <h1 className="mt-3 text-xl font-semibold tracking-tight">You&apos;re offline</h1>
        <p className="mt-1 text-sm text-muted-foreground">This page needs a connection. Your saved games still work.</p>
      </div>
      {games && games.length > 0 && (
        <section>
          <SectionLabel>Saved on this device</SectionLabel>
          <Group>
            {games.map((g) => (
              <a key={g.id} href={`/play?id=${encodeURIComponent(g.id)}`} className="flex min-h-12 items-center px-4 text-[15px] hover:bg-secondary/50">
                <span className="flex-1">
                  {g.mode === "daily" ? "Daily" : g.mode === "room" ? `Room ${g.roomCode}` : "Classic"} · {DIFFICULTY_LABEL[g.difficulty]}
                </span>
                <span className="text-sm text-muted-foreground tabular-nums">{formatDuration(g.state.elapsedMs)}</span>
              </a>
            ))}
          </Group>
        </section>
      )}
      <Link href="/" className="text-center text-sm text-tint">
        Go to Home
      </Link>
    </PageShell>
  );
}
