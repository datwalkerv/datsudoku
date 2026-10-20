"use client";

import type { GameDTO, GameSummaryDTO, ResultDTO } from "@/lib/games/types";
import type { RoomDTO } from "@/lib/multiplayer/types";
import type { LeaderboardPageDTO } from "@/lib/leaderboard/types";
import type { StatsDTO } from "@/lib/stats/types";
import type { DailyStatus } from "@/lib/daily/types";
import type { Difficulty, Move } from "@/lib/sudoku/types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly body: Record<string, unknown> = {},
  ) {
    super(message);
  }
  /** Network failures and server errors are worth retrying. */
  get transient() {
    return this.status === 0 || this.status >= 500 || this.status === 429;
  }
}

async function request<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  let response: Response;
  const body = init?.json !== undefined ? JSON.stringify(init.json) : init?.body;
  try {
    response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      headers: { ...(init?.json !== undefined ? { "Content-Type": "application/json" } : {}), ...init?.headers },
      body,
      cache: "no-store",
      // Lets saves started while the app is closing finish (browsers cap keepalive bodies at 64 KB).
      keepalive: init?.method !== undefined && init.method !== "GET" && typeof body === "string" && body.length < 60_000,
    });
  } catch {
    throw new ApiError(0, "offline", "You appear to be offline");
  }
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new ApiError(response.status, String(data.code ?? "error"), String(data.error ?? response.statusText), data);
  }
  return data as T;
}

export const api = {
  createGame: (difficulty: Difficulty) =>
    request<{ game: GameDTO; fallbackReason: string | null }>("/api/games", {
      method: "POST",
      json: { mode: "classic", difficulty },
    }),
  listGames: (status?: "active" | "completed") =>
    request<{ games: GameSummaryDTO[] }>(`/api/games${status ? `?status=${status}` : ""}`),
  getGame: (id: string) => request<{ game: GameDTO }>(`/api/games/${id}`),
  saveGame: (
    id: string,
    body: {
      baseVersion: number;
      board: string;
      notes: number[];
      moves: Move[];
      mistakes: number;
      hintsUsed: number;
      elapsedSeconds: number;
    },
  ) => request<{ version: number; updatedAt: string }>(`/api/games/${id}`, { method: "PUT", json: body }),
  hint: (id: string, board: string, selected: number | null) =>
    request<{ hint: { i: number; value: number } }>(`/api/games/${id}/hint`, { method: "POST", json: { board, selected } }),
  complete: (id: string, body: { board: string; moves: Move[]; elapsedSeconds: number; notes?: number[] }) =>
    request<{ result: ResultDTO }>(`/api/games/${id}/complete`, { method: "POST", json: body }),
  daily: () => request<DailyStatus>("/api/daily"),
  startDaily: () => request<{ game: GameDTO }>("/api/daily", { method: "POST" }),
  createRoom: (difficulty: Difficulty, maxPlayers = 8) =>
    request<{ code: string; path: string; game: GameDTO }>("/api/rooms", { method: "POST", json: { difficulty, maxPlayers } }),
  myRooms: () =>
    request<{ rooms: { code: string; difficulty: Difficulty; players: number; round: number; isHost: boolean; createdAt: string }[] }>(
      "/api/rooms",
    ),
  room: (code: string) => request<{ room: RoomDTO }>(`/api/rooms/${code}`),
  joinRoom: (code: string) => request<{ game: GameDTO; room: RoomDTO }>(`/api/rooms/${code}`, { method: "POST" }),
  rematch: (code: string, round: number) =>
    request<{ room: RoomDTO }>(`/api/rooms/${code}/rematch`, { method: "POST", json: { round } }),
  leaderboard: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
    return request<LeaderboardPageDTO>(`/api/leaderboard?${qs}`);
  },
  stats: () => request<{ stats: StatsDTO; user: { name: string; isAnonymous: boolean } }>("/api/stats"),
};
