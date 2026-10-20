import { describe, expect, it } from "vitest";
import { fromServer, mergeWithServer, resolveConflict, toEngineState, toStoredState } from "@/lib/local/convert";
import { setValue, select } from "@/lib/sudoku/engine";
import type { GameDTO } from "@/lib/games/types";
import { API_PUZZLE, API_SOLUTION } from "../fixtures";

function serverGame(overrides: Partial<GameDTO> = {}): GameDTO {
  return {
    id: "a".repeat(24),
    mode: "classic",
    difficulty: "hard",
    seed: "seed123456",
    source: "youdosudoku",
    givens: API_PUZZLE,
    board: API_PUZZLE,
    notes: new Array(81).fill(0),
    moves: [],
    mistakes: 0,
    hintsUsed: 0,
    elapsedSeconds: 60,
    status: "active",
    version: 3,
    startedAt: new Date(0).toISOString(),
    updatedAt: new Date(1000).toISOString(),
    dailyKey: null,
    roomCode: null,
    round: null,
    result: null,
    ...overrides,
  };
}

describe("local/server merge", () => {
  it("takes the server copy when there is no local copy", () => {
    const merged = mergeWithServer(undefined, serverGame(), "u1");
    expect(merged).toMatchObject({ baseVersion: 3, dirty: false, ownerId: "u1" });
  });

  it("keeps a local copy that is at or ahead of the server", () => {
    const local = { ...fromServer(serverGame(), "u1"), dirty: true };
    local.state.elapsedMs = 5_000;
    expect(mergeWithServer(local, serverGame(), "u1")).toBe(local);
  });

  it("replaces a clean local copy that is behind", () => {
    const local = fromServer(serverGame({ version: 1 }), "u1");
    const merged = mergeWithServer(local, serverGame({ version: 4, elapsedSeconds: 90 }), "u1");
    expect(merged.baseVersion).toBe(4);
    expect(merged.state.elapsedMs).toBe(90_000);
  });

  it("never lets stale local progress overwrite a completed server game", () => {
    const local = { ...fromServer(serverGame({ version: 1 }), "u1"), dirty: true };
    local.state.elapsedMs = 999_000;
    const server = serverGame({ version: 5, status: "completed", board: API_SOLUTION });
    expect(resolveConflict(local, server)).toBe("server");
    const merged = mergeWithServer(local, server, "u1");
    expect(merged.state.status).toBe("completed");
    expect(merged.conflictSnapshot?.elapsedMs).toBe(999_000);
  });

  it("keeps the copy with more play time and rebases it", () => {
    const local = { ...fromServer(serverGame({ version: 1 }), "u1"), dirty: true };
    local.state.elapsedMs = 120_000;
    const merged = mergeWithServer(local, serverGame({ version: 2, elapsedSeconds: 60 }), "u1");
    expect(merged.state.elapsedMs).toBe(120_000);
    expect(merged.baseVersion).toBe(2);
    expect(merged.dirty).toBe(true);

    local.state.elapsedMs = 30_000;
    expect(mergeWithServer(local, serverGame({ version: 2, elapsedSeconds: 60 }), "u1").state.elapsedMs).toBe(60_000);
  });

  it("round-trips engine state through storage", () => {
    const local = fromServer(serverGame(), "u1");
    let state = toEngineState(local);
    expect(state.solution?.join("")).toBe(API_SOLUTION);
    state = setValue(select(state, 0), 2);
    const restored = toEngineState({ ...local, state: toStoredState(state) });
    expect(restored.values[0]).toBe(2);
    expect(restored.past).toHaveLength(1);
  });
});
