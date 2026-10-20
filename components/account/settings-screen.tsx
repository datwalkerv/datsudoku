"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { ChevronRight, Loader2 } from "lucide-react";
import { Group, PageHeader, PageShell, SectionLabel } from "@/components/layout/page-header";
import { Segmented } from "@/components/leaderboard/leaderboard-screen";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAccount } from "@/components/providers/account-provider";
import { updateSettings, useSettings, type Settings } from "@/lib/client/settings";
import { authClient } from "@/lib/auth-client";
import { useStandalone } from "@/hooks/use-standalone";

const TOGGLES: { key: keyof Settings; label: string; detail?: string }[] = [
  { key: "autoCleanup", label: "Clean up notes automatically", detail: "Removes a placed number from notes in its row, column and box" },
  { key: "showMistakes", label: "Show mistakes", detail: "Marks entries that don't match the solution" },
  { key: "highlightRelated", label: "Highlight row, column and box" },
  { key: "highlightMatches", label: "Highlight matching numbers" },
  { key: "showTimer", label: "Show timer" },
  { key: "sound", label: "Sounds" },
  { key: "haptics", label: "Haptics", detail: "On supported devices" },
];

export function SettingsScreen() {
  const settings = useSettings();
  const { theme, setTheme } = useTheme();
  const standalone = useStandalone();

  return (
    <PageShell>
      <PageHeader title="Settings" />
      <div className="space-y-8 pt-2 pb-6">
        <AccountSection />

        <section>
          <SectionLabel>Appearance</SectionLabel>
          <Segmented
            label="Theme"
            options={[
              ["system", "System"],
              ["light", "Light"],
              ["dark", "Dark"],
            ]}
            value={theme ?? "system"}
            onChange={setTheme}
          />
        </section>

        <section>
          <SectionLabel>Game</SectionLabel>
          <Group>
            {TOGGLES.map(({ key, label, detail }) => (
              <label key={key} className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2.5">
                <span className="flex-1">
                  <span className="block text-[15px]">{label}</span>
                  {detail && <span className="block text-[13px] text-muted-foreground">{detail}</span>}
                </span>
                <Switch checked={settings[key]} onCheckedChange={(v) => updateSettings({ [key]: v })} aria-label={label} />
              </label>
            ))}
          </Group>
        </section>

        <section>
          <SectionLabel>About</SectionLabel>
          <Group>
            {!standalone && <LinkRow href="/install" label="Add to Home Screen" />}
            <LinkRow href="/stats" label="Statistics" />
            <LinkRow href="/leaderboard" label="Leaderboards" />
          </Group>
          <p className="px-1 pt-3 text-xs text-muted-foreground">
            Puzzles from YouDoSudoku are verified for a unique solution before play. Expert puzzles are generated
            in-house.
          </p>
        </section>
      </div>
    </PageShell>
  );
}

function LinkRow({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex min-h-12 items-center px-4 text-[15px] transition-colors hover:bg-secondary/50">
      <span className="flex-1">{label}</span>
      <ChevronRight className="size-4 text-muted-foreground/70" />
    </Link>
  );
}

function AccountSection() {
  const router = useRouter();
  const { account, pending, refetch } = useAccount();
  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  if (pending) return null;

  if (!account || account.isAnonymous) {
    return (
      <section>
        <SectionLabel>Account</SectionLabel>
        <div className="space-y-3 rounded-[14px] border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            You&apos;re playing as a guest. Create an account to appear on leaderboards and keep your progress on every
            device — your current games and streak come with you.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button asChild className="h-11 rounded-[10px]">
              <Link href="/sign-up">Create account</Link>
            </Button>
            <Button asChild variant="secondary" className="h-11 rounded-[10px]">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const value = name ?? account.name;

  const saveName = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === account.name) return;
    setSaving(true);
    const { error } = await authClient.updateUser({ name: trimmed.slice(0, 40) });
    setSaving(false);
    if (error) toast.error(error.message ?? "Couldn't update your name.");
    else {
      toast("Display name updated");
      refetch();
    }
  };

  const signOut = async () => {
    await authClient.signOut();
    refetch();
    router.replace("/");
  };

  const deleteAccount = async () => {
    setDeleting(true);
    const { error } = await authClient.deleteUser({ password: password || undefined });
    setDeleting(false);
    if (error) {
      toast.error(error.message ?? "Couldn't delete the account.");
      return;
    }
    setDeleteOpen(false);
    refetch();
    router.replace("/");
  };

  return (
    <section>
      <SectionLabel>Account</SectionLabel>
      <Group>
        <div className="flex min-h-12 items-center gap-3 px-4 py-2">
          <label htmlFor="display-name" className="w-28 text-[15px]">
            Display name
          </label>
          <Input
            id="display-name"
            value={value}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
            className="h-9 flex-1 border-0 bg-transparent px-0 text-right shadow-none focus-visible:ring-0"
          />
          {saving && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex min-h-12 items-center px-4 text-[15px]">
          <span className="flex-1">Email</span>
          <span className="truncate text-muted-foreground">{account.email}</span>
        </div>
        <button type="button" onClick={signOut} className="flex min-h-12 w-full items-center px-4 text-[15px] text-tint hover:bg-secondary/50">
          Sign out
        </button>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="flex min-h-12 w-full items-center px-4 text-[15px] text-destructive hover:bg-secondary/50"
        >
          Delete account
        </button>
      </Group>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently deletes your account, games, results and statistics. It can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            placeholder="Password (if you have one)"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={deleteAccount} disabled={deleting}>
              {deleting && <Loader2 className="size-4 animate-spin" />} Delete account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
