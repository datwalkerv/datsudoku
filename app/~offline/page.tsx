import type { Metadata } from "next";
import { OfflineScreen } from "@/components/pwa/offline-screen";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return <OfflineScreen />;
}
