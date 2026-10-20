"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CloudOff } from "lucide-react";
import { GameScreen } from "./game-screen";
import { BoardSkeleton } from "./board-skeleton";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/client/api";
import { getLocalGame, putLocalGame, type LocalGame } from "@/lib/local/db";
import { mergeWithServer } from "@/lib/local/convert";
import { useAccount } from "@/components/providers/account-provider";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; game: LocalGame; token: number }
  | { kind: "missing"; offline: boolean };

/**
 * Opens a game local-first: the IndexedDB copy renders immediately, then the
 * server copy is fetched and merged. The board is replaced only when the server
 * holds newer progress and this device has no unsynced changes.
 */
export function PlayLoader() {
  const id = useSearchParams().get("id");
  const { account, pending } = useAccount();
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const local = await getLocalGame(id);
      if (cancelled) return;
      // Keep a game that is already on screen: re-running this effect (session or
      // connectivity changes) must not remount it.
      if (local) setLoad((prev) => (prev.kind === "ready" && prev.game.id === id ? prev : { kind: "ready", game: local, token: 0 }));

      const canFetch = !id.startsWith("local-") && navigator.onLine;
      if (!canFetch) {
        if (!local) setLoad({ kind: "missing", offline: !navigator.onLine });
        return;
      }
      if (pending) return; // wait for the session before asking the server
      try {
        const { game } = await api.getGame(id);
        const current = (await getLocalGame(id)) ?? local;
        const merged = mergeWithServer(current, game, account?.id ?? null);
        if (cancelled) return;
        if (merged !== current) await putLocalGame(merged);
        // Remount only if the server copy changed what is on screen (not just its version).
        const changed =
          !current ||
          merged.state.values.join("") !== current.state.values.join("") ||
          merged.state.notes.join() !== current.state.notes.join() ||
          (merged.state.status === "completed") !== (current.state.status === "completed");
        if (changed) {
          setLoad({ kind: "ready", game: merged, token: Date.now() });
        }
      } catch (error) {
        if (!local && !cancelled) {
          setLoad({ kind: "missing", offline: error instanceof ApiError && error.status === 0 });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, pending, account?.id]);

  const view: LoadState = id ? load : { kind: "missing", offline: false };
  if (view.kind === "loading") return <BoardSkeleton />;
  if (view.kind === "missing") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-3 px-6 text-center">
        {view.offline && <CloudOff className="size-8 text-muted-foreground" />}
        <h1 className="text-lg font-semibold">{view.offline ? "Not available offline" : "Game not found"}</h1>
        <p className="text-sm text-muted-foreground">
          {view.offline
            ? "This game hasn't been opened on this device yet. Connect to the internet to load it."
            : "It may belong to another account or no longer exist."}
        </p>
        <Button asChild className="mt-2 rounded-full">
          <Link href="/">Back to Home</Link>
        </Button>
      </div>
    );
  }
  return <GameScreen key={`${view.game.id}:${view.token}`} game={view.game} />;
}
