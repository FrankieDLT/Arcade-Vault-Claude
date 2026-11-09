"use client";

import type { User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { deriveUsername } from "@/lib/auth";
import { getSupabase } from "@/lib/supabase/client";
import type { AuthProvider, SessionUser } from "@/lib/types";

interface SessionContextValue {
  user: SessionUser | null;
  /**
   * "loading" until the first session read resolves (the server render and the
   * first client render are always "loading"). "unavailable" when the Supabase
   * client cannot be created (missing env vars): the site then acts as guest.
   */
  status: "loading" | "ready" | "unavailable";
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function toProvider(value: unknown): AuthProvider {
  return value === "google" || value === "github" ? value : "email";
}

/** Builds the app's SessionUser from a Supabase user. */
export function toSessionUser(user: User): SessionUser {
  const email = user.email ?? null;
  const providers = user.app_metadata?.providers;
  return {
    name: deriveUsername(user.user_metadata ?? {}, email),
    email,
    provider: toProvider(user.app_metadata?.provider),
    hasPassword:
      user.identities?.some((i) => i.provider === "email") ??
      (Array.isArray(providers) && providers.includes("email")),
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  // Render the guest state on the server and first client render;
  // the session is read after mount to avoid hydration mismatches.
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] =
    useState<SessionContextValue["status"]>("loading");

  useEffect(() => {
    let supabase;
    try {
      supabase = getSupabase();
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("unavailable");
      return;
    }

    // Fires INITIAL_SESSION on subscribe, then every sign in, sign out,
    // token refresh and user update. No awaits inside the callback.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? toSessionUser(session.user) : null);
      setStatus("ready");
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    try {
      await getSupabase().auth.signOut();
    } catch {
      // Nothing to end when the client is unavailable.
    }
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, status, signOut }),
    [user, status, signOut],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
