import "server-only";
import { ObjectId } from "mongodb";
import { collections, isDuplicateKeyError, type DailyChallengeDoc, type GameDoc } from "@/lib/db/collections";
import { acquirePuzzle } from "@/lib/puzzles/acquire";
import { dailyDifficulty, displayStreak } from "@/lib/games/rules";
import { newGameDoc, toGameDTO } from "@/lib/games/service";
import { HttpError } from "@/lib/errors";
import type { SessionUser } from "@/lib/auth";
import type { DailyStatus } from "./types";

/**
 * Returns the single puzzle assigned to a UTC date, creating the assignment
 * on first request. Concurrent first requests all resolve to the record that
 * won the upsert; a losing request's freshly fetched puzzle simply stays in
 * the database unused.
 */
export async function getOrCreateDaily(
  dateKey: string,
  acquire: typeof acquirePuzzle = acquirePuzzle,
): Promise<DailyChallengeDoc> {
  const daily = collections.daily();
  const existing = await daily.findOne({ dateKey });
  if (existing) return existing;

  const difficulty = dailyDifficulty(dateKey);
  const { puzzle } = await acquire({ difficulty, usage: "daily" });

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const doc = await daily.findOneAndUpdate(
        { dateKey },
        { $setOnInsert: { _id: new ObjectId(), dateKey, puzzleId: puzzle._id, difficulty, createdAt: new Date() } },
        { upsert: true, returnDocument: "after" },
      );
      if (doc) return doc;
    } catch (error) {
      // Two concurrent upserts on a unique key: one fails, and a re-read finds the winner.
      if (!isDuplicateKeyError(error)) throw error;
    }
    const winner = await daily.findOne({ dateKey });
    if (winner) return winner;
  }
  throw new Error(`Could not assign a daily challenge for ${dateKey}`);
}

/** Starts or resumes the user's single game for the given date. */
export async function startDailyGame(user: SessionUser, dateKey: string) {
  const challenge = await getOrCreateDaily(dateKey);
  const games = collections.games();
  const existing = await games.findOne({ userId: user.id, mode: "daily", dailyKey: dateKey });
  if (existing) return withResult(existing);

  const puzzle = await collections.puzzles().findOne({ _id: challenge.puzzleId });
  if (!puzzle) throw new HttpError(500, "puzzle_missing", "Daily puzzle record is missing");
  const doc = newGameDoc(user.id, puzzle, { mode: "daily", dailyKey: dateKey });
  try {
    await games.insertOne(doc);
    return toGameDTO(doc);
  } catch (error) {
    // A duplicate request raced us; return the game it created.
    if (!isDuplicateKeyError(error)) throw error;
    const winner = await games.findOne({ userId: user.id, mode: "daily", dailyKey: dateKey });
    if (!winner) throw error;
    return withResult(winner);
  }
}

async function withResult(game: GameDoc) {
  const result = game.status === "completed" ? await collections.results().findOne({ gameId: game._id }) : null;
  return toGameDTO(game, result);
}

export async function getDailyStatus(user: SessionUser | null, dateKey: string): Promise<DailyStatus> {
  const challenge = await getOrCreateDaily(dateKey);
  const [game, participants, stats] = await Promise.all([
    user
      ? collections.games().findOne({ userId: user.id, mode: "daily", dailyKey: dateKey }, { projection: { moves: 0, notes: 0 } })
      : null,
    collections.results().countDocuments({ mode: "daily", dailyKey: dateKey }),
    user ? collections.stats().findOne({ userId: user.id }, { projection: { dailyStreak: 1 } }) : null,
  ]);
  const result = game?.status === "completed" ? await collections.results().findOne({ gameId: game._id }) : null;
  return {
    dateKey,
    difficulty: challenge.difficulty,
    game: game
      ? { id: game._id.toHexString(), status: game.status, filled: [...game.board].filter((c) => c !== "0").length }
      : null,
    result: result ? { timeMs: result.timeMs, ranked: result.eligible.ranked, reason: result.eligible.reason } : null,
    participants,
    streak: stats?.dailyStreak ? displayStreak(stats.dailyStreak, dateKey) : 0,
  };
}
