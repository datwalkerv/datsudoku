import { Suspense } from "react";
import type { Metadata } from "next";
import { RoomScreen } from "@/components/multiplayer/room-screen";

export const metadata: Metadata = { title: "Room" };

export default function RoomPage() {
  return (
    <Suspense>
      <RoomScreen />
    </Suspense>
  );
}
