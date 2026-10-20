"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { BadgeCheck, Check, CloudOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatDuration } from "@/lib/format";
import { INELIGIBLE_LABEL } from "@/lib/games/rules";
import type { GameState } from "@/lib/sudoku/engine";
import type { LocalGame } from "@/lib/local/db";
import type { ResultDTO } from "@/lib/games/types";
import type { SyncStatus } from "@/lib/client/sync";
import { DIFFICULTY_LABEL } from "@/lib/sudoku/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: LocalGame;
  state: GameState;
  result: ResultDTO | null;
  syncStatus: SyncStatus;
  onRetry: () => void;
  onNewGame: () => void;
}

export function CompletionDialog({ open, onOpenChange, game, state, result, syncStatus, onRetry, onNewGame }: Props) {
  // Verified results use the server's time; until then show the local clock.
  const time = result ? result.timeMs : state.elapsedMs;
  const mistakes = result ? result.mistakes : state.mistakes;
  const hints = result ? result.hintsUsed : state.hintsUsed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 overflow-hidden p-0">
        <div className="px-6 pt-9 pb-5 text-center">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.3, duration: 0.5, delay: 0.08 }}
            className="mx-auto mb-5 flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <Check className="size-7" strokeWidth={2.2} />
          </motion.div>
          <DialogTitle className="type-title1">Solved!</DialogTitle>
          <DialogDescription className="mt-1 type-subhead text-muted-foreground">
            {DIFFICULTY_LABEL[game.difficulty]} {game.mode === "daily" ? "Daily Challenge" : game.mode === "room" ? "room puzzle" : "puzzle"}
          </DialogDescription>

          <dl className="mt-6 grid grid-cols-3 divide-x divide-border rounded-[14px] bg-fill py-3.5">
            <Stat label="Time" value={formatDuration(time)} />
            <Stat label="Mistakes" value={String(mistakes)} />
            <Stat label="Hints" value={String(hints)} />
          </dl>

          <div className="mt-4 min-h-10 type-footnote" aria-live="polite">
            <VerificationLine game={game} result={result} syncStatus={syncStatus} onRetry={onRetry} />
          </div>
        </div>

        <div className="grid gap-1 px-5 pb-5">
          {game.mode === "classic" && (
            <Button onClick={onNewGame}>
              New {DIFFICULTY_LABEL[game.difficulty]} game
            </Button>
          )}
          {game.mode === "daily" && (
            <Button asChild>
              <Link href="/leaderboard?scope=daily">Today&apos;s leaderboard</Link>
            </Button>
          )}
          {game.mode === "room" && game.roomCode && (
            <Button asChild>
              <Link href={`/multiplayer/${game.roomCode}`}>Room results</Link>
            </Button>
          )}
          <Button asChild variant="ghost">
            <Link href="/">Home</Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <dt className="type-caption text-muted-foreground">{label}</dt>
      <dd className="type-title3 tabular-nums">{value}</dd>
    </div>
  );
}

function VerificationLine({
  game,
  result,
  syncStatus,
  onRetry,
}: {
  game: LocalGame;
  result: ResultDTO | null;
  syncStatus: SyncStatus;
  onRetry: () => void;
}) {
  if (!game.serverBacked) {
    return <p className="text-muted-foreground">Offline game — saved on this device only.</p>;
  }
  if (result) {
    return (
      <div className="space-y-1">
        <p className="inline-flex items-center gap-1 font-medium text-foreground">
          <BadgeCheck className="size-4 text-tint" /> Verified by server
          {result.personalBest && <span className="ml-1 rounded-full bg-accent px-2 py-0.5 text-xs text-tint">Personal best</span>}
        </p>
        <p className="text-muted-foreground">
          {result.ranked ? "Ranked on the leaderboard." : result.reason ? INELIGIBLE_LABEL[result.reason] : "Not ranked."}
          {result.reason === "guest" && (
            <>
              {" "}
              <Link href="/sign-up" className="text-tint underline-offset-2 hover:underline">
                Create an account
              </Link>{" "}
              to claim it.
            </>
          )}
        </p>
      </div>
    );
  }
  if (syncStatus === "offline") {
    return (
      <p className="inline-flex items-center gap-1.5 text-muted-foreground">
        <CloudOff className="size-4" /> Saved on this device. It will be verified when you&apos;re back online.
      </p>
    );
  }
  if (syncStatus === "error") {
    return (
      <p className="text-muted-foreground">
        Couldn&apos;t verify yet.{" "}
        <button type="button" className="text-tint hover:underline" onClick={onRetry}>
          Try again
        </button>
      </p>
    );
  }
  return (
    <p className="inline-flex items-center gap-1.5 text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> Verifying with server…
    </p>
  );
}
