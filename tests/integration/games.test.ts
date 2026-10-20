import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { collections, ensureIndexes } from "@/lib/db/collections";
import { client } from "@/lib/db/mongodb";
import { completeGame, getGameWithResult, requestHint, saveGame, startClassicGame } from "@/lib/games/service";
import { getOrCreateDaily, startDailyGame } from "@/lib/daily/service";
import { createRoom, getRoomView, joinRoom, startRematch } from "@/lib/multiplayer/service";
import { getLeaderboard } from "@/lib/leaderboard/service";
import { leaderboardQuerySchema } from "@/lib/validation/schemas";
import { parseGrid, serializeGrid } from "@/lib/sudoku/board";
import { solve } from "@/lib/sudoku/solver";
import { utcDateKey } from "@/lib/daily/date";
import type { GameDTO } from "@/lib/games/types";
import type { Move } from "@/lib/sudoku/types";
import { HttpError } from "@/lib/errors";
import { guest, user } from "../helpers";

beforeAll(async () => {
  await ensureIndexes();
  // No network in tests: a malformed API response makes acquisition use the internal generator.
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ nope: true }), { status: 200 }));
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterAll(() => client.close());

/** Builds a correct completion: every empty cell typed once with its solution value. */
function solution(game: GameDTO, extraMoves: Move[] = []) {
  const solved = solve(parseGrid(game.givens))!;
  const moves: Move[] = [...extraMoves];
  for (let i = 0; i < 81; i++) if (game.givens[i] === "0") moves.push([i, solved[i], 0]);
  return { board: serializeGrid(solved), moves, elapsedSeconds: 300 };
}

/** Moves a game's server start time into the past so wall-clock time is plausible. */
async function age(gameId: string, ms: number) {
  await collections.games().updateOne({ _id: new ObjectId(gameId) }, { $set: { startedAt: new Date(Date.now() - ms) } });
}

async function expectHttp(promise: Promise<unknown>, status: number) {
  await expect(promise).rejects.toBeInstanceOf(HttpError);
  await promise.catch((e: HttpError) => expect(e.status).toBe(status));
}

