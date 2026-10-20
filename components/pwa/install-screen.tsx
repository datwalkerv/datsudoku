"use client";

import { useSyncExternalStore } from "react";
import { CheckCircle2, Share, SquarePlus } from "lucide-react";
import { PageHeader, PageShell } from "@/components/layout/page-header";
import { isIos, useStandalone } from "@/hooks/use-standalone";

export function InstallScreen() {
  const standalone = useStandalone();
  // Client-only check; the prerendered shell shows the generic steps.
  const ios = useSyncExternalStore(() => () => {}, isIos, () => false);
  return (
    <PageShell>
      <PageHeader title="Add to Home Screen" />
      <div className="space-y-6 pt-4">
        {standalone ? (
          <p className="flex items-center gap-2 rounded-[14px] bg-card p-4 type-body">
            <CheckCircle2 className="size-5 text-foreground" /> Sudoku is installed. You&apos;re using the Home Screen app.
          </p>
        ) : (
          <>
            <p className="type-body text-muted-foreground">
              Install Sudoku to play full screen, launch it from your Home Screen, and keep playing saved games offline.
            </p>
            <ol className="space-y-3">
              <Step n={1} icon={<Share className="size-5" />}>
                {ios ? "In Safari, tap the Share button in the toolbar." : "Open your browser's menu (or the install icon in the address bar)."}
              </Step>
              <Step n={2} icon={<SquarePlus className="size-5" />}>
                Choose <span className="font-medium text-foreground">Add to Home Screen</span>
                {ios ? "" : " or Install app"}.
              </Step>
              <Step n={3} icon={<CheckCircle2 className="size-5" />}>
                Tap <span className="font-medium text-foreground">Add</span>. Open Sudoku from your Home Screen.
              </Step>
            </ol>
            <p className="px-4 type-footnote text-muted-foreground">
              Games you&apos;ve opened stay available offline. Signing in, leaderboards, rooms, the Daily Challenge and
              new server puzzles need a connection; offline you can still start practice games.
            </p>
          </>
        )}
      </div>
    </PageShell>
  );
}

function Step({ n, icon, children }: { n: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-4 rounded-[14px] bg-card p-4 type-body text-muted-foreground">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-tint" aria-hidden>
        {icon}
      </span>
      <span>
        <span className="sr-only">Step {n}: </span>
        {children}
      </span>
    </li>
  );
}
