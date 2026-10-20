"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as engine from "@/lib/sudoku/engine";
import type { GameState } from "@/lib/sudoku/engine";
import { serializeGrid } from "@/lib/sudoku/board";
import { toEngineState, toStoredState } from "@/lib/local/convert";
import { getLocalGame, putLocalGame, type LocalGame } from "@/lib/local/db";
import { sync, type SyncStatus } from "@/lib/client/sync";
import { api, ApiError } from "@/lib/client/api";
import { useSettings } from "@/lib/client/settings";
import { haptic, playClick } from "@/lib/client/feedback";
import type { ResultDTO } from "@/lib/games/types";

export type HintOutcome = "ok" | "needs-confirmation" | "offline" | "unavailable";

const RANKED_MODES = new Set(["daily", "room"]);

/**
 * Owns one game's engine state: input actions, the timer, local persistence
 * (IndexedDB on every change) and server sync (throttled, via the sync manager).
 */
export function useGame(initial: LocalGame) {
  const settings = useSettings();
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const meta = useRef(initial);
  const [state, setState] = useState<GameState>(() => {
    const s = toEngineState(initial);
    // Reopened games resume paused, so the clock never runs while away.
    return s.status === "playing" && s.elapsedMs > 0 ? { ...s, status: "paused" } : s;
  });
  const [result, setResult] = useState<ResultDTO | null>(initial.result);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(initial.dirty ? "local" : "synced");
  const [hintConsent, setHintConsent] = useState(initial.state.hintsUsed > 0);
  const isRanked = RANKED_MODES.has(initial.mode);

  /* ---------- Persistence ---------- */

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  // Seeded with the loaded state so opening a game does not count as a change.
  const lastPersisted = useRef<{ moves: number; notes: number[]; status: string } | null>({
    moves: state.moves.length,
    notes: state.notes,
    status: state.status,
  });
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(async (s: GameState, opts: { syncNow?: boolean } = {}) => {
    const prev = lastPersisted.current;
    const meaningful = !prev || prev.moves !== s.moves.length || prev.notes !== s.notes || prev.status !== s.status;
    lastPersisted.current = { moves: s.moves.length, notes: s.notes, status: s.status };
    const completedNow = s.status === "completed" && meta.current.state.status !== "completed";
    // The loader or sync manager may have advanced the stored version meanwhile.
    const stored = await getLocalGame(meta.current.id);
    const next: LocalGame = {
      ...meta.current,
      baseVersion: Math.max(meta.current.baseVersion, stored?.baseVersion ?? 0),
      result: meta.current.result ?? stored?.result ?? null,
      state: toStoredState(s),
      updatedAt: Date.now(),
      dirty: meta.current.dirty || meaningful,
      pendingComplete: meta.current.pendingComplete || (completedNow && meta.current.serverBacked && !meta.current.result),
    };
    meta.current = next;
    await putLocalGame(next);
    if (!next.serverBacked) return;
    if (opts.syncNow || completedNow) void sync.flush(next.id);
    else if (meaningful) sync.schedule(next.id);
  }, []);

  // Write every change locally (coalesced to one write per animation burst).
  useEffect(() => {
    if (writeTimer.current) clearTimeout(writeTimer.current);
    // Moves and notes are written at once; timer-only ticks are coalesced.
    const prev = lastPersisted.current;
    const moved = !prev || prev.moves !== state.moves.length || prev.notes !== state.notes || state.status === "completed";
    writeTimer.current = setTimeout(() => void persist(state), moved ? 0 : 200);
    return () => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
    };
  }, [state, persist]);

  // Flush when the app is backgrounded or closed.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        setState((s) => engine.pause(s));
        void persist(engine.pause(stateRef.current), { syncNow: true });
      }
    };
    const onPageHide = () => void persist(stateRef.current, { syncNow: true });
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [persist]);

  // Server confirmations and conflict resolutions for this game.
  useEffect(() => {
    return sync.subscribe((id, status, game) => {
      if (id !== meta.current.id) return;
      setSyncStatus(status);
      if (!game) return;
      if (game.result) setResult(game.result);
      // A conflict resolved in favour of the server replaces the board.
      if (game.baseVersion !== meta.current.baseVersion || game.result !== meta.current.result) {
        const replacedByServer = game.conflictSnapshot && !game.dirty && meta.current.dirty;
        meta.current = { ...game, dirty: game.dirty, pendingComplete: game.pendingComplete };
        if (replacedByServer) setState(toEngineState(game));
      }
    });
  }, []);

  /* ---------- Timer ---------- */

  useEffect(() => {
    if (state.status !== "playing") return;
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const delta = now - last;
      last = now;
      setState((s) => engine.tick(s, delta));
    }, 1000);
    return () => clearInterval(id);
  }, [state.status]);

  /* ---------- Actions ---------- */

  const feedback = useCallback((before: GameState, after: GameState) => {
    const { sound, haptics } = settingsRef.current;
    if (after === before) return;
    if (after.status === "completed" && before.status !== "completed") {
      if (sound) playClick("complete");
      if (haptics) haptic(20);
    } else if (after.mistakes > before.mistakes) {
      if (sound) playClick("error");
      if (haptics) haptic(15);
    } else if (sound) {
      playClick("place");
    }
  }, []);

  const apply = useCallback(
    (fn: (s: GameState) => GameState) => {
      setState((s) => {
        const next = fn(s);
        if (next !== s) feedback(s, next);
        return next;
      });
    },
    [feedback],
  );

  const opts = () => ({ autoCleanup: settingsRef.current.autoCleanup });

  const actions = useMemo(
    () => ({
      select: (i: number | null) => setState((s) => engine.select(s, i)),
      move: (dir: engine.Direction) => setState((s) => engine.select(s, engine.moveSelection(s.selected, dir))),
      input: (d: number) => apply((s) => engine.input(s, d, opts())),
      /** Number pad: always a value, even while the notes row is open. */
      place: (d: number) => apply((s) => engine.setValue(s, d, opts())),
      /** Notes row, or Shift/Alt + digit: always a note. */
      note: (d: number) => apply((s) => engine.toggleNote(s, d)),
      erase: () => apply((s) => engine.erase(s)),
      undo: () => apply(engine.undo),
      redo: () => apply(engine.redo),
      toggleNotes: () => setState(engine.toggleNotesMode),
      fillCandidates: () => apply(engine.fillCandidates),
      pause: () => {
        setState(engine.pause);
        void persist(engine.pause(stateRef.current), { syncNow: true });
      },
      resume: () => setState(engine.resume),
      restart: () => apply(engine.restart),
    }),
    [apply, persist],
  );

  /**
   * Hints: Classic computes them locally (works offline). Daily and room
   * games ask the server, which records the hint and makes the game unranked.
   */
  const hint = useCallback(
    async (confirmed = false): Promise<HintOutcome> => {
      const s = stateRef.current;
      if (s.status !== "playing") return "unavailable";
      if (isRanked && !hintConsent && !confirmed) return "needs-confirmation";
      if (confirmed) setHintConsent(true);
      if (!isRanked || !meta.current.serverBacked) {
        const h = engine.findHint(s);
        if (!h) return "unavailable";
        apply((cur) => engine.applyHint(cur, h, opts()));
        return "ok";
      }
      try {
        const { hint: h } = await api.hint(meta.current.id, serializeGrid(s.values), s.selected);
        apply((cur) => engine.applyHint(cur, h, opts()));
        return "ok";
      } catch (error) {
        if (error instanceof ApiError && error.status === 0) return "offline";
        return "unavailable";
      }
    },
    [apply, hintConsent, isRanked],
  );

  const retryVerification = useCallback(() => void sync.flush(meta.current.id), []);

  return {
    state,
    actions,
    hint,
    result,
    syncStatus,
    isRanked,
    retryVerification,
  };
}
