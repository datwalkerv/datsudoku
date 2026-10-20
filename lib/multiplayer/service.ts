import "server-only";
import { randomInt } from "node:crypto";
import { ObjectId } from "mongodb";
import { collections, isDuplicateKeyError, type GameDoc, type RoomDoc, type RoomRound } from "@/lib/db/collections";
import { acquirePuzzle } from "@/lib/puzzles/acquire";
import { newGameDoc, toGameDTO } from "@/lib/games/service";
import { HttpError } from "@/lib/errors";
import { ROOM_CODE_ALPHABET } from "@/lib/validation/schemas";
import { countFilled, parseGrid } from "@/lib/sudoku/board";
import type { Difficulty } from "@/lib/sudoku/types";
import type { SessionUser } from "@/lib/auth";
import type { RoomDTO } from "./types";

export const ROOM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
  return code;
}

function displayName(user: SessionUser) {
  return user.isAnonymous ? "Guest" : user.name || "Player";
}

async function newRound(round: number, difficulty: Difficulty): Promise<RoomRound> {
  // Room puzzles are fresh and reserved: nobody can have practised them in Classic.
  const { puzzle } = await acquirePuzzle({ difficulty, usage: "room" });
  return { round, seed: puzzle.seed, puzzleId: puzzle._id, difficulty, startedAt: new Date() };
}

export async function createRoom(user: SessionUser, difficulty: Difficulty, maxPlayers: number): Promise<RoomDoc> {
  const first = await newRound(0, difficulty);
  const now = new Date();
  for (let attempt = 0; attempt < 5; attempt++) {
    const room: RoomDoc = {
      _id: new ObjectId(),
      code: generateRoomCode(),
      hostUserId: user.id,
      participants: [{ userId: user.id, name: displayName(user), joinedAt: now }],
      rounds: [first],
      currentRound: 0,
      status: "open",
      settings: { difficulty, maxPlayers },
      createdAt: now,
      expiresAt: new Date(now.getTime() + ROOM_TTL_MS),
    };
    try {
      await collections.rooms().insertOne(room);
      return room;
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error; // code collision: try another
    }
  }
  throw new Error("Could not allocate a room code");
}

export async function findRoom(code: string): Promise<RoomDoc> {
  const room = await collections.rooms().findOne({ code });
  if (!room || room.expiresAt.getTime() < Date.now()) throw new HttpError(404, "room_not_found", "Room not found or expired");
  return room;
}

/**
 * Joins a room (idempotent) and returns the player's game for the current
 * round, creating it from the round's stored puzzle if needed. Joining never
 * acquires a new puzzle.
 */
export async function joinRoom(user: SessionUser, code: string) {
  let room = await findRoom(code);
  const isMember = room.participants.some((p) => p.userId === user.id);
  if (!isMember) {
    if (room.status !== "open") throw new HttpError(409, "room_closed", "This room is closed");
    const updated = await collections.rooms().findOneAndUpdate(
      {
        _id: room._id,
        "participants.userId": { $ne: user.id },
        [`participants.${room.settings.maxPlayers - 1}`]: { $exists: false },
      },
      { $push: { participants: { userId: user.id, name: displayName(user), joinedAt: new Date() } } },
      { returnDocument: "after" },
    );
    if (!updated) {
      room = await findRoom(code);
      if (!room.participants.some((p) => p.userId === user.id)) throw new HttpError(409, "room_full", "This room is full");
    } else {
      room = updated;
    }
  }
  const game = await ensureRoomGame(user, room);
  return { room, game };
}

async function ensureRoomGame(user: SessionUser, room: RoomDoc) {
  const round = room.rounds[room.currentRound];
  const games = collections.games();
  const filter = { mode: "room" as const, roomId: room._id, round: round.round, userId: user.id };
  const existing = await games.findOne(filter);
  if (existing) return withResult(existing);
  const puzzle = await collections.puzzles().findOne({ _id: round.puzzleId });
  if (!puzzle) throw new HttpError(500, "puzzle_missing", "Room puzzle record is missing");
  const doc = newGameDoc(user.id, puzzle, { mode: "room", roomId: room._id, roomCode: room.code, round: round.round });
  try {
    await games.insertOne(doc);
    return toGameDTO(doc);
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const winner = await games.findOne(filter);
    if (!winner) throw error;
    return withResult(winner);
  }
}

