"use client";

import { api, ApiError } from "./api";
import { fromServer } from "@/lib/local/convert";
import { getLocalGame, putLocalGame, type LocalGame } from "@/lib/local/db";
import { generatePuzzle } from "@/lib/sudoku/generator";
import { randomSeed } from "@/lib/sudoku/seeds";
import { serializeGrid } from "@/lib/sudoku/board";
import type { Difficulty } from "@/lib/sudoku/types";
import type { GameDTO } from "@/lib/games/types";

export interface Started {
  id: string;
  /** Set when the game could only be created on this device. */
  offline: boolean;
  /** Set when the server used its internal generator instead of YouDoSudoku. */
  fallbackReason: string | null;
}

/** Stores (or merges) a server game locally and returns its id. */
export async function adoptServerGame(game: GameDTO, ownerId: string | null): Promise<string> {
  const existing = await getLocalGame(game.id);
  if (!existing || (!existing.dirty && game.version >= existing.baseVersion)) {
    await putLocalGame(fromServer(game, ownerId));
  }
  return game.id;
}

/** Practice game generated on this device; it is never sent to the server. */
export async function createOfflineGame(difficulty: Difficulty): Promise<string> {
  const seed = randomSeed();
  const { puzzle } = generatePuzzle(seed, difficulty);
  const givens = serializeGrid(puzzle);
  const now = Date.now();
  const game: LocalGame = {
    id: `local-${seed}`,
    serverBacked: false,
    mode: "classic",
    difficulty,
    seed,
    source: "internal",
    givens,
    state: {
      values: puzzle.slice(),
      notes: new Array(81).fill(0),
      mistakes: 0,
      hintsUsed: 0,
      moves: [],
      past: [],
      future: [],
      elapsedMs: 0,
      status: "playing",
      selected: null,
      notesMode: false,
    },
    baseVersion: 0,
    dirty: false,
    pendingComplete: false,
    result: null,
    dailyKey: null,
    roomCode: null,
    round: null,
    ownerId: null,
    startedAt: now,
    updatedAt: now,
  };
  await putLocalGame(game);
  return game.id;
}

/**
 * Starts a Classic game: a verified puzzle stored on the server when online,
 * otherwise an offline practice game.
 */
export async function startClassic(difficulty: Difficulty, ownerId: string | null): Promise<Started> {
  const online = typeof navigator === "undefined" || navigator.onLine;
  if (online && ownerId) {
    try {
      const { game, fallbackReason } = await api.createGame(difficulty);
      return { id: await adoptServerGame(game, ownerId), offline: false, fallbackReason };
    } catch (error) {
      if (!(error instanceof ApiError) || !(error.transient || error.status === 401 || error.status === 503)) throw error;
    }
  }
  return { id: await createOfflineGame(difficulty), offline: true, fallbackReason: null };
}

export async function startDaily(ownerId: string | null): Promise<string> {
  const { game } = await api.startDaily();
  return adoptServerGame(game, ownerId);
}