describe("classic games", () => {
  it("creates a game with stored puzzle and no solution in the DTO", async () => {
    const u = user();
    const { game } = await startClassicGame(u, "easy");
    expect(game.givens).toMatch(/^[0-9]{81}$/);
    expect(JSON.stringify(game)).not.toContain("solution");
    const puzzle = await collections.puzzles().findOne({ seed: game.seed });
    expect(puzzle?.puzzle).toBe(game.givens);
  });

  it("saves with optimistic concurrency and returns the newer state on conflict", async () => {
    const u = user();
    const { game } = await startClassicGame(u, "easy");
    const base = { board: game.board, notes: game.notes, moves: [], mistakes: 0, hintsUsed: 0, elapsedSeconds: 10 };
    const first = await saveGame(u.id, game.id, { ...base, baseVersion: 0 });
    expect(first.version).toBe(1);
    // A stale device still at version 0.
    const stale = saveGame(u.id, game.id, { ...base, baseVersion: 0, elapsedSeconds: 5 });
    await expect(stale).rejects.toMatchObject({ status: 409, body: { game: expect.objectContaining({ version: 1 }) } });
    const second = await saveGame(u.id, game.id, { ...base, baseVersion: 1, elapsedSeconds: 20 });
    expect(second.version).toBe(2);
  });

  it("rejects boards that change the givens", async () => {
    const u = user();
    const { game } = await startClassicGame(u, "easy");
    const i = game.givens.search(/[1-9]/);
    const tampered = game.board.slice(0, i) + (game.board[i] === "9" ? "1" : "9") + game.board.slice(i + 1);
    await expectHttp(
      saveGame(u.id, game.id, { baseVersion: 0, board: tampered, notes: game.notes, moves: [], mistakes: 0, hintsUsed: 0, elapsedSeconds: 1 }),
      400,
    );
  });

  it("does not let another user read, save, hint or complete a game", async () => {
    const owner = user();
    const other = user();
    const { game } = await startClassicGame(owner, "easy");
    await expectHttp(getGameWithResult(other.id, game.id), 404);
    await expectHttp(
      saveGame(other.id, game.id, { baseVersion: 0, board: game.board, notes: game.notes, moves: [], mistakes: 0, hintsUsed: 0, elapsedSeconds: 1 }),
      404,
    );
    await expectHttp(requestHint(other.id, game.id, game.board, null), 404);
    await expectHttp(completeGame(other, game.id, solution(game)), 404);
  });

  it("rejects incorrect completions", async () => {
    const u = user();
    const { game } = await startClassicGame(u, "easy");
    const s = solution(game);
    const i = game.givens.indexOf("0");
    const wrong = s.board.slice(0, i) + ((Number(s.board[i]) % 9) + 1) + s.board.slice(i + 1);
    await expectHttp(completeGame(u, game.id, { ...s, board: wrong }), 422);
  });

  it("verifies completion, recomputes mistakes, and is idempotent under duplicates", async () => {
    const u = user();
    const { game } = await startClassicGame(u, "medium");
    await age(game.id, 10 * 60_000);
    const i = game.givens.indexOf("0");
    const solved = solve(parseGrid(game.givens))!;
    const wrongMove: Move = [i, (solved[i] % 9) + 1, 0];
    const input = solution(game, [wrongMove]);

    const results = await Promise.all([completeGame(u, game.id, input), completeGame(u, game.id, input), completeGame(u, game.id, input)]);
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(results[0].mistakes).toBe(1);
    expect(results[0].ranked).toBe(true);
    // Server wall-clock (aged 10 min), not the client's claimed 300 s.
    expect(results[0].timeMs).toBeGreaterThanOrEqual(10 * 60_000);
    expect(results[0].timeMs).toBeLessThan(11 * 60_000);
    expect(await collections.results().countDocuments({ gameId: new ObjectId(game.id) })).toBe(1);

    const after = await getGameWithResult(u.id, game.id);
    expect(after.status).toBe("completed");
    expect(after.result?.id).toBe(results[0].id);
    // Completed games refuse further saves.
    await expectHttp(
      saveGame(u.id, game.id, { baseVersion: after.version, board: after.board, notes: after.notes, moves: [], mistakes: 0, hintsUsed: 0, elapsedSeconds: 1 }),
      409,
    );
  });

  it("ignores the client's claimed time and flags implausible times", async () => {
    const u = user();
    const { game } = await startClassicGame(u, "easy");
    // Started moments ago on the server: the client's claimed 300 s is ignored.
    const r = await completeGame(u, game.id, solution(game));
    expect(r.timeMs).toBeLessThan(5_000);
    expect(r.ranked).toBe(false);
    expect(r.reason).toBe("implausible-time");
  });

  it("does not rank guests or hinted games", async () => {
    const g = guest();
    const { game } = await startClassicGame(g, "easy");
    await age(game.id, 10 * 60_000);
    expect((await completeGame(g, game.id, solution(game))).reason).toBe("guest");

    const u = user();
    const { game: hinted } = await startClassicGame(u, "easy");
    await age(hinted.id, 10 * 60_000);
    const hint = await requestHint(u.id, hinted.id, hinted.board, null);
    const s = solution(hinted);
    const r = await completeGame(u, hinted.id, {
      ...s,
      moves: [[hint.i, hint.value, 2], ...s.moves.filter(([i]) => i !== hint.i)],
    });
    expect(r.ranked).toBe(false);
    expect(r.reason).toBe("hints");
    expect(r.hintsUsed).toBe(1);
  });

  it("flags a move log that does not reproduce the board", async () => {
    const u = user();
    const { game } = await startClassicGame(u, "easy");
    await age(game.id, 10 * 60_000);
    const s = solution(game);
    const r = await completeGame(u, game.id, { ...s, moves: s.moves.slice(1) });
    expect(r.reason).toBe("replay-mismatch");
  });
});

describe("daily challenge", () => {
  it("assigns exactly one puzzle per date under concurrency", async () => {
    const dateKey = "2031-01-07";
    const all = await Promise.all(Array.from({ length: 20 }, () => getOrCreateDaily(dateKey)));
    const ids = new Set(all.map((d) => d.puzzleId.toHexString()));
    expect(ids.size).toBe(1);
    expect(await collections.daily().countDocuments({ dateKey })).toBe(1);
    expect(all[0].difficulty).toBe("easy"); // 2031-01-07 is a Tuesday
  });

  it("gives every player the same puzzle and one game per day", async () => {
    const a = user();
    const b = user();
    const today = utcDateKey();
    const [ga, ga2, gb] = await Promise.all([startDailyGame(a, today), startDailyGame(a, today), startDailyGame(b, today)]);
    expect(ga.id).toBe(ga2.id);
    expect(ga.seed).toBe(gb.seed);
    expect(ga.givens).toBe(gb.givens);
    expect(await collections.games().countDocuments({ userId: a.id, mode: "daily" })).toBe(1);
  });

  it("ranks by server time and advances the streak", async () => {
    const u = user();
    const today = utcDateKey();
    const game = await startDailyGame(u, today);
    await age(game.id, 4 * 60_000);
    const r = await completeGame(u, game.id, { ...solution(game), elapsedSeconds: 30 });
    expect(r.ranked).toBe(true);
    expect(r.timeMs).toBeGreaterThanOrEqual(4 * 60_000); // wall-clock, not the client's 30s
    const stats = await collections.stats().findOne({ userId: u.id });
    expect(stats?.dailyStreak).toMatchObject({ current: 1, lastDateKey: today });

    const board = await getLeaderboard(leaderboardQuerySchema.parse({ scope: "daily", dateKey: today }), u.id);
    expect(board.entries.some((e) => e.isYou)).toBe(true);
    expect(board.you?.rank).toBeGreaterThanOrEqual(1);
  });
});

