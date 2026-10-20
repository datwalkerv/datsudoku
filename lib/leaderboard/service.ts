import "server-only";
import { ObjectId, type Collection, type Document, type Filter } from "mongodb";
import { collections } from "@/lib/db/collections";
import { db } from "@/lib/db/mongodb";
import { HttpError } from "@/lib/errors";
import type { LeaderboardQuery } from "@/lib/validation/schemas";
import { utcDateKey } from "@/lib/daily/date";
import type { LeaderboardEntryDTO, LeaderboardPageDTO } from "./types";

/**
 * Leaderboards are read straight from indexes with keyset pagination,
 * ordered by (timeMs, mistakes, completedAt, _id) so ties are deterministic.
 *
 * - global: one personal best per user per mode/difficulty (registered, ranked)
 * - daily:  ranked results for one UTC date (one game per user per date)
 * - room:   every verified result in a room round (guests and hints included,
 *           flagged), since rooms are private competitions among friends
 */

interface Cursor {
  t: number;
  m: number;
  c: string;
  id: string;
}

export function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}

export function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(Buffer.from(raw, "base64url").toString()) as Cursor;
    if (typeof c.t !== "number" || typeof c.m !== "number" || typeof c.c !== "string" || !ObjectId.isValid(c.id)) {
      throw new Error("bad cursor");
    }
    return c;
  } catch {
    throw new HttpError(400, "invalid_cursor", "Invalid pagination cursor");
  }
}

/** Documents strictly after the cursor in sort order. */
function afterCursor(c: Cursor): Document {
  const completedAt = new Date(c.c);
  const id = new ObjectId(c.id);
  return {
    $or: [
      { timeMs: { $gt: c.t } },
      { timeMs: c.t, mistakes: { $gt: c.m } },
      { timeMs: c.t, mistakes: c.m, completedAt: { $gt: completedAt } },
      { timeMs: c.t, mistakes: c.m, completedAt, _id: { $gt: id } },
    ],
  };
}

/** Same comparison, used to count how many entries rank ahead of a given one. */
function beforeEntry(e: { timeMs: number; mistakes: number; completedAt: Date; _id: ObjectId }): Document {
  return {
    $or: [
      { timeMs: { $lt: e.timeMs } },
      { timeMs: e.timeMs, mistakes: { $lt: e.mistakes } },
      { timeMs: e.timeMs, mistakes: e.mistakes, completedAt: { $lt: e.completedAt } },
      { timeMs: e.timeMs, mistakes: e.mistakes, completedAt: e.completedAt, _id: { $lt: e._id } },
    ],
  };
}

const SORT = { timeMs: 1, mistakes: 1, completedAt: 1, _id: 1 } as const;

/** Joins Better Auth's `user` collection for display names, one page at a time. */
const NAME_LOOKUP: Document[] = [
  {
    $lookup: {
      from: "user",
      let: { uid: { $convert: { input: "$userId", to: "objectId", onError: null, onNull: null } } },
      pipeline: [{ $match: { $expr: { $eq: ["$_id", "$$uid"] } } }, { $project: { name: 1, isAnonymous: 1 } }],
      as: "u",
    },
  },
  { $addFields: { name: { $ifNull: [{ $first: "$u.name" }, "Player"] }, isAnonymous: { $first: "$u.isAnonymous" } } },
  { $project: { u: 0 } },
];

interface Row {
  _id: ObjectId;
  userId: string;
  timeMs: number;
  mistakes: number;
  hintsUsed?: number;
  completedAt: Date;
  name: string;
  isAnonymous?: boolean;
  eligible?: { ranked: boolean; reason: string | null };
}

async function resolveRoomFilter(q: LeaderboardQuery): Promise<Filter<Document>> {
  if (!q.roomCode) throw new HttpError(400, "room_required", "roomCode is required");
  const room = await collections.rooms().findOne({ code: q.roomCode }, { projection: { _id: 1, currentRound: 1 } });
  if (!room) throw new HttpError(404, "room_not_found", "Room not found");
  return { roomId: room._id, round: q.round ?? room.currentRound };
}

export async function getLeaderboard(q: LeaderboardQuery, viewerId: string | null): Promise<LeaderboardPageDTO> {
  const cursor = decodeCursor(q.cursor);
  let base: Filter<Document>;
  if (q.scope === "global") base = { mode: q.mode, difficulty: q.difficulty };
  else if (q.scope === "daily") base = { mode: "daily", dailyKey: q.dateKey ?? utcDateKey(), "eligible.ranked": true };
  else base = await resolveRoomFilter(q);
  const coll: Collection<Document> = db.collection(q.scope === "global" ? "personalBests" : "gameResults");

  const match = cursor ? { $and: [base, afterCursor(cursor)] } : base;
  const rows = (await coll
    .aggregate([{ $match: match }, { $sort: SORT }, { $limit: q.limit + 1 }, ...NAME_LOOKUP])
    .toArray()) as Row[];

  const hasMore = rows.length > q.limit;
  const page = rows.slice(0, q.limit);
  // The rank of the first row on this page: entries strictly ahead of it.
  const startRank = page.length === 0 ? 0 : (await coll.countDocuments({ $and: [base, beforeEntry(page[0])] })) + 1;

  const entries: LeaderboardEntryDTO[] = page.map((r, k) => ({
    rank: startRank + k,
    name: r.name,
    timeMs: r.timeMs,
    mistakes: r.mistakes,
    hintsUsed: r.hintsUsed ?? 0,
    completedAt: r.completedAt.toISOString(),
    isYou: viewerId !== null && r.userId === viewerId,
    isGuest: Boolean(r.isAnonymous),
    ranked: r.eligible?.ranked ?? true,
  }));

  const last = page[page.length - 1];
  return {
    scope: q.scope,
    entries,
    nextCursor:
      hasMore && last
        ? encodeCursor({ t: last.timeMs, m: last.mistakes, c: last.completedAt.toISOString(), id: last._id.toHexString() })
        : null,
    you: viewerId ? await viewerPosition(q, base, viewerId, coll) : null,
  };
}

async function viewerPosition(
  q: LeaderboardQuery,
  base: Filter<Document>,
  viewerId: string,
  coll: Collection<Document>,
): Promise<LeaderboardPageDTO["you"]> {
  const own = (await coll.findOne({ $and: [base, { userId: viewerId }] }, { sort: SORT })) as Row | null;
  if (!own) return null;
  const ahead = await coll.countDocuments({ $and: [base, beforeEntry(own)] });
  return { rank: ahead + 1, timeMs: own.timeMs, mistakes: own.mistakes };
}
