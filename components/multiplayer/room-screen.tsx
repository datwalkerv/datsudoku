"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Crown, Loader2, RefreshCw, Share2 } from "lucide-react";
import { PageHeader, PageShell, SectionLabel } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/components/providers/account-provider";
import { useOnline } from "@/hooks/use-online";
import { api, ApiError } from "@/lib/client/api";
import { adoptServerGame } from "@/lib/client/start";
import { createPollingTransport } from "@/lib/client/room-transport";
import { listLocalGames } from "@/lib/local/db";
import type { RoomDTO, RoomParticipantDTO } from "@/lib/multiplayer/types";
import { DIFFICULTY_LABEL } from "@/lib/sudoku/types";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

export function RoomScreen() {
  const { code: rawCode } = useParams<{ code: string }>();
  const code = String(rawCode).toUpperCase();
  const router = useRouter();
  const online = useOnline();
  const { pending, ensureAccount } = useAccount();
  const transport = useMemo(() => createPollingTransport(), []);
  const [room, setRoom] = useState<RoomDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"join" | "rematch" | null>(null);
  const [copied, setCopied] = useState(false);
  const [localGameId, setLocalGameId] = useState<string | null>(null);

  useEffect(() => {
    if (pending) return;
    return transport.subscribe(
      code,
      (r) => {
        setRoom(r);
        setError(null);
      },
      (e) => setError(e instanceof ApiError && e.status === 404 ? "This room doesn't exist or has expired." : null),
    );
  }, [code, transport, pending]);

  // The local copy of this round's game, if it was opened on this device.
  useEffect(() => {
    if (!room) return;
    let cancelled = false;
    listLocalGames(100).then((games) => {
      const g = games.find((x) => x.roomCode === code && x.round === room.round);
      if (!cancelled) setLocalGameId(g?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [room, code]);

  const play = async () => {
    if (localGameId && !online) {
      router.push(`/play?id=${encodeURIComponent(localGameId)}`);
      return;
    }
    setBusy("join");
    try {
      const owner = await ensureAccount();
      const { game, room: next } = await api.joinRoom(code);
      setRoom(next);
      const id = await adoptServerGame(game, owner?.id ?? null);
      router.push(`/play?id=${encodeURIComponent(id)}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't join the room.");
      setBusy(null);
    }
  };

  const rematch = async () => {
    if (!room) return;
    setBusy("rematch");
    try {
      const { room: next } = await api.rematch(code, room.round);
      setRoom(next);
      toast(`Round ${next.round + 1} is ready`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't start a rematch.");
    } finally {
      setBusy(null);
    }
  };

  const share = async () => {
    const url = `${location.origin}/multiplayer/${code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join my Sudoku room", text: `Room ${code}`, url });
        return;
      } catch {
        // Share sheet dismissed; fall back to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast(url);
    }
  };

  const me = room?.participants.find((p) => p.isYou);
  const finished = room?.participants.filter((p) => p.result).sort((a, b) => a.result!.rank - b.result!.rank) ?? [];
  const others = room?.participants.filter((p) => !p.result) ?? [];

  return (
    <PageShell>
      <PageHeader
        title={`Room ${code}`}
        subtitle={room ? `${DIFFICULTY_LABEL[room.difficulty]} · Round ${room.round + 1}` : undefined}
        backHref="/multiplayer"
        backLabel="Rooms"
        trailing={
          <Button variant="ghost" size="icon" onClick={() => transport.refresh()} aria-label="Refresh" className="text-tint">
            <RefreshCw className="size-4" />
          </Button>
        }
      />

      <div className="space-y-8 pt-2">
        {error ? (
          <p className="rounded-[14px] border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{error}</p>
        ) : !room ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <section className="rounded-[18px] border bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] text-muted-foreground">Room code</p>
                  <p className="font-mono text-2xl tracking-[0.25em]">{room.code}</p>
                </div>
                <Button variant="secondary" onClick={share} className="rounded-full">
                  {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
                  {copied ? "Copied" : "Invite"}
                </Button>
              </div>
              <div className="mt-5">
                {me?.result ? (
                  <p className="text-center text-sm text-muted-foreground">
                    You finished #{me.result.rank} in <span className="font-medium text-foreground tabular-nums">{formatDuration(me.result.timeMs)}</span>
                  </p>
                ) : (
                  <Button onClick={play} disabled={busy !== null || (!online && !localGameId)} className="h-12 w-full rounded-[12px] text-[15px]">
                    {busy === "join" && <Loader2 className="size-4 animate-spin" />}
                    {!room.isMember ? "Join and play" : me?.status === "playing" ? "Continue puzzle" : "Start puzzle"}
                  </Button>
                )}
                {room.isHost && finished.length > 0 && (
                  <Button variant="ghost" onClick={rematch} disabled={busy !== null} className="mt-2 w-full text-tint">
                    {busy === "rematch" && <Loader2 className="size-4 animate-spin" />} Start rematch (new puzzle)
                  </Button>
                )}
              </div>
            </section>

            <section>
              <SectionLabel>Results</SectionLabel>
              {finished.length === 0 ? (
                <p className="rounded-[14px] border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                  Nobody has finished this round yet.
                </p>
              ) : (
                <ol className="overflow-hidden rounded-[14px] border bg-card divide-y">
                  {finished.map((p) => (
                    <ParticipantRow key={p.name + p.result!.rank} p={p} />
                  ))}
                </ol>
              )}
            </section>

            {others.length > 0 && (
              <section>
                <SectionLabel>Players</SectionLabel>
                <ul className="overflow-hidden rounded-[14px] border bg-card divide-y">
                  {others.map((p, k) => (
                    <ParticipantRow key={p.name + k} p={p} />
                  ))}
                </ul>
              </section>
            )}

            <p className="px-1 text-xs leading-relaxed text-muted-foreground">
              Updates every few seconds while this page is open. Each player&apos;s time runs on the server from when they
              start the puzzle. Rooms expire after 7 days of inactivity.
            </p>
          </>
        )}
      </div>
    </PageShell>
  );
}

function ParticipantRow({ p }: { p: RoomParticipantDTO }) {
  return (
    <li className={cn("flex min-h-12 items-center gap-3 px-4 py-2 text-sm tabular-nums", p.isYou && "bg-accent/60")}>
      {p.result ? (
        <span className={cn("w-6 text-muted-foreground", p.result.rank <= 3 && "font-semibold text-foreground")}>{p.result.rank}</span>
      ) : null}
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className={cn("truncate", p.isYou && "font-medium")}>{p.isYou ? `${p.name} (you)` : p.name}</span>
        {p.isHost && <Crown className="size-3.5 shrink-0 text-muted-foreground" aria-label="Host" />}
        {p.result && p.result.hintsUsed > 0 && (
          <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">Hints</span>
        )}
      </span>
      {p.result ? (
        <>
          <span className="text-xs text-muted-foreground">{p.result.mistakes} ✕</span>
          <span className="w-16 text-right font-medium">{formatDuration(p.result.timeMs)}</span>
        </>
      ) : (
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {p.status === "playing" ? (
            <>
              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary" aria-label={`${p.progress}% done`}>
                <span className="block h-full rounded-full bg-tint transition-[width] duration-500" style={{ width: `${p.progress}%` }} />
              </span>
              {p.progress}%
            </>
          ) : (
            "Joined"
          )}
        </span>
      )}
    </li>
  );
}
