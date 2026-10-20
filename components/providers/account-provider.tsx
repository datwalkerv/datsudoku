"use client";

import { createContext, use, useCallback, useEffect, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import { sync } from "@/lib/client/sync";

export interface Account {
  id: string;
  name: string;
  email: string;
  isAnonymous: boolean;
  image: string | null;
}

interface AccountContextValue {
  account: Account | null;
  /** True until the first session check finishes. */
  pending: boolean;
  refetch: () => void;
  /** The current account, creating a guest account if there is none. Null when offline. */
  ensureAccount: () => Promise<Account | null>;
}

const AccountContext = createContext<AccountContextValue>({
  account: null,
  pending: true,
  refetch: () => {},
  ensureAccount: async () => null,
});

function toAccount(user: unknown): Account | null {
  const u = user as (Account & { isAnonymous?: boolean | null }) | undefined;
  return u ? { id: u.id, name: u.name, email: u.email, isAnonymous: Boolean(u.isAnonymous), image: u.image ?? null } : null;
}

/**
 * Exposes the Better Auth session. Guests get an anonymous account only when
 * they start something that needs the server (a game, the daily, a room), so
 * visitors and crawlers that just look around don't create users.
 */
export function AccountProvider({ children }: { children: ReactNode }) {
  const { data, isPending, refetch } = authClient.useSession();
  const account = toAccount(data?.user);

  useEffect(() => {
    if (data) sync.start();
  }, [data]);

  const ensureAccount = useCallback(async (): Promise<Account | null> => {
    if (account) return account;
    if (typeof navigator !== "undefined" && !navigator.onLine) return null;
    // A failed sign-in may mean a guest session already exists (e.g. another
    // tab created it), so always re-read the session afterwards.
    await authClient.signIn.anonymous().catch(() => {});
    const { data: session } = await authClient.getSession().catch(() => ({ data: null }));
    refetch();
    return toAccount(session?.user);
  }, [account, refetch]);

  return <AccountContext value={{ account, pending: isPending, refetch, ensureAccount }}>{children}</AccountContext>;
}

export function useAccount() {
  return use(AccountContext);
}
