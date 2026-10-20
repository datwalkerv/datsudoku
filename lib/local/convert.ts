import { parseGrid, serializeGrid } from "@/lib/sudoku/board";
import { solve } from "@/lib/sudoku/solver";
import type { GameState } from "@/lib/sudoku/engine";
import type { GameDTO } from "@/lib/games/types";
import type { LocalGame, StoredState } from "./db";

/** Builds a fresh local record from a server game. */
export function fromServer(game: GameDTO, ownerId: string | null): LocalGame {
  return {
    id: game.id,
    serverBacked: true,
    mode: game.mode,
    difficulty: game.difficulty,
    seed: game.seed,
    source: game.source,
    givens: game.givens,
    state: {
      values: parseGrid(game.board),
      notes: game.notes.slice(),
      mistakes: game.mistakes,
      hintsUsed: game.hintsUsed,
      moves: game.moves,
      past: [],
      future: [],
      elapsedMs: game.elapsedSeconds * 1000,
      status: game.status === "completed" ? "completed" : "playing",
      selected: null,
      notesMode: false,
    },
    baseVersion: game.version,
    dirty: false,
    pendingComplete: false,
    result: game.result,
    dailyKey: game.dailyKey,
    roomCode: game.roomCode,
    round: game.round,
    ownerId,
    startedAt: Date.parse(game.startedAt),
    updatedAt: Date.parse(game.updatedAt),
  };
}

export type ConflictWinner = "server" | "local";

/**
 * Decides which copy survives when the server has a version this device
 * has not seen. Completed server games always win; otherwise the copy with
 * more play time wins (it reflects the most recent progress by the same
 * player), and ties go to the server.
 */
export function resolveConflict(local: LocalGame, server: GameDTO): ConflictWinner {
  if (server.status === "completed") return "server";
  if (local.pendingComplete) return "local";
  return local.state.elapsedMs > server.elapsedSeconds * 1000 ? "local" : "server";
}

/**
 * Combines a locally stored game with the latest server copy.
 * - No local copy, or a clean local copy behind the server: take the server.
 * - Local copy at or ahead of the server version: keep local.
 * - Both changed: resolve and keep the losing state as a snapshot.
 */
export function mergeWithServer(local: LocalGame | undefined, server: GameDTO, ownerId: string | null): LocalGame {
  if (!local) return fromServer(server, ownerId);
  if (server.version <= local.baseVersion) {
    // Local is current; pick up a server result if one exists.
    return server.result && !local.result ? { ...local, result: server.result, pendingComplete: false } : local;
  }
  if (!local.dirty && !local.pendingComplete) return fromServer(server, ownerId);

  const winner = resolveConflict(local, server);
  if (winner === "server") {
    return { ...fromServer(server, ownerId), conflictSnapshot: local.state };
  }
  // Keep local progress, rebased on the server's version so the next save is accepted.
  return {
    ...local,
    baseVersion: server.version,
    dirty: true,
    conflictSnapshot: fromServer(server, ownerId).state,
  };
}

export function toStoredState(state: GameState): StoredState {
  return {
    values: state.values,
    notes: state.notes,
    mistakes: state.mistakes,
    hintsUsed: state.hintsUsed,
    moves: state.moves,
    past: state.past,
    future: state.future,
    elapsedMs: state.elapsedMs,
    // A reopened game resumes paused rather than with the clock running.
    status: state.status,
    selected: state.selected,
    notesMode: state.notesMode,
  };
}

/** Rehydrates the engine state; the solution is solved locally from the givens. */
export function toEngineState(game: LocalGame): GameState {
  const givens = parseGrid(game.givens);
  return {
    givens,
    values: game.state.values.slice(),
    notes: game.state.notes.slice(),
    solution: solve(givens),
    selected: game.state.selected,
    notesMode: game.state.notesMode,
    mistakes: game.state.mistakes,
    hintsUsed: game.state.hintsUsed,
    past: game.state.past,
    future: game.state.future,
    moves: game.state.moves,
    elapsedMs: game.state.elapsedMs,
    status: game.state.status,
  };
}

export function boardOf(game: LocalGame): string {
  return serializeGrid(game.state.values);
}
