import "server-only";
import { ObjectId, type ClientSession } from "mongodb";
import { client } from "@/lib/db/mongodb";
import {
  collections,
  isDuplicateKeyError,
  type GameDoc,
  type GameResultDoc,
  type PuzzleDoc,
} from "@/lib/db/collections";
import { HttpError } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth";
import { acquirePuzzle } from "@/lib/puzzles/acquire";
import { parseGrid, countFilled } from "@/lib/sudoku/board";
import { createGame as createEngineGame, findHint } from "@/lib/sudoku/engine";
import { respectsGivens } from "@/lib/sudoku/validation";
import type { Difficulty, GameMode } from "@/lib/sudoku/types";
import { utcDateKey } from "@/lib/daily/date";
import { replayMoves } from "./replay";
import { ineligibility, rankedTime } from "./rules";
import { recordStats, updatePersonalBest } from "./records";
import type { GameDTO, GameSummaryDTO, ResultDTO } from "./types";
import type { CompleteGameInput, SaveGameInput } from "@/lib/validation/schemas";

/* ---------- Mapping ---------- */

export function toResultDTO(doc: GameResultDoc, personalBest?: boolean): ResultDTO {
  return {
    id: doc._id.toHexString(),
    gameId: doc.gameId.toHexString(),
    mode: doc.mode,
    difficulty: doc.difficulty,
    timeMs: doc.timeMs,
    mistakes: doc.mistakes,
    hintsUsed: doc.hintsUsed,
    ranked: doc.eligible.ranked,
    reason: (doc.eligible.reason as ResultDTO["reason"]) ?? null,
    completedAt: doc.completedAt.toISOString(),
    ...(personalBest !== undefined ? { personalBest } : {}),
  };
}

export function toGameDTO(doc: GameDoc, result: GameResultDoc | null = null): GameDTO {
  return {
    id: doc._id.toHexString(),
    mode: doc.mode,
    difficulty: doc.difficulty,
    seed: doc.seed,
    source: doc.source,
    givens: doc.givens,
    board: doc.board,
    notes: doc.notes,
    moves: doc.moves,
    mistakes: doc.mistakes,
    hintsUsed: Math.max(doc.hintsUsed, doc.serverHints),
    elapsedSeconds: doc.elapsedSeconds,
    status: doc.status,
    version: doc.version,
    startedAt: doc.startedAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    dailyKey: doc.dailyKey ?? null,
    roomCode: doc.roomCode ?? null,
    round: doc.round ?? null,
    result: result ? toResultDTO(result) : null,
  };
}

export function toSummaryDTO(doc: GameDoc): GameSummaryDTO {
  return {
    id: doc._id.toHexString(),
    mode: doc.mode,
    difficulty: doc.difficulty,
    status: doc.status,
    filled: countFilled(parseGrid(doc.board)),
    elapsedSeconds: doc.elapsedSeconds,
    updatedAt: doc.updatedAt.toISOString(),
    dailyKey: doc.dailyKey ?? null,
    roomCode: doc.roomCode ?? null,
  };
}

export function parseObjectId(id: string): ObjectId {
  if (!/^[a-f0-9]{24}$/i.test(id)) throw new HttpError(404, "not_found", "Game not found");
  return new ObjectId(id);
}

/* ---------- Creation ---------- */

export interface GameContext {
  mode: GameMode;
  dailyKey?: string;
  roomId?: ObjectId;
  roomCode?: string;
  round?: number;
}

export function newGameDoc(userId: string, puzzle: PuzzleDoc, ctx: GameContext): GameDoc {
  const now = new Date();
  return {
    _id: new ObjectId(),
    userId,
    puzzleId: puzzle._id,
    seed: puzzle.seed,
    source: puzzle.source,
    mode: ctx.mode,
    difficulty: puzzle.difficulty,
    ...(ctx.dailyKey ? { dailyKey: ctx.dailyKey } : {}),
    ...(ctx.roomId ? { roomId: ctx.roomId, roomCode: ctx.roomCode, round: ctx.round ?? 0 } : {}),
    givens: puzzle.puzzle,
    board: puzzle.puzzle,
    notes: new Array<number>(81).fill(0),
    moves: [],
    mistakes: 0,
    hintsUsed: 0,
    serverHints: 0,
    elapsedSeconds: 0,
    status: "active",
    version: 0,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
  };
}

export async function startClassicGame(user: SessionUser, difficulty: Difficulty) {
  const { puzzle, fallbackReason } = await acquirePuzzle({ difficulty, userId: user.id, usage: "pool" });
  const doc = newGameDoc(user.id, puzzle, { mode: "classic" });
  await collections.games().insertOne(doc);
  return { game: toGameDTO(doc), fallbackReason };
}

/* ---------- Reading ---------- */

export async function getOwnedGame(userId: string, id: string): Promise<GameDoc> {
  const doc = await collections.games().findOne({ _id: parseObjectId(id), userId });
  if (!doc) throw new HttpError(404, "not_found", "Game not found");
  return doc;
}

export async function getGameWithResult(userId: string, id: string): Promise<GameDTO> {
  const doc = await getOwnedGame(userId, id);
  const result = doc.status === "completed" ? await collections.results().findOne({ gameId: doc._id }) : null;
  return toGameDTO(doc, result);
}

export async function listGames(userId: string, status: "active" | "completed" | undefined, limit: number) {
  const docs = await collections
    .games()
    .find({ userId, ...(status ? { status } : {}) }, { projection: { moves: 0, notes: 0 } })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map(toSummaryDTO);
}

/* ---------- Saving (optimistic concurrency) ---------- */

