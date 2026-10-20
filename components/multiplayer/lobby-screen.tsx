"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, Crown, Loader2 } from "lucide-react";
import { PageHeader, PageShell, SectionLabel, Group } from "@/components/layout/page-header";
import { Segmented } from "@/components/leaderboard/leaderboard-screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccount } from "@/components/providers/account-provider";
import { useOnline } from "@/hooks/use-online";
import { api, ApiError } from "@/lib/client/api";
import { adoptServerGame } from "@/lib/client/start";
import { DIFFICULTIES, DIFFICULTY_LABEL, type Difficulty } from "@/lib/sudoku/types";
import { relativeTime } from "@/lib/format";

type MyRoom = Awaited<ReturnType<typeof api.myRooms>>["rooms"][number];

export function LobbyScreen() {
  const router = useRouter();
  const online = useOnline();
  const { account, pending } = useAccount();
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [rooms, setRooms] = useState<MyRoom[] | null>(null);

  useEffect(() => {
    if (!online || pending || !account) return;
    let cancelled = false;
    api
      .myRooms()
      .then((r) => !cancelled && setRooms(r.rooms))
      .catch(() => !cancelled && setRooms([]));
    return () => {
      cancelled = true;
    };
  }, [online, pending, account]);

  const create = async () => {
    setCreating(true);
    try {
      const { code: newCode, game } = await api.createRoom(difficulty);
      await adoptServerGame(game, account?.id ?? null);
      router.push(`/multiplayer/${newCode}`);
    } catch (error) {
      toast.error(error instanceof ApiError && error.status === 0 ? "You're offline." : "Couldn't create a room.");
      setCreating(false);
    }
  };

  const normalized = code.toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/[IL]/g, "1").replace(/O/g, "0").slice(0, 6);

  return (
    <PageShell>
      <PageHeader title="Multiplayer" />
      <div className="space-y-8 pt-2">
        {!online && (
          <p className="rounded-xl bg-secondary px-3 py-2 text-[13px] text-muted-foreground">
            Rooms need a connection. Games you already joined keep working offline and sync later.
          </p>
        )}

        <section>
          <SectionLabel>Create a private room</SectionLabel>
          <div className="space-y-3 rounded-[14px] border bg-card p-3">
            <Segmented
              label="Difficulty"
              options={DIFFICULTIES.map((d) => [d, DIFFICULTY_LABEL[d]])}
              value={difficulty}
              onChange={(v) => setDifficulty(v as Difficulty)}
            />
            <Button onClick={create} disabled={!online || creating || pending} className="h-12 w-full rounded-[10px] text-[15px]">
              {creating && <Loader2 className="size-4 animate-spin" />} Create room
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Everyone in the room solves the same puzzle. Times are measured by the server.
            </p>
          </div>
        </section>

        <section>
          <SectionLabel>Join with a code</SectionLabel>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (normalized.length === 6) router.push(`/multiplayer/${normalized}`);
            }}
          >
            <Input
              value={normalized}
              onChange={(e) => setCode(e.target.value)}
              placeholder="ABC123"
              aria-label="Room code"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              className="h-12 flex-1 rounded-[10px] bg-card text-center font-mono text-lg tracking-[0.3em] uppercase"
            />
            <Button type="submit" variant="secondary" disabled={normalized.length !== 6 || !online} className="h-12 rounded-[10px] px-5">
              Join
            </Button>
          </form>
        </section>

        {rooms && rooms.length > 0 && (
          <section>
            <SectionLabel>Your rooms</SectionLabel>
            <Group>
              {rooms.map((r) => (
                <Link
                  key={r.code}
                  href={`/multiplayer/${r.code}`}
                  className="flex min-h-14 items-center gap-3 px-4 py-2 transition-colors hover:bg-secondary/50"
                >
                  <span className="font-mono text-[15px] tracking-widest">{r.code}</span>
                  {r.isHost && <Crown className="size-3.5 text-muted-foreground" aria-label="Host" />}
                  <span className="flex-1 text-[13px] text-muted-foreground">
                    {DIFFICULTY_LABEL[r.difficulty]} · {r.players} {r.players === 1 ? "player" : "players"} · round {r.round + 1} ·{" "}
                    {relativeTime(r.createdAt)}
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground/70" />
                </Link>
              ))}
            </Group>
          </section>
        )}
      </div>
    </PageShell>
  );
}
