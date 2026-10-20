"use client";

import { api } from "./api";
import type { RoomDTO, RoomTransport } from "@/lib/multiplayer/types";

const VISIBLE_INTERVAL_MS = 5_000;
const HIDDEN_INTERVAL_MS = 30_000;

/**
 * Room updates by polling — honest and serverless-friendly. Polls every 5s
 * while the page is visible and online, backs off when hidden, and pauses
 * offline. A real-time transport can implement the same interface later.
 */
export function createPollingTransport(): RoomTransport {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let active: { code: string; onUpdate: (r: RoomDTO) => void; onError: (e: Error) => void } | null = null;

  const tick = async () => {
    if (!active) return;
    const current = active;
    if (navigator.onLine) {
      try {
        const { room } = await api.room(current.code);
        if (active === current) current.onUpdate(room);
      } catch (error) {
        if (active === current) current.onError(error as Error);
      }
    }
    if (active !== current) return;
    timer = setTimeout(tick, document.visibilityState === "visible" ? VISIBLE_INTERVAL_MS : HIDDEN_INTERVAL_MS);
  };

  const onVisible = () => {
    if (document.visibilityState === "visible") refresh();
  };

  function refresh() {
    if (timer) clearTimeout(timer);
    void tick();
  }

  return {
    subscribe(code, onUpdate, onError) {
      active = { code, onUpdate, onError };
      document.addEventListener("visibilitychange", onVisible);
      window.addEventListener("online", refresh);
      refresh();
      return () => {
        active = null;
        if (timer) clearTimeout(timer);
        document.removeEventListener("visibilitychange", onVisible);
        window.removeEventListener("online", refresh);
      };
    },
    refresh,
  };
}
