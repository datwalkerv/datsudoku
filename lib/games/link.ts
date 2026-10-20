import "server-only";
import { collections, isDuplicateKeyError } from "@/lib/db/collections";
import { updatePersonalBest } from "./records";

/**
 * Moves a guest's (anonymous user's) games, results, rooms and stats to the
 * account they just registered or signed in to.
 *
 * Both ids come from Better Auth's session handling, so data can only move
 * from the guest session in the same browser. When the account already has a
 * game for the same daily date or room round, the account's game wins and the
 * guest's copy stays with the (soon deleted) guest id.
 */
export async function migrateGuestData(guestId: string, accountId: string, accountName: string) {
  if (guestId === accountId) return;
  const games = collections.games();
  const results = collections.results();

  const guestGames = await games.find({ userId: guestId }, { projection: { _id: 1 } }).toArray();
  for (const { _id } of guestGames) {
    try {
      await games.updateOne({ _id, userId: guestId }, { $set: { userId: accountId } });
    } catch (error) {
      if (isDuplicateKeyError(error)) continue;
      throw error;
    }
    const result = await results.findOne({ gameId: _id, userId: guestId });
    if (!result) continue;
    const nowRanked = result.eligible.reason === "guest";
    const eligible = nowRanked ? { ranked: true, reason: null } : result.eligible;
    await results.updateOne(
      { _id: result._id },
      { $set: { userId: accountId, isRegistered: true, eligible } },
    );
    if (nowRanked) {
      await updatePersonalBest({ ...result, userId: accountId, isRegistered: true, eligible });
    }
  }

  // Rooms: rename the participant entry, or drop it if the account already joined.
  const rooms = collections.rooms();
  await rooms.updateMany(
    { "participants.userId": { $all: [guestId, accountId] } },
    { $pull: { participants: { userId: guestId } } },
  );
  await rooms.updateMany(
    { "participants.userId": guestId },
    { $set: { "participants.$[p].userId": accountId, "participants.$[p].name": accountName } },
    { arrayFilters: [{ "p.userId": guestId }] },
  );
  await rooms.updateMany({ hostUserId: guestId }, { $set: { hostUserId: accountId } });

  await mergeStats(guestId, accountId);
}

async function mergeStats(guestId: string, accountId: string) {
  const stats = collections.stats();
  const guest = await stats.findOne({ userId: guestId });
  if (!guest) return;
  const account = await stats.findOne({ userId: accountId });
  const inc: Record<string, number> = { hintsUsed: guest.hintsUsed ?? 0, mistakes: guest.mistakes ?? 0 };
  for (const [d, n] of Object.entries(guest.completed ?? {})) inc[`completed.${d}`] = n ?? 0;
  for (const [d, n] of Object.entries(guest.totalTimeMs ?? {})) inc[`totalTimeMs.${d}`] = n ?? 0;

  const a = account?.dailyStreak;
  const g = guest.dailyStreak;
  // Keep whichever streak is more recent; ties keep the longer one.
  const streak =
    !a?.lastDateKey || (g.lastDateKey && (g.lastDateKey > a.lastDateKey || (g.lastDateKey === a.lastDateKey && g.current > a.current)))
      ? { ...g, best: Math.max(g.best, a?.best ?? 0) }
      : { ...a, best: Math.max(a.best, g.best) };

  await stats.updateOne(
    { userId: accountId },
    { $inc: inc, $set: { dailyStreak: streak, updatedAt: new Date() }, $setOnInsert: { userId: accountId } } as never,
    { upsert: true },
  );
  await stats.deleteOne({ _id: guest._id });
}

/** Deletes every app record owned by a user (account deletion). */
export async function deleteUserData(userId: string) {
  await Promise.all([
    collections.games().deleteMany({ userId }),
    collections.results().deleteMany({ userId }),
    collections.personalBests().deleteMany({ userId }),
    collections.stats().deleteMany({ userId }),
    collections.rooms().updateMany({ "participants.userId": userId }, { $pull: { participants: { userId } } }),
  ]);
}
