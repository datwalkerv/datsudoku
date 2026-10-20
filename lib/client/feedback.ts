"use client";

let ctx: AudioContext | null = null;

/** A very short, quiet click. Only used when the sound setting is on. */
export function playClick(kind: "place" | "error" | "complete" = "place") {
  try {
    ctx ??= new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    osc.type = "sine";
    osc.frequency.value = kind === "error" ? 220 : kind === "complete" ? 880 : 660;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "complete" ? 0.35 : 0.06));
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  } catch {
    // Audio may be unavailable; feedback is optional.
  }
}

export function haptic(ms = 8) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(ms);
}
