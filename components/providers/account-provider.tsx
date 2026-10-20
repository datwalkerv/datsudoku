"use client";

import { createContext, use, useEffect, useRef, type ReactNode } from "react";
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
}

const AccountContext = createContext<AccountContextValue>({ account: null, pending: true, refetch: () => {} });

/**
 * Exposes the Better Auth session and quietly signs first-time visitors in as
 * anonymous guests, so they can start playing (and saving) immediately.
 */
export function AccountProvider({ children }: { children: ReactNode }) {
  const { data, isPending, error, refetch } = authClient.useSession();
  const attempted = useRef(false);

  useEffect(() => {
    // Only a successful "no session" answer starts a guest session; a failed
    // lookup (offline, server error) must never replace an existing sign-in.
    if (isPending || data || error || attempted.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    attempted.current = true;
    authClient.signIn
      .anonymous()
      .then(() => refetch())
      .catch(() => {
        // Offline or auth not configured: local play still works.
      });
  }, [isPending, data, error, refetch]);

  useEffect(() => {
    if (data) sync.start();
  }, [data]);

  const u = data?.user as (Account & { isAnonymous?: boolean | null }) | undefined;
  const account: Account | null = u
    ? { id: u.id, name: u.name, email: u.email, isAnonymous: Boolean(u.isAnonymous), image: u.image ?? null }
    : null;

  return <AccountContext value={{ account, pending: isPending, refetch }}>{children}</AccountContext>;
}

export function useAccount() {
  return use(AccountContext);
}
