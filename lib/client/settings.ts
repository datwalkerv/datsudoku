"use client";

import { useSyncExternalStore } from "react";

export interface Settings {
  /** Remove a placed digit from notes in its row, column and box. */
  autoCleanup: boolean;
  /** Mark entries that disagree with the solution. */
  showMistakes: boolean;
  /** Highlight cells with the same digit as the selection. */
  highlightMatches: boolean;
  /** Highlight the selected cell's row, column and box. */
  highlightRelated: boolean;
  showTimer: boolean;
  /** Subtle click sounds. Off by default. */
  sound: boolean;
  haptics: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  autoCleanup: true,
  showMistakes: true,
  highlightMatches: true,
  highlightRelated: true,
  showTimer: true,
  sound: false,
  haptics: true,
};

const KEY = "sudoku:settings:v1";
const listeners = new Set<() => void>();
let cache: Settings | null = null;

function read(): Settings {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULT_SETTINGS;
  } catch {
    cache = DEFAULT_SETTINGS;
  }
  return cache;
}

export function updateSettings(patch: Partial<Settings>) {
  cache = { ...read(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Storage may be unavailable (private mode); settings still apply for this session.
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_SETTINGS);
}
