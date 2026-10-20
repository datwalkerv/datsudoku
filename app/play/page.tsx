import { Suspense } from "react";
import type { Metadata } from "next";
import { PlayLoader } from "@/components/sudoku/play-loader";
import { BoardSkeleton } from "@/components/sudoku/board-skeleton";

export const metadata: Metadata = { title: "Play" };

/**
 * A static shell (precached by the service worker) so games open offline.
 * The game itself is read from IndexedDB, then reconciled with the server.
 */
export default function PlayPage() {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <PlayLoader />
    </Suspense>
  );
}
