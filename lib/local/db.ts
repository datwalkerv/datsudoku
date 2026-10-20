"use client";

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Patch } from "@/lib/sudoku/engine";
import type { Difficulty, GameMode, Move, PuzzleSource } from "@/lib/sudoku/types";
import type { ResultDTO } from "@/lib/games/types";

/** The engine state that is persisted locally (solution is recomputed on load). */
export interface StoredState {
  values: number[];
  notes: number[];
  mistakes: number;
  hintsUsed: number;
  moves: Move[];
  past: Patch[];
  future: Patch[];
  elapsedMs: number;
  status: "playing" | "paused" | "completed";
  selected: number | null;
  notesMode: boolean;
}

export interface LocalGame {
  /** Server game id, or "local-…" for an offline-only practice game. */
  id: string;
  /** False for offline practice games that never reach the server. */
  serverBacked: boolean;
  mode: GameMode;
  difficulty: Difficulty;
  seed: string;
  source: PuzzleSource;
  givens: string;
  state: StoredState;
  /** Server version this local copy was last synced with. */
  baseVersion: number;
  /** Local changes not yet confirmed by the server. */
  dirty: boolean;
  /** Completion awaiting server verification. */
  pendingComplete: boolean;
  result: ResultDTO | null;
  dailyKey: string | null;
  roomCode: string | null;
  round: number | null;
  /** Account the game belongs to, so a shared device keeps games apart. */
  ownerId: string | null;
  startedAt: number;
  updatedAt: number;
  /** Losing copy of a sync conflict, kept so nothing is silently discarded. */
  conflictSnapshot?: StoredState;
}

interface SudokuDB extends DBSchema {
  games: {
    key: string;
    value: LocalGame;
    indexes: { "by-updated": number };
  };
}

let dbPromise: Promise<IDBPDatabase<SudokuDB>> | null = null;

export function localDb() {
  dbPromise ??= openDB<SudokuDB>("sudoku", 1, {
    upgrade(db) {
      const games = db.createObjectStore("games", { keyPath: "id" });
      games.createIndex("by-updated", "updatedAt");
    },
  });
  return dbPromise;
}

export async function getLocalGame(id: string): Promise<LocalGame | undefined> {
  return (await localDb()).get("games", id);
}

export async function putLocalGame(game: LocalGame): Promise<void> {
  await (await localDb()).put("games", game);
}

export async function deleteLocalGame(id: string): Promise<void> {
  await (await localDb()).delete("games", id);
}

/** Most recently updated games first. */
export async function listLocalGames(limit = 50): Promise<LocalGame[]> {
  const db = await localDb();
  const out: LocalGame[] = [];
  let cursor = await db.transaction("games").store.index("by-updated").openCursor(null, "prev");
  while (cursor && out.length < limit) {
    out.push(cursor.value);
    cursor = await cursor.continue();
  }
  return out;
}

/** The latest unfinished game for this owner (or any guest/offline game). */
export async function latestUnfinished(ownerId: string | null): Promise<LocalGame | undefined> {
  const games = await listLocalGames(100);
  return games.find(
    (g) => g.state.status !== "completed" && (g.ownerId === ownerId || g.ownerId === null || !g.serverBacked),
  );
}

/** Games with local changes or completions that still need the server. */
export async function pendingSync(): Promise<LocalGame[]> {
  const games = await listLocalGames(200);
  return games.filter((g) => g.serverBacked && (g.dirty || g.pendingComplete));
}
