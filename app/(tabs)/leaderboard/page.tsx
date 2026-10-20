import { Suspense } from "react";
import type { Metadata } from "next";
import { LeaderboardScreen } from "@/components/leaderboard/leaderboard-screen";

export const metadata: Metadata = { title: "Leaderboards" };

export default function LeaderboardPage() {
  return (
    <Suspense>
      <LeaderboardScreen />
    </Suspense>
  );
}
