"use client";

import { useSyncExternalStore } from "react";

const query = "(display-mode: standalone)";

function subscribe(cb: () => void) {
  const mql = window.matchMedia(query);
  mql.addEventListener("change", cb);
  return () => mql.removeEventListener("change", cb);
}

/** True when launched from the Home Screen (iOS) or as an installed PWA. */
export function useStandalone(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
    () => false,
  );
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}
