"use client";

import { Cloud, CloudOff, HardDrive, Loader2, CircleAlert } from "lucide-react";
import type { SyncStatus } from "@/lib/client/sync";
import { cn } from "@/lib/utils";

const COPY: Record<SyncStatus | "device", { label: string; icon: typeof Cloud }> = {
  synced: { label: "Saved", icon: Cloud },
  local: { label: "Saved on device", icon: HardDrive },
  syncing: { label: "Saving", icon: Loader2 },
  offline: { label: "Offline · saved on device", icon: CloudOff },
  error: { label: "Not synced", icon: CircleAlert },
  device: { label: "This device only", icon: HardDrive },
};

/** Distinguishes local-only progress from server-confirmed progress. */
export function SyncBadge({ status }: { status: SyncStatus | "device" }) {
  const { label, icon: Icon } = COPY[status];
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={label} aria-label={label}>
      <Icon className={cn("size-3.5", status === "syncing" && "animate-spin", status === "error" && "text-destructive")} aria-hidden />
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}
