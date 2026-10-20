"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { Ellipsis, Pause, Play, RotateCcw, Sparkles, Plus, Settings2, Trophy, Users } from "lucide-react";
import { Board } from "./board";
import { NumberPad } from "./number-pad";
import { Toolbar } from "./toolbar";
import { CompletionDialog } from "./completion-dialog";
import { useGame } from "./use-game";
import { PageHeader } from "@/components/layout/page-header";
import { SyncBadge } from "@/components/layout/sync-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cellFlags, digitCounts, type GameState } from "@/lib/sudoku/engine";
import { useSettings } from "@/lib/client/settings";
import { startClassic } from "@/lib/client/start";
import { formatDateKey, formatDuration } from "@/lib/format";
import { DIFFICULTY_LABEL } from "@/lib/sudoku/types";
import type { LocalGame } from "@/lib/local/db";
import { useAccount } from "@/components/providers/account-provider";
import { cn } from "@/lib/utils";

export function GameScreen({ game }: { game: LocalGame }) {
  const router = useRouter();
  const settings = useSettings();
  const { ensureAccount } = useAccount();
  const reduceMotion = useReducedMotion();
  const { state, actions, hint, result, syncStatus, isRanked, retryVerification } = useGame(game);
  const [hintConfirm, setHintConfirm] = useState(false);
  const [hintBusy, setHintBusy] = useState(false);
  const [restartConfirm, setRestartConfirm] = useState(false);
  const [completionOpen, setCompletionOpen] = useState(state.status === "completed" && !game.result);
  const [announcement, setAnnouncement] = useState("");
  const [rippleOrigin, setRippleOrigin] = useState<number | null>(null);

  const flags = useMemo(() => cellFlags(state, settings.showMistakes), [state, settings.showMistakes]);
  const counts = useMemo(() => digitCounts(state.values), [state.values]);
  const playing = state.status === "playing";
  const paused = state.status === "paused";
  const completed = state.status === "completed";

  // Open the completion sheet once, when the puzzle is finished.
  const prevStatus = useRef(state.status);
  useEffect(() => {
    if (state.status === "completed" && prevStatus.current !== "completed") {
      prevStatus.current = state.status;
      const origin = state.selected ?? 40;
      const t = setTimeout(
        () => {
          setRippleOrigin(origin);
          setAnnouncement("Puzzle complete.");
        },
        0,
      );
      const open = setTimeout(() => setCompletionOpen(true), reduceMotion ? 0 : 650);
      return () => {
        clearTimeout(t);
        clearTimeout(open);
      };
    }
    prevStatus.current = state.status;
  }, [state.status, state.selected, reduceMotion]);

  const runHint = useCallback(
    async (confirmed = false) => {
      setHintBusy(true);
      const outcome = await hint(confirmed);
      setHintBusy(false);
      if (outcome === "needs-confirmation") setHintConfirm(true);
      else if (outcome === "offline") toast("Hints for ranked games need a connection.");
      else if (outcome === "unavailable") toast("No hint available right now.");
    },
    [hint],
  );

  /** Runs a digit action on the selected cell, or asks the player to pick one. */
  const withCell = useCallback(
    (act: (d: number) => void) => (d: number) => {
      if (state.selected === null) setAnnouncement("Select a cell first.");
      else act(d);
    },
    [state.selected],
  );
  const onDigit = withCell(actions.input);

  // Keyboard: digits, arrows, erase, notes, undo/redo, pause.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [role=dialog], [role=menu]")) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) actions.redo();
        else actions.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        actions.redo();
        return;
      }
      if (mod || (e.altKey && !/^Digit[1-9]$/.test(e.code))) return;
      if (paused) {
        if (e.key === " " || e.key === "Enter" || e.key === "Escape") {
          e.preventDefault();
          actions.resume();
        }
        return;
      }
      if (!playing) return;
      const digit = /^Digit([1-9])$/.exec(e.code)?.[1] ?? /^Numpad([1-9])$/.exec(e.code)?.[1];
      if (digit) {
        e.preventDefault();
        if (e.shiftKey || e.altKey) actions.note(Number(digit));
        else onDigit(Number(digit));
        return;
      }
      const arrows: Record<string, "up" | "down" | "left" | "right"> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
      };
      if (arrows[e.key]) {
        e.preventDefault();
        actions.move(arrows[e.key]);
        return;
      }
      switch (e.key) {
        case "Backspace":
        case "Delete":
        case "0":
          e.preventDefault();
          actions.erase();
          break;
        case "n":
        case "N":
          actions.toggleNotes();
          break;
        case "h":
        case "H":
          void runHint();
          break;
        case " ":
          e.preventDefault();
          actions.pause();
          break;
        case "Escape":
          actions.select(null);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions, onDigit, paused, playing, runHint]);

  // Keep keyboard focus on the selected cell for screen readers.
  useEffect(() => {
    if (state.selected === null) return;
    const el = document.querySelector<HTMLElement>(`[data-cell="${state.selected}"]`);
    if (el && document.activeElement?.hasAttribute("data-cell")) el.focus({ preventScroll: true });
  }, [state.selected]);

  const newGame = async () => {
    try {
      const owner = await ensureAccount();
      const started = await startClassic(game.difficulty, owner?.id ?? null);
      if (started.offline) toast("Offline game — progress stays on this device.");
      router.replace(`/play?id=${encodeURIComponent(started.id)}`);
    } catch {
      toast.error("Couldn't start a new game. Please try again.");
    }
  };


  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col safe-px safe-pb lg:max-w-5xl">
      <PageHeader
        large={false}
        title={titleFor(game)}
        subtitle={subtitleFor(game, isRanked)}
        backHref={game.roomCode ? `/multiplayer/${game.roomCode}` : "/"}
        backLabel={game.roomCode ? "Room" : "Home"}
        trailing={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Game menu" className="-mr-2">
                <Ellipsis className="size-6" strokeWidth={2.2} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem disabled={!playing} onSelect={() => actions.fillCandidates()}>
                <Sparkles /> Fill all notes
              </DropdownMenuItem>
              <DropdownMenuItem disabled={completed} onSelect={() => setRestartConfirm(true)}>
                <RotateCcw /> Restart puzzle
              </DropdownMenuItem>
              {game.mode === "classic" && (
                <DropdownMenuItem onSelect={() => void newGame()}>
                  <Plus /> New {DIFFICULTY_LABEL[game.difficulty]} game
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings2 /> Settings
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="flex flex-1 flex-col gap-5 pt-2 pb-2 lg:flex-row lg:items-center lg:justify-center lg:gap-12">
        {/* Board column: the board sits centered in the space above the controls. */}
        <div className="flex w-full flex-1 flex-col justify-center gap-3 lg:max-w-[560px] lg:flex-none">
          <div className="grid grid-cols-3 items-center px-1">
            <Stat label="Mistakes" value={state.mistakes} tone={state.mistakes > 0 ? "error" : undefined} />
            <div className="flex justify-center">
              <button
                type="button"
                onClick={paused ? actions.resume : actions.pause}
                disabled={completed}
                aria-label={paused ? "Resume timer" : "Pause timer"}
                className="pressable inline-flex h-10 items-center gap-2 rounded-full bg-card pr-3.5 pl-4 disabled:opacity-60"
              >
                <span className="type-headline tabular-nums tracking-normal" aria-hidden={!settings.showTimer}>
                  {settings.showTimer ? formatDuration(state.elapsedMs) : paused ? "Paused" : "Playing"}
                </span>
                {paused ? (
                  <Play className="size-3.5 fill-current text-tint" />
                ) : (
                  <Pause className="size-3.5 fill-current text-muted-foreground" />
                )}
              </button>
            </div>
            <div className="flex items-center justify-end gap-3">
              {state.hintsUsed > 0 && <Stat label="Hints" value={state.hintsUsed} align="end" />}
              <SyncBadge status={game.serverBacked ? syncStatus : "device"} />
            </div>
          </div>

          <div className="relative">
            <Board
              state={state}
              flags={flags}
              settings={settings}
              onSelect={(i) => playing && actions.select(i)}
              rippleOrigin={completed && !reduceMotion ? rippleOrigin : null}
            />
            <AnimatePresence>
              {paused && <PauseOverlay onResume={actions.resume} ranked={game.serverBacked} state={state} />}
            </AnimatePresence>
          </div>
        </div>

        {/* Controls: anchored low, within thumb reach. */}
        <div className="flex w-full flex-col gap-3 lg:max-w-[360px]">
          <Toolbar
            canUndo={state.past.length > 0}
            canRedo={state.future.length > 0}
            notesMode={state.notesMode}
            disabled={!playing}
            hintBusy={hintBusy}
            onUndo={actions.undo}
            onRedo={actions.redo}
            onErase={actions.erase}
            onToggleNotes={actions.toggleNotes}
            onHint={() => void runHint()}
          />
          <NumberPad kind="value" counts={counts} disabled={!playing} onDigit={withCell(actions.place)} />
          {state.notesMode && (
            <NumberPad kind="note" counts={counts} disabled={!playing} onDigit={withCell(actions.note)} />
          )}
          {completed && !completionOpen && (
            <Button variant="tinted" onClick={() => setCompletionOpen(true)}>
              <Trophy /> View result
            </Button>
          )}
          {game.roomCode && (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/multiplayer/${game.roomCode}`}>
                <Users /> Room standings
              </Link>
            </Button>
          )}
        </div>
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <CompletionDialog
        open={completionOpen}
        onOpenChange={setCompletionOpen}
        game={game}
        state={state}
        result={result}
        syncStatus={syncStatus}
        onRetry={retryVerification}
        onNewGame={newGame}
      />

      <Dialog open={hintConfirm} onOpenChange={setHintConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Use a hint?</DialogTitle>
            <DialogDescription>
              Hints are recorded by the server. This game will still count toward your streak and stats, but it
              won&apos;t be ranked on the leaderboard.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setHintConfirm(false)}>
              Keep playing
            </Button>
            <Button
              onClick={() => {
                setHintConfirm(false);
                void runHint(true);
              }}
            >
              Use hint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={restartConfirm} onOpenChange={setRestartConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Restart this puzzle?</DialogTitle>
            <DialogDescription>
              Your entries and notes will be cleared. The timer, mistakes and hints keep counting.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRestartConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setRestartConfirm(false);
                actions.restart();
              }}
            >
              Restart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function titleFor(game: LocalGame) {
  if (game.mode === "daily" && game.dailyKey) return "Daily Challenge";
  if (game.mode === "room" && game.roomCode) return `Room ${game.roomCode}`;
  return DIFFICULTY_LABEL[game.difficulty];
}

function subtitleFor(game: LocalGame, ranked: boolean) {
  const d = DIFFICULTY_LABEL[game.difficulty];
  if (game.mode === "daily" && game.dailyKey) return `${formatDateKey(game.dailyKey, { month: "short", day: "numeric" })} · ${d}`;
  if (game.mode === "room") return `${d} · Ranked`;
  if (!game.serverBacked) return "Offline game";
  return ranked ? "Ranked" : "Classic";
}

function Stat({
  label,
  value,
  tone,
  align = "start",
}: {
  label: string;
  value: number;
  tone?: "error";
  align?: "start" | "end";
}) {
  return (
    <div className={cn("flex flex-col leading-none", align === "end" ? "items-end" : "items-start")}>
      <span className="type-caption text-muted-foreground">{label}</span>
      <span className={cn("mt-1 type-headline tabular-nums", tone === "error" && "text-destructive")}>{value}</span>
    </div>
  );
}

function PauseOverlay({ onResume, ranked, state }: { onResume: () => void; ranked: boolean; state: GameState }) {
  return (
    <motion.div
      // Opaque on purpose: pausing must hide the board.
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ type: "spring", bounce: 0, duration: 0.3 }}
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 rounded-[22px] bg-board"
    >
      <span className="mb-3 flex size-14 items-center justify-center rounded-full bg-accent text-tint">
        <Pause className="size-6 fill-current" />
      </span>
      <p className="type-title2">Paused</p>
      <p className="type-subhead text-muted-foreground tabular-nums">{formatDuration(state.elapsedMs)}</p>
      {ranked && (
        <p className="mt-2 max-w-64 text-center type-footnote text-muted-foreground">
          Leaderboard time is measured by the server and keeps running while paused.
        </p>
      )}
      <Button onClick={onResume} className="mt-5 rounded-full px-10" autoFocus>
        <Play className="fill-current" /> Resume
      </Button>
    </motion.div>
  );
}
