export interface LeaderboardEntryDTO {
  rank: number;
  name: string;
  timeMs: number;
  mistakes: number;
  hintsUsed: number;
  completedAt: string;
  isYou: boolean;
  isGuest: boolean;
  /** Room boards include unranked (hinted/guest) results, flagged here. */
  ranked: boolean;
}

export interface LeaderboardPageDTO {
  scope: "global" | "daily" | "room";
  entries: LeaderboardEntryDTO[];
  nextCursor: string | null;
  you: { rank: number; timeMs: number; mistakes: number } | null;
}
