import type { Difficulty } from "@/lib/sudoku/types";

export interface RoomParticipantDTO {
  name: string;
  isYou: boolean;
  isHost: boolean;
  /** Percent of empty cells filled. */
  progress: number;
  status: "joined" | "playing" | "finished";
  result: { timeMs: number; mistakes: number; hintsUsed: number; rank: number } | null;
}

export interface RoomDTO {
  code: string;
  status: "open" | "closed";
  difficulty: Difficulty;
  maxPlayers: number;
  round: number;
  seed: string;
  roundStartedAt: string;
  isHost: boolean;
  isMember: boolean;
  expiresAt: string;
  participants: RoomParticipantDTO[];
  previousRounds: { round: number; seed: string }[];
}

/**
 * Room updates travel through this interface so polling can later be
 * replaced by a real-time transport without touching UI code.
 */
export interface RoomTransport {
  subscribe(code: string, onUpdate: (room: RoomDTO) => void, onError: (error: Error) => void): () => void;
  refresh(): void;
}
