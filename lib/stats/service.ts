import "server-only";
import { collections } from "@/lib/db/collections";
import { displayStreak } from "@/lib/games/rules";
import { utcDateKey } from "@/lib/daily/date";
import { toResultDTO } from "@/lib/games/service";
import { DIFFICULTIES, type Difficulty, type GameMode } from "@/lib/sudoku/types";
import type { StatsDTO } from "./types";

export async function getStats(userId: string): Promise<StatsDTO> {
  const [stats, bests, recent, active] = await Promise.all([
    collections.stats().findOne({ userId }),
    collections.personalBests().find({ userId }).toArray(),
    collections.results().find({ userId }).sort({ completedAt: -1 }).limit(20).toArray(),
    collections.games().countDocuments({ userId, status: "active" }),
  ]);
  const byDifficulty = DIFFICULTIES.map((difficulty: Difficulty) => {
    const completed = stats?.completed?.[difficulty] ?? 0;
    const total = stats?.totalTimeMs?.[difficulty] ?? 0;
    return { difficulty, completed, averageMs: completed ? Math.round(total / completed) : null };
  });
  const streak = stats?.dailyStreak ?? { current: 0, best: 0, lastDateKey: null };
  return {
    totalCompleted: byDifficulty.reduce((n, d) => n + d.completed, 0),
    activeGames: active,
    hintsUsed: stats?.hintsUsed ?? 0,
    mistakes: stats?.mistakes ?? 0,
    byDifficulty,
    personalBests: bests.map((b) => ({
      mode: b.mode as GameMode,
      difficulty: b.difficulty,
      timeMs: b.timeMs,
      mistakes: b.mistakes,
      completedAt: b.completedAt.toISOString(),
    })),
    streak: {
      current: displayStreak(streak, utcDateKey()),
      best: streak.best,
      lastDateKey: streak.lastDateKey,
    },
    recent: recent.map((r) => toResultDTO(r)),
  };
}
