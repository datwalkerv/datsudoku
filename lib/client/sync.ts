"use client";

import { api, ApiError } from "./api";
import { getLocalGame, pendingSync, putLocalGame, type LocalGame } from "@/lib/local/db";
import { boardOf, mergeWithServer } from "@/lib/local/convert";
import type { GameDTO } from "@/lib/games/types";

/**
 * Local-first synchronization.
 *
 * Every change is written to IndexedDB immediately by the game screen.
 * This manager pushes dirty games to the server (debounced), submits
 * completions, retries transient failures with backoff, and resolves
 * version conflicts without letting stale state overwrite newer state.
 */

export type SyncStatus = "local" | "syncing" | "synced" | "offline" | "error";

type Listener = (id: string, status: SyncStatus, game?: LocalGame) => void;

const SAVE_DELAY_MS = 3000;
const MAX_BACKOFF_MS = 60_000;

class SyncManager {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private inflight = new Map<string, Promise<void>>();
  private failures = new Map<string, number>();
  private listeners = new Set<Listener>();
  private started = false;

  start() {
    if (this.started || typeof window === "undefined") return;
    this.started = true;
    window.addEventListener("online", () => void this.flushAll());
    void this.flushAll();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(id: string, status: SyncStatus, game?: LocalGame) {
    for (const l of this.listeners) l(id, status, game);
  }

  /**
   * Queues a save after a local change. A pending save is not pushed back by
   * further changes, so continuous play still syncs every few seconds.
   */
  schedule(id: string, delay = SAVE_DELAY_MS, { reset = false } = {}) {
    this.emit(id, "local");
    if (this.timers.has(id) && !reset) return;
    clearTimeout(this.timers.get(id));
    this.timers.set(
      id,
      setTimeout(() => void this.flush(id), delay),
    );
  }

  /** Pushes one game now. Concurrent calls for the same game are coalesced. */
  flush(id: string): Promise<void> {
    clearTimeout(this.timers.get(id));
    this.timers.delete(id);
    const running = this.inflight.get(id);
    if (running) return running.then(() => this.flush(id));
    const task = this.push(id).finally(() => this.inflight.delete(id));
    this.inflight.set(id, task);
    return task;
  }

  async flushAll() {
    const games = await pendingSync().catch(() => []);
    await Promise.all(games.map((g) => this.flush(g.id)));
  }

  private async push(id: string) {
    const game = await getLocalGame(id);
    if (!game || !game.serverBacked || (!game.dirty && !game.pendingComplete)) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.emit(id, "offline", game);
      return;
    }
    this.emit(id, "syncing", game);
    try {
      if (game.pendingComplete) await this.submitCompletion(game);
      else await this.save(game);
      this.failures.delete(id);
    } catch (error) {
      await this.handleError(id, game, error);
    }
  }

  private async save(game: LocalGame) {
    const s = game.state;
    const { version } = await api.saveGame(game.id, {
      baseVersion: game.baseVersion,
      board: boardOf(game),
      notes: s.notes,
      moves: s.moves,
      mistakes: s.mistakes,
      hintsUsed: s.hintsUsed,
      elapsedSeconds: Math.floor(s.elapsedMs / 1000),
    });
    // Only clear `dirty` if nothing changed locally while the request was in flight.
    const latest = (await getLocalGame(game.id)) ?? game;
    const unchanged = latest.updatedAt === game.updatedAt;
    const next = { ...latest, baseVersion: version, dirty: unchanged ? false : latest.dirty };
    await putLocalGame(next);
    this.emit(game.id, unchanged ? "synced" : "local", next);
    if (!unchanged) this.schedule(game.id, 500, { reset: true });
  }

  private async submitCompletion(game: LocalGame) {
    const { result } = await api.complete(game.id, {
      board: boardOf(game),
      moves: game.state.moves,
      elapsedSeconds: Math.floor(game.state.elapsedMs / 1000),
      notes: game.state.notes,
    });
    const latest = (await getLocalGame(game.id)) ?? game;
    const next: LocalGame = { ...latest, result, pendingComplete: false, dirty: false };
    await putLocalGame(next);
    this.emit(game.id, "synced", next);
  }

  private async handleError(id: string, game: LocalGame, error: unknown) {
    if (error instanceof ApiError && error.status === 409 && error.body.game) {
      const merged = mergeWithServer(game, error.body.game as GameDTO, game.ownerId);
      await putLocalGame(merged);
      this.emit(id, merged.dirty || merged.pendingComplete ? "local" : "synced", merged);
      if (merged.dirty || merged.pendingComplete) this.schedule(id, 200, { reset: true });
      return;
    }
    if (error instanceof ApiError && !error.transient) {
      // 401/403/404/422: retrying the same request will not help.
      console.warn(`[sync] ${id}: ${error.code} ${error.message}`);
      this.emit(id, "error", game);
      return;
    }
    const attempts = (this.failures.get(id) ?? 0) + 1;
    this.failures.set(id, attempts);
    this.emit(id, error instanceof ApiError && error.status === 0 ? "offline" : "error", game);
    const backoff = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempts) + Math.random() * 500;
    this.schedule(id, backoff, { reset: true });
  }
}

export const sync = new SyncManager();
