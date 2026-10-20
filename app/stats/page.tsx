import type { Metadata } from "next";
import { StatsScreen } from "@/components/stats/stats-screen";

export const metadata: Metadata = { title: "Statistics" };

export default function StatsPage() {
  return <StatsScreen />;
}