async function withResult(game: GameDoc) {
  const result = game.status === "completed" ? await collections.results().findOne({ gameId: game._id }) : null;
  return toGameDTO(game, result);
}

/** Host starts a new round with a new seeded puzzle. Double submits are idempotent. */
export async function startRematch(user: SessionUser, code: string, expectedRound: number) {
  const room = await findRoom(code);
  if (room.hostUserId !== user.id) throw new HttpError(403, "not_host", "Only the host can start a rematch");
  if (room.currentRound !== expectedRound) return room; // someone already advanced it
  const round = await newRound(expectedRound + 1, room.settings.difficulty);
  const updated = await collections.rooms().findOneAndUpdate(
    { _id: room._id, currentRound: expectedRound },
    {
      $push: { rounds: round },
      $set: { currentRound: round.round, expiresAt: new Date(Date.now() + ROOM_TTL_MS) },
    },
    { returnDocument: "after" },
  );
  return updated ?? (await findRoom(code));
}

/** Room snapshot for polling: participants, progress and verified results. */
export async function getRoomView(user: SessionUser | null, code: string): Promise<RoomDTO> {
  const room = await findRoom(code);
  const round = room.rounds[room.currentRound];
  const [games, results] = await Promise.all([
    collections
      .games()
      .find({ mode: "room", roomId: room._id, round: round.round }, { projection: { userId: 1, board: 1, givens: 1, status: 1, mistakes: 1 } })
      .toArray(),
    collections
      .results()
      .find({ roomId: room._id, round: round.round })
      .sort({ timeMs: 1, mistakes: 1, completedAt: 1, _id: 1 })
      .toArray(),
  ]);
  const gameByUser = new Map(games.map((g) => [g.userId, g]));
  const resultByUser = new Map(results.map((r) => [r.userId, r]));
  const isMember = user ? room.participants.some((p) => p.userId === user.id) : false;

  return {
    code: room.code,
    status: room.status,
    difficulty: room.settings.difficulty,
    maxPlayers: room.settings.maxPlayers,
    round: round.round,
    seed: round.seed,
    roundStartedAt: round.startedAt.toISOString(),
    isHost: user?.id === room.hostUserId,
    isMember,
    expiresAt: room.expiresAt.toISOString(),
    participants: room.participants.map((p) => {
      const g = gameByUser.get(p.userId);
      const r = resultByUser.get(p.userId);
      const empty = g ? 81 - countFilled(parseGrid(g.givens)) : 81;
      const filled = g ? countFilled(parseGrid(g.board)) - (81 - empty) : 0;
      return {
        name: p.name,
        isYou: p.userId === user?.id,
        isHost: p.userId === room.hostUserId,
        progress: g ? Math.round((filled / Math.max(1, empty)) * 100) : 0,
        status: r ? "finished" : g ? "playing" : "joined",
        result: r
          ? { timeMs: r.timeMs, mistakes: r.mistakes, hintsUsed: r.hintsUsed, rank: results.indexOf(r) + 1 }
          : null,
      };
    }),
    previousRounds: room.rounds.slice(0, -1).map((r) => ({ round: r.round, seed: r.seed })),
  };
}

export async function listMyRooms(userId: string) {
  const rooms = await collections
    .rooms()
    .find({ "participants.userId": userId, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();
  return rooms.map((r) => ({
    code: r.code,
    difficulty: r.settings.difficulty,
    players: r.participants.length,
    round: r.currentRound,
    isHost: r.hostUserId === userId,
    createdAt: r.createdAt.toISOString(),
  }));
}
