import type { Metadata } from "next";
import { LobbyScreen } from "@/components/multiplayer/lobby-screen";

export const metadata: Metadata = { title: "Multiplayer" };

export default function MultiplayerPage() {
  return <LobbyScreen />;
}
