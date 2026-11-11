"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchCredits } from "@/lib/pins-db";
import { useSession } from "./session-provider";

interface CreditsContextValue {
  /** Own credit balance. 0 for guests. */
  balance: number;
  /** "loading" while the first read for a signed-in account is running. */
  status: "loading" | "ready";
  /** Reads the balance again from Supabase. */
  refresh: () => Promise<void>;
  /** Sets the balance from an RPC result without another read. */
  setBalance: (balance: number) => void;
}

const CreditsContext = createContext<CreditsContextValue | null>(null);

export function CreditsProvider({ children }: { children: ReactNode }) {
  const { user, status: sessionStatus } = useSession();
  const signedIn = user !== null;
  const [balance, setBalance] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setBalance(await fetchCredits());
    } catch {
      // Keep the last known balance: the nav must never break on a failed read.
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    let cancelled = false;
    if (!signedIn) {
      // Guest or sign out: nothing to load, balance is 0.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBalance(0);
      setLoaded(true);
      return;
    }
    setLoaded(false);
    fetchCredits()
      .then((b) => {
        if (!cancelled) setBalance(b);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn, sessionStatus]);

  const value = useMemo<CreditsContextValue>(
    () => ({
      balance,
      status: loaded ? "ready" : "loading",
      refresh,
      setBalance,
    }),
    [balance, loaded, refresh],
  );

  return <CreditsContext value={value}>{children}</CreditsContext>;
}

export function useCredits(): CreditsContextValue {
  const ctx = useContext(CreditsContext);
  if (!ctx) throw new Error("useCredits must be used within a CreditsProvider");
  return ctx;
}