export async function saveGame(userId: string, id: string, input: SaveGameInput) {
  const _id = parseObjectId(id);
  const current = await collections.games().findOne({ _id, userId }, { projection: { givens: 1 } });
  if (!current) throw new HttpError(404, "not_found", "Game not found");
  if (!respectsGivens(parseGrid(current.givens), parseGrid(input.board))) {
    throw new HttpError(400, "invalid_board", "Board does not match the puzzle's givens");
  }
  const now = new Date();
  const updated = await collections.games().findOneAndUpdate(
    { _id, userId, version: input.baseVersion, status: "active" },
    {
      $set: {
        board: input.board,
        notes: input.notes,
        moves: input.moves,
        mistakes: input.mistakes,
        hintsUsed: input.hintsUsed,
        elapsedSeconds: input.elapsedSeconds,
        updatedAt: now,
      },
      $inc: { version: 1 },
    },
    { returnDocument: "after", projection: { version: 1, updatedAt: 1 } },
  );
  if (updated) return { version: updated.version, updatedAt: updated.updatedAt.toISOString() };

  // Stale version or completed game: hand the newer server state back to the client.
  const latest = await getGameWithResult(userId, id);
  throw new HttpError(409, "conflict", "A newer version of this game exists", { game: latest });
}

/* ---------- Hints (server-recorded) ---------- */

export async function requestHint(userId: string, id: string, board: string, selected: number | null) {
  const game = await getOwnedGame(userId, id);
  if (game.status !== "active") throw new HttpError(409, "completed", "Game is already completed");
  if (!respectsGivens(parseGrid(game.givens), parseGrid(board))) {
    throw new HttpError(400, "invalid_board", "Board does not match the puzzle's givens");
  }
  const puzzle = await collections.puzzles().findOne({ _id: game.puzzleId }, { projection: { solution: 1 } });
  if (!puzzle) throw new HttpError(500, "puzzle_missing", "Puzzle record is missing");
  const state = { ...createEngineGame(game.givens), values: parseGrid(board), selected };
  const hint = findHint(state, parseGrid(puzzle.solution));
  if (!hint) throw new HttpError(409, "no_hint", "No hint available");
  await collections.games().updateOne({ _id: game._id, userId }, { $inc: { serverHints: 1 } });
  return hint;
}

/* ---------- Completion ---------- */

async function runTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = client.startSession();
  try {
    return await session.withTransaction(fn);
  } finally {
    await session.endSession();
  }
}

/**
 * Verifies a completed board against the stored solution, recomputes
 * mistakes and hints from the move log, and records exactly one result.
 * Repeated calls return the original result.
 */
export async function completeGame(user: SessionUser, id: string, input: CompleteGameInput): Promise<ResultDTO> {
  const game = await getOwnedGame(user.id, id);
  const existing = await collections.results().findOne({ gameId: game._id });
  if (existing) return toResultDTO(existing);

  const puzzle = await collections.puzzles().findOne({ _id: game.puzzleId });
  if (!puzzle) throw new HttpError(500, "puzzle_missing", "Puzzle record is missing");

  const givens = parseGrid(game.givens);
  const solution = parseGrid(puzzle.solution);
  const replay = replayMoves(givens, solution, input.moves, parseGrid(input.board));
  if (!replay.solved) throw new HttpError(422, "not_solved", "The board is not a correct solution");

  const now = new Date();
  const wallMs = now.getTime() - game.startedAt.getTime();
  const clientMs = input.elapsedSeconds * 1000;
  const timeMs = rankedTime(game.mode, wallMs, clientMs);
  const hints = Math.max(replay.hints, game.serverHints);
  const mistakes = replay.consistent ? replay.mistakes : game.mistakes;
  const completedDateKey = utcDateKey(now);
  const reason = ineligibility({
    mode: game.mode,
    isRegistered: !user.isAnonymous,
    hints,
    replayConsistent: replay.consistent,
    timeMs,
    emptyCells: 81 - countFilled(givens),
    dailyKey: game.dailyKey ?? null,
    completedDateKey,
  });

  const result: GameResultDoc = {
    _id: new ObjectId(),
    userId: user.id,
    gameId: game._id,
    puzzleId: game.puzzleId,
    mode: game.mode,
    difficulty: game.difficulty,
    roomId: game.roomId ?? null,
    round: game.round ?? null,
    dailyKey: game.dailyKey ?? null,
    timeMs,
    wallMs,
    clientMs,
    mistakes,
    hintsUsed: hints,
    completedAt: now,
    isRegistered: !user.isAnonymous,
    eligible: { ranked: reason === null, reason },
  };

  try {
    const personalBest = await runTransaction(async (session) => {
      await collections.results().insertOne(result, { session });
      await collections.games().updateOne(
        { _id: game._id },
        {
          $set: {
            status: "completed",
            board: input.board,
            moves: input.moves,
            ...(input.notes ? { notes: input.notes } : {}),
            elapsedSeconds: input.elapsedSeconds,
            mistakes,
            hintsUsed: hints,
            completedAt: now,
            updatedAt: now,
          },
          $inc: { version: 1 },
        },
        { session },
      );
      const streakEligible = game.mode === "daily" && game.dailyKey === completedDateKey;
      await recordStats(user.id, result, streakEligible ? game.dailyKey! : null, session);
      return result.eligible.ranked ? updatePersonalBest(result, session) : false;
    });
    return toResultDTO(result, personalBest);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const winner = await collections.results().findOne({ gameId: game._id });
      if (winner) return toResultDTO(winner);
    }
    throw error;
  }
}
