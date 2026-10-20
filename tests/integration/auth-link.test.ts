import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { auth, getSessionUser } from "@/lib/auth";
import { collections, ensureIndexes } from "@/lib/db/collections";
import { client } from "@/lib/db/mongodb";
import { completeGame, startClassicGame } from "@/lib/games/service";
import { parseGrid, serializeGrid } from "@/lib/sudoku/board";
import { solve } from "@/lib/sudoku/solver";
import type { Move } from "@/lib/sudoku/types";

beforeAll(async () => {
  await ensureIndexes();
  vi.stubGlobal("fetch", async () => new Response("{}", { status: 503 }));
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterAll(() => client.close());

/** Turns Set-Cookie response headers into a Cookie request header. */
function cookieFrom(response: Response): Headers {
  const cookies = response.headers.getSetCookie().map((c) => c.split(";")[0]);
  return new Headers({ cookie: cookies.join("; "), origin: "http://localhost:3000" });
}

async function signInGuest() {
  const res = await auth.api.signInAnonymous({ headers: new Headers({ origin: "http://localhost:3000" }), asResponse: true });
  expect(res.status).toBe(200);
  return cookieFrom(res);
}

describe("Better Auth guest flow", () => {
  it("creates anonymous guests whose sessions validate on the server", async () => {
    const headers = await signInGuest();
    const u = await getSessionUser(headers);
    expect(u?.isAnonymous).toBe(true);
    expect(await getSessionUser(new Headers())).toBeNull();
  });

  it("registers with email and password and rejects bad credentials", async () => {
    const email = `p${Date.now()}@test.dev`;
    const res = await auth.api.signUpEmail({
      body: { email, password: "correct horse battery", name: "Ada" },
      asResponse: true,
    });
    expect(res.status).toBe(200);
    const u = await getSessionUser(cookieFrom(res));
    expect(u).toMatchObject({ name: "Ada", isAnonymous: false });

    const bad = await auth.api.signInEmail({ body: { email, password: "wrong password!" }, asResponse: true });
    expect(bad.status).toBe(401);
    const good = await auth.api.signInEmail({ body: { email, password: "correct horse battery" }, asResponse: true });
    expect(good.status).toBe(200);
  });

  it("moves a guest's games and results to the new account on sign-up", async () => {
    const guestHeaders = await signInGuest();
    const guest = (await getSessionUser(guestHeaders))!;

    const { game: active } = await startClassicGame(guest, "easy");
    const { game: done } = await startClassicGame(guest, "easy");
    await collections.games().updateOne({ _id: new ObjectId(done.id) }, { $set: { startedAt: new Date(Date.now() - 3_600_000) } });
    const solved = solve(parseGrid(done.givens))!;
    const moves: Move[] = [];
    for (let i = 0; i < 81; i++) if (done.givens[i] === "0") moves.push([i, solved[i], 0]);
    const guestResult = await completeGame(guest, done.id, { board: serializeGrid(solved), moves, elapsedSeconds: 400 });
    expect(guestResult.reason).toBe("guest");

    // Someone else's guest data must not move.
    const strangerHeaders = await signInGuest();
    const stranger = (await getSessionUser(strangerHeaders))!;
    const { game: strangers } = await startClassicGame(stranger, "easy");

    const res = await auth.api.signUpEmail({
      body: { email: `link${Date.now()}@test.dev`, password: "correct horse battery", name: "Grace" },
      headers: guestHeaders,
      asResponse: true,
    });
    expect(res.status).toBe(200);
    const account = (await getSessionUser(cookieFrom(res)))!;
    expect(account.isAnonymous).toBe(false);
    expect(account.id).not.toBe(guest.id);

    const owned = await collections.games().find({ userId: account.id }).toArray();
    expect(owned.map((g) => g._id.toHexString()).sort()).toEqual([active.id, done.id].sort());
    const result = await collections.results().findOne({ gameId: new ObjectId(done.id) });
    expect(result).toMatchObject({ userId: account.id, isRegistered: true, eligible: { ranked: true, reason: null } });
    expect(await collections.personalBests().countDocuments({ userId: account.id })).toBe(1);
    const stats = await collections.stats().findOne({ userId: account.id });
    expect(stats?.completed?.easy).toBe(1);

    const untouched = await collections.games().findOne({ _id: new ObjectId(strangers.id) });
    expect(untouched?.userId).toBe(stranger.id);
  });
});
