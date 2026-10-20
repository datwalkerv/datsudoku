"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Crown, DoorClosed, Loader2, RefreshCw, Share2, Timer, Trophy } from "lucide-react";
import { EmptyState, PageHeader, PageShell, SectionFooter, SectionLabel } from "@/components/layout/page-header";
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
          <Button variant="ghost" size="icon" onClick={() => transport.refresh()} aria-label="Refresh" className="-mr-2">
            <RefreshCw className="size-5" strokeWidth={2.2} />
          </Button>
        }
      />

      <div className="space-y-10">
        {error ? (
          <EmptyState icon={DoorClosed} title="Room unavailable">
            {error}
          </EmptyState>
        ) : !room ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <section className="rounded-[20px] bg-card p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="type-footnote font-medium text-muted-foreground uppercase">Room code</p>
                  <p className="font-mono text-[1.75rem] leading-tight font-semibold tracking-[0.2em]">{room.code}</p>
                </div>
                <Button variant="tinted" size="sm" onClick={share}>
                  {copied ? <Check /> : <Share2 />}
                  {copied ? "Copied" : "Invite"}
                </Button>
              </div>
              <div className="mt-5">
                {me?.result ? (
                  <div className="flex items-center justify-between rounded-[14px] bg-fill px-4 py-3">
                    <div>
                      <p className="type-caption text-muted-foreground">You finished #{me.result.rank}</p>
                      <p className="type-title1 tabular-nums">{formatDuration(me.result.timeMs)}</p>
                    </div>
                    <Trophy className="size-7 text-muted-foreground" strokeWidth={1.4} />
                  </div>
                ) : (
                  <Button onClick={play} disabled={busy !== null || (!online && !localGameId)} className="w-full">
                    {busy === "join" && <Loader2 className="animate-spin" />}
                    {!room.isMember ? "Join and Play" : me?.status === "playing" ? "Continue Puzzle" : "Start Puzzle"}
                  </Button>
                )}
                {room.isHost && finished.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={rematch} disabled={busy !== null} className="mt-2 w-full">
                    {busy === "rematch" && <Loader2 className="animate-spin" />} Start Rematch with a New Puzzle
                  </Button>
                )}
              </div>
            </section>

            <section>
              <SectionLabel>Results</SectionLabel>
              {finished.length === 0 ? (
                <EmptyState icon={Timer}>Nobody has finished this round yet.</EmptyState>
              ) : (
                <ol className="overflow-hidden rounded-[12px] bg-card">
                  {finished.map((p) => (
                    <ParticipantRow key={p.name + p.result!.rank} p={p} />
                  ))}
                </ol>
              )}
            </section>

            {others.length > 0 && (
              <section>
                <SectionLabel>Playing</SectionLabel>
                <ul className="overflow-hidden rounded-[12px] bg-card">
                  {others.map((p, k) => (
                    <ParticipantRow key={p.name + k} p={p} />
                  ))}
                </ul>
              </section>
            )}

            <SectionFooter>
              Updates every few seconds while this page is open. Each player&apos;s time runs on the server from when they
              start the puzzle. Rooms expire after 7 days of inactivity.
            </SectionFooter>
          </>
        )}
      </div>
    </PageShell>
  );
}

const MEDAL = ["bg-primary text-primary-foreground", "bg-fill-strong text-foreground", "bg-fill text-foreground"];

function ParticipantRow({ p }: { p: RoomParticipantDTO }) {
  return (
    <li className={cn("group/row flex h-[52px] items-center gap-3 pl-4 tabular-nums", p.isYou && "bg-accent")}>
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full type-footnote font-semibold",
          p.result ? (p.result.rank <= 3 ? MEDAL[p.result.rank - 1] : "text-muted-foreground") : "bg-fill text-muted-foreground",
        )}
      >
        {p.result ? p.result.rank : p.name.charAt(0).toUpperCase()}
      </span>
      <span className="relative flex min-w-0 flex-1 items-center gap-2 self-stretch pr-4 after:absolute after:inset-x-0 after:bottom-0 after:h-px after:scale-y-50 after:bg-border group-last/row:after:hidden">
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          <span className={cn("truncate type-body", p.isYou && "font-semibold")}>{p.isYou ? `${p.name} (you)` : p.name}</span>
          {p.isHost && <Crown className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.6} aria-label="Host" />}
          {p.result && p.result.hintsUsed > 0 && (
            <span className="rounded-full bg-fill px-2 py-0.5 type-caption font-medium text-muted-foreground">Hints</span>
          )}
        </span>
        {p.result ? (
          <>
            <span className="type-footnote text-muted-foreground">{p.result.mistakes} ✕</span>
            <span className="w-14 text-right type-headline">{formatDuration(p.result.timeMs)}</span>
          </>
        ) : (
          <span className="flex items-center gap-2 type-footnote text-muted-foreground">
            {p.status === "playing" ? (
              <>
                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-fill" aria-label={`${p.progress}% done`}>
                  <span className="block h-full rounded-full bg-tint transition-[width] duration-500" style={{ width: `${p.progress}%` }} />
                </span>
                {p.progress}%
              </>
            ) : (
              "Joined"
            )}
          </span>
        )}
      </span>
    </li>
  );
}
