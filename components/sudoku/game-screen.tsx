"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { toast } from "sonner";
import { MoreHorizontal, Pause, Play, RotateCcw, Sparkles, Plus, Settings2, Trophy, Users } from "lucide-react";
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

  const onDigit = useCallback(
    (d: number) => {
      if (state.selected === null) {
        setAnnouncement("Select a cell first.");
        return;
      }
      actions.input(d);
    },
    [actions, state.selected],
  );

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

  const title = titleFor(game);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col safe-px safe-pb lg:max-w-5xl">
      <PageHeader
        title={title}
        subtitle={isRanked ? "Ranked · server timed" : game.serverBacked ? undefined : "Offline game"}
        backHref={game.roomCode ? `/multiplayer/${game.roomCode}` : "/"}
        backLabel={game.roomCode ? "Room" : "Home"}
        trailing={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Game menu" className="text-tint">
                <MoreHorizontal className="size-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
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

      <div className="flex flex-1 flex-col justify-between gap-4 pb-2 lg:flex-row lg:items-center lg:justify-center lg:gap-10">
        {/* Board column */}
        <div className="flex w-full flex-col gap-3 lg:max-w-[560px]">
          <div className="flex items-center justify-between px-1 text-[13px] text-muted-foreground tabular-nums">
            <span className="flex items-center gap-3">
              <span>
                Mistakes <span className="text-foreground">{state.mistakes}</span>
              </span>
              {state.hintsUsed > 0 && (
                <span>
                  Hints <span className="text-foreground">{state.hintsUsed}</span>
                </span>
              )}
            </span>
            <span className="flex items-center gap-2">
              <SyncBadge status={game.serverBacked ? syncStatus : "device"} />
              {settings.showTimer && <Timer ms={state.elapsedMs} />}
              <button
                type="button"
                onClick={paused ? actions.resume : actions.pause}
                disabled={completed}
                aria-label={paused ? "Resume timer" : "Pause timer"}
                className="-mr-1 inline-flex size-8 items-center justify-center rounded-full text-foreground hover:bg-secondary disabled:opacity-40"
              >
                {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
              </button>
            </span>
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

        {/* Controls column */}
        <div className="flex w-full flex-col gap-3 lg:max-w-[340px]">
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
          <NumberPad counts={counts} notesMode={state.notesMode} disabled={!playing} onDigit={onDigit} />
          {completed && !completionOpen && (
            <Button variant="secondary" className="h-11 rounded-xl" onClick={() => setCompletionOpen(true)}>
              <Trophy className="size-4" /> View result
            </Button>
          )}
          {game.roomCode && (
            <Button asChild variant="ghost" className="h-10 text-tint">
              <Link href={`/multiplayer/${game.roomCode}`}>
                <Users className="size-4" /> Room standings
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
            <Button variant="ghost" onClick={() => setHintConfirm(false)}>
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
            <Button variant="ghost" onClick={() => setRestartConfirm(false)}>
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
  const d = DIFFICULTY_LABEL[game.difficulty];
  if (game.mode === "daily" && game.dailyKey) return `Daily · ${formatDateKey(game.dailyKey, { month: "short", day: "numeric" })}`;
  if (game.mode === "room" && game.roomCode) return `Room ${game.roomCode} · ${d}`;
  return `Classic · ${d}`;
}

function Timer({ ms }: { ms: number }) {
  return (
    <span className="min-w-[3.25rem] text-right font-medium text-foreground tabular-nums" aria-label={`Time ${formatDuration(ms)}`}>
      {formatDuration(ms)}
    </span>
  );
}

function PauseOverlay({ onResume, ranked, state }: { onResume: () => void; ranked: boolean; state: GameState }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-[10px] bg-board"
    >
      <p className="text-[15px] font-medium">Paused</p>
      <p className="text-sm text-muted-foreground tabular-nums">{formatDuration(state.elapsedMs)}</p>
      {ranked && (
        <p className="max-w-60 text-center text-xs text-muted-foreground">
          Ranked time is measured by the server and keeps running while paused.
        </p>
      )}
      <Button onClick={onResume} className="h-11 rounded-full px-8" autoFocus>
        <Play className="size-4" /> Resume
      </Button>
    </motion.div>
  );
}
