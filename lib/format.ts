/** 0:42, 12:05, 1:02:09 */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function formatDateKey(dateKey: string, options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" }) {
  return new Date(`${dateKey}T12:00:00Z`).toLocaleDateString(undefined, { timeZone: "UTC", ...options });
}

export function relativeTime(iso: string | number): string {
  const diff = Date.now() - (typeof iso === "number" ? iso : Date.parse(iso));
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