describe("multiplayer rooms", () => {
  it("gives every participant the same seeded puzzle without acquiring new ones", async () => {
    const host = user();
    const room = await createRoom(host, "medium", 4);
    expect(room.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{6}$/);
    const puzzlesBefore = await collections.puzzles().countDocuments();

    const p1 = user();
    const p2 = guest();
    const [h, j1, j1again, j2] = await Promise.all([
      joinRoom(host, room.code),
      joinRoom(p1, room.code),
      joinRoom(p1, room.code),
      joinRoom(p2, room.code),
    ]);
    expect(await collections.puzzles().countDocuments()).toBe(puzzlesBefore);
    expect(new Set([h.game.seed, j1.game.seed, j2.game.seed]).size).toBe(1);
    expect(h.game.givens).toBe(j2.game.givens);
    expect(j1.game.id).toBe(j1again.game.id);

    const view = await getRoomView(p1, room.code);
    expect(view.participants).toHaveLength(3);
    expect(view.participants.filter((p) => p.isYou)).toHaveLength(1);
  });

  it("enforces capacity and restores progress on rejoin", async () => {
    const host = user();
    const room = await createRoom(host, "easy", 2);
    const p1 = user();
    const { game } = await joinRoom(p1, room.code);
    await expectHttp(joinRoom(user(), room.code), 409);
    await saveGame(p1.id, game.id, {
      baseVersion: 0,
      board: game.board,
      notes: game.notes,
      moves: [],
      mistakes: 2,
      hintsUsed: 0,
      elapsedSeconds: 42,
    });
    const again = await joinRoom(p1, room.code);
    expect(again.game.elapsedSeconds).toBe(42);
  });

  it("records results in the room board and runs idempotent rematches", async () => {
    const host = user();
    const room = await createRoom(host, "easy", 4);
    const p1 = user();
    const { game: hostGame } = await joinRoom(host, room.code);
    const { game: p1Game } = await joinRoom(p1, room.code);
    await age(hostGame.id, 5 * 60_000);
    await age(p1Game.id, 3 * 60_000);
    await completeGame(host, hostGame.id, solution(hostGame));
    await completeGame(p1, p1Game.id, solution(p1Game));

    const board = await getLeaderboard(leaderboardQuerySchema.parse({ scope: "room", roomCode: room.code }), p1.id);
    expect(board.entries.map((e) => e.rank)).toEqual([1, 2]);
    expect(board.entries[0].isYou).toBe(true); // p1 was faster

    await expectHttp(startRematch(p1, room.code, 0), 403);
    const [r1, r2] = await Promise.all([startRematch(host, room.code, 0), startRematch(host, room.code, 0)]);
    expect(r1.currentRound).toBe(1);
    expect(r2.currentRound).toBe(1);
    const stored = await collections.rooms().findOne({ code: room.code });
    expect(stored?.rounds).toHaveLength(2);
    expect(stored?.rounds[1].seed).not.toBe(stored?.rounds[0].seed);
    const next = await joinRoom(p1, room.code);
    expect(next.game.round).toBe(1);
    expect(next.game.seed).toBe(stored?.rounds[1].seed);
  });
});

describe("leaderboards", () => {
  beforeEach(async () => {
    await collections.personalBests().deleteMany({});
  });

  it("orders deterministically, paginates and keeps one personal best per user", async () => {
    const players = Array.from({ length: 7 }, () => user());
    for (const [k, p] of players.entries()) {
      // Ranked time is server wall-clock, so each game "started" a different time ago.
      for (const seconds of [600 + k * 10, 900]) {
        const { game } = await startClassicGame(p, "hard");
        await age(game.id, seconds * 1000);
        await completeGame(p, game.id, solution(game));
      }
    }
    const pages: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await getLeaderboard(
        leaderboardQuerySchema.parse({ scope: "global", mode: "classic", difficulty: "hard", limit: 3, cursor }),
        players[2].id,
      );
      // Whole seconds: the server clock adds a few ms between aging and completion.
      pages.push(...page.entries.map((e) => `${e.rank}:${Math.floor(e.timeMs / 1000)}`));
      if (page.you) expect(page.you.rank).toBe(3);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    expect(pages).toEqual(players.map((_, k) => `${k + 1}:${600 + k * 10}`));
  });

  it("rejects malformed cursors", async () => {
    await expectHttp(getLeaderboard(leaderboardQuerySchema.parse({ cursor: "garbage" }), null), 400);
  });
});
