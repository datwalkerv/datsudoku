import type { Metadata } from "next";
import { DailyScreen } from "@/components/daily/daily-screen";

export const metadata: Metadata = { title: "Daily Challenge" };

export default function DailyPage() {
  return <DailyScreen />;
}
