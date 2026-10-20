"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CloudOff, Crown, Loader2, Users } from "lucide-react";
import { Group, ListRow, PageHeader, PageShell, SectionFooter, SectionLabel } from "@/components/layout/page-header";
import { Segmented } from "@/components/ui/segmented";
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
  const { account, pending, ensureAccount } = useAccount();
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
      const owner = await ensureAccount();
      const { code: newCode, game } = await api.createRoom(difficulty);
      await adoptServerGame(game, owner?.id ?? null);
      router.push(`/multiplayer/${newCode}`);
    } catch (error) {
      toast.error(error instanceof ApiError && error.status === 0 ? "You're offline." : "Couldn't create a room.");
      setCreating(false);
    }
  };

  const normalized = code.toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/[IL]/g, "1").replace(/O/g, "0").slice(0, 6);

  return (
    <PageShell>
      <PageHeader title="Rooms" subtitle="Race friends on the same puzzle" backHref={null} />
      <div className="space-y-10">
        {!online && (
          <div className="flex items-start gap-3 rounded-[14px] bg-card p-4">
            <CloudOff className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <p className="type-subhead text-muted-foreground">
              Rooms need a connection. Games you already joined keep working offline and sync later.
            </p>
          </div>
        )}

        <section>
          <SectionLabel>New room</SectionLabel>
          <div className="space-y-4 rounded-[20px] bg-card p-4 shadow-[var(--shadow-card)]">
            <Segmented
              label="Difficulty"
              options={DIFFICULTIES.map((d) => [d, DIFFICULTY_LABEL[d]] as const)}
              value={difficulty}
              onChange={setDifficulty}
            />
            <Button onClick={create} disabled={!online || creating || pending} className="w-full">
              {creating && <Loader2 className="animate-spin" />} Create Room
            </Button>
          </div>
          <SectionFooter>Everyone in the room solves the same puzzle. Times are measured by the server.</SectionFooter>
        </section>

        <section>
          <SectionLabel>Join a room</SectionLabel>
          <form
            className="flex gap-2 rounded-[20px] bg-card p-2 shadow-[var(--shadow-card)]"
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
              className="h-[50px] flex-1 rounded-[14px] border-0 bg-fill text-center font-mono text-xl tracking-[0.35em] uppercase shadow-none placeholder:text-label-tertiary focus-visible:ring-2"
            />
            <Button type="submit" variant="tinted" disabled={normalized.length !== 6 || !online} className="px-6">
              Join
            </Button>
          </form>
        </section>

        {rooms && rooms.length > 0 && (
          <section>
            <SectionLabel>Your rooms</SectionLabel>
            <Group>
              {rooms.map((r) => (
                <ListRow
                  key={r.code}
                  href={`/multiplayer/${r.code}`}
                  icon={r.isHost ? Crown : Users}
                  title={<span className="font-mono tracking-widest">{r.code}</span>}
                  detail={`${DIFFICULTY_LABEL[r.difficulty]} · ${r.players} ${r.players === 1 ? "player" : "players"} · Round ${r.round + 1} · ${relativeTime(r.createdAt)}`}
                />
              ))}
            </Group>
          </section>
        )}
      </div>
    </PageShell>
  );
}
