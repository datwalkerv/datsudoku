import "server-only";
import { ObjectId, type ClientSession } from "mongodb";
import { collections, type GameResultDoc } from "@/lib/db/collections";
import { advanceStreak } from "./rules";

export async function recordStats(
  userId: string,
  result: Pick<GameResultDoc, "difficulty" | "timeMs" | "hintsUsed" | "mistakes">,
  streakDateKey: string | null,
  session?: ClientSession,
) {
  const stats = collections.stats();
  const current = await stats.findOne({ userId }, { session });
  const streak = current?.dailyStreak ?? { current: 0, best: 0, lastDateKey: null };
  const nextStreak = streakDateKey ? advanceStreak(streak, streakDateKey) : streak;
  await stats.updateOne(
    { userId },
    {
      $inc: {
        [`completed.${result.difficulty}`]: 1,
        [`totalTimeMs.${result.difficulty}`]: result.timeMs,
        hintsUsed: result.hintsUsed,
        mistakes: result.mistakes,
      },
      $set: { dailyStreak: nextStreak, updatedAt: new Date() },
      $setOnInsert: { _id: new ObjectId(), userId },
    } as never,
    { upsert: true, session },
  );
}

/** Stores the result as the personal best when it beats the previous one. */
export async function updatePersonalBest(result: GameResultDoc, session?: ClientSession): Promise<boolean> {
  const pbs = collections.personalBests();
  const key = { userId: result.userId, mode: result.mode, difficulty: result.difficulty };
  const previous = await pbs.findOne(key, { session });
  const better =
    !previous ||
    result.timeMs < previous.timeMs ||
    (result.timeMs === previous.timeMs && result.mistakes < previous.mistakes);
  if (!better) return false;
  await pbs.updateOne(
    key,
    {
      $set: { resultId: result._id, timeMs: result.timeMs, mistakes: result.mistakes, completedAt: result.completedAt },
      $setOnInsert: { _id: new ObjectId(), ...key },
    },
    { upsert: true, session },
  );
  return true;
}
