"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AuthCard, Field } from "@/components/auth-ui";
import { useSession } from "@/components/session-provider";
import {
  authErrorMessage,
  normalizeUsername,
  validateConfirm,
  validateEmail,
  validatePassword,
  validateUsername,
  type FieldErrors,
} from "@/lib/auth";
import { takeNextPath } from "@/lib/auth-redirect";
import { withBasePath } from "@/lib/base-path";
import { getSupabase } from "@/lib/supabase/client";

type Tab = "in" | "up";

export function AuthForm() {
  const router = useRouter();
  const { user, status, signOut } = useSession();
  const [tab, setTab] = useState<Tab>("in");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const leaving = useRef(false);

  // A signed-in visitor has nothing to do here (also covers the return trip
  // after a successful sign in): go back to the remembered page, else "/".
  useEffect(() => {
    if (!user || leaving.current) return;
    leaving.current = true;
    router.replace(takeNextPath());
  }, [user, router]);

  // Back from Google or GitHub: the URL carries a code (or an error) and the
  // Supabase client turns it into a session. Show a waiting state until then.
  const [returning, setReturning] = useState(false);
  useEffect(() => {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    if (url.searchParams.has("error") || hash.has("error")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormError("Sign in was cancelled or failed. Try again.");
      return;
    }
    if (!url.searchParams.has("code") && !hash.has("access_token")) return;
    setReturning(true);
    // No session after 10 s: the exchange failed. Show the form again.
    const t = setTimeout(() => {
      setReturning(false);
      setFormError("Could not sign you in. Try again.");
    }, 10000);
    return () => clearTimeout(t);
  }, []);

  const oauth = async (provider: "google" | "github") => {
    if (busy) return;
    setBusy(true);
    setFormError(null);
    setInfo(null);
    try {
      const { error } = await getSupabase().auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}${withBasePath("/auth/")}`,
        },
      });
      // On success the browser is already leaving for the provider.
      if (error) {
        setFormError(authErrorMessage(error));
        setBusy(false);
      }
    } catch (err) {
      setFormError(
        authErrorMessage({ message: err instanceof Error ? err.message : "" }),
      );
      setBusy(false);
    }
  };

  const switchTab = (next: Tab) => {
    if (busy) return;
    setTab(next);
    setErrors({});
    setFormError(null);
    setInfo(null);
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setFormError(null);
    setInfo(null);

    const next: FieldErrors = {};
    if (tab === "up") {
      next.username = validateUsername(username) ?? undefined;
    }
    next.email = validateEmail(email) ?? undefined;
    if (tab === "up") {
      next.password = validatePassword(password) ?? undefined;
      next.confirm = validateConfirm(password, confirm) ?? undefined;
    } else if (!password) {
      next.password = "Enter your password.";
    }
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setBusy(true);
    try {
      const auth = getSupabase().auth;
      if (tab === "in") {
        const { error } = await auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) setFormError(authErrorMessage(error));
        // On success the session listener updates `user` and the effect leaves.
      } else {
        const { data, error } = await auth.signUp({
          email: email.trim(),
          password,
          options: { data: { username: normalizeUsername(username) } },
        });
        if (error) {
          setFormError(authErrorMessage(error));
        } else if (!data.session && data.user?.identities?.length === 0) {
          // Confirmation on: Supabase hides repeated signups (fake user, no email).
          setFormError(
            "An account with this email already exists. Sign in, or use Google / GitHub.",
          );
        } else if (!data.session) {
          // Email confirmation is on in the Dashboard: no session yet.
          setInfo("Account created. Check your email to confirm it.");
        }
      }
    } catch (err) {
      setFormError(
        authErrorMessage({ message: err instanceof Error ? err.message : "" }),
      );
    } finally {
      setBusy(false);
    }
  };

  const playAsGuest = async () => {
    await signOut();
    router.push("/");
  };

  const unavailable = status === "unavailable";

  return (
    <AuthCard subtitle="SYSTEM ACCESS · v2.6">
      {unavailable ? (
        <div className="form-alert" role="alert">
          Sign in is not available right now.
        </div>
      ) : returning ? (
        <div className="form-info" role="status">
          Signing you in…
        </div>
      ) : (
        <>
          <div className="auth-tabs">
            <button
              type="button"
              className={tab === "in" ? "on" : ""}
              onClick={() => switchTab("in")}
            >
              SIGN IN
            </button>
            <button
              type="button"
              className={tab === "up" ? "on" : ""}
              onClick={() => switchTab("up")}
            >
              CREATE ACCOUNT
            </button>
          </div>

          {/* noValidate: lib/auth.ts validates, with plain English messages. */}
          <form onSubmit={submit} noValidate>
            {tab === "up" && (
              <Field
                id="auth-username"
                label="Username"
                value={username}
                onChange={setUsername}
                error={errors.username}
                placeholder="px_kai"
                autoComplete="username"
                maxLength={32}
              />
            )}
            <Field
              id="auth-email"
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              error={errors.email}
              placeholder="player@vault.gg"
              autoComplete="email"
            />
            <Field
              id="auth-password"
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              error={errors.password}
              placeholder="••••••••"
              autoComplete={tab === "in" ? "current-password" : "new-password"}
            />
            {tab === "in" && (
              <Link href="/auth/forgot" className="forgot-link">
                Forgot password?
              </Link>
            )}
            {tab === "up" && (
              <Field
                id="auth-confirm"
                label="Confirm password"
                type="password"
                value={confirm}
                onChange={setConfirm}
                error={errors.confirm}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            )}

            {formError && (
              <div className="form-alert" role="alert">
                {formError}
              </div>
            )}
            {info && (
              <div className="form-info" role="status">
                {info}
              </div>
            )}

            <button
              className="btn lg"
              type="submit"
              disabled={busy}
              style={{ width: "100%", marginTop: 8 }}
            >
              {busy
                ? "WORKING…"
                : tab === "in"
                  ? "ENTER THE VAULT"
                  : "CREATE AND PLAY"}
            </button>
          </form>
        </>
      )}

      <button
        type="button"
        className="btn ghost"
        style={{ width: "100%", marginTop: 10 }}
        onClick={playAsGuest}
      >
        PLAY AS GUEST
      </button>

      {!unavailable && !returning && (
        <>
          <div className="auth-divider">OR CONTINUE WITH</div>
          <div className="social">
            <button
              className="btn ghost"
              type="button"
              disabled={busy}
              onClick={() => oauth("google")}
            >
              ◆ GOOGLE
            </button>
            <button
              className="btn ghost"
              type="button"
              disabled={busy}
              onClick={() => oauth("github")}
            >
              ▣ GITHUB
            </button>
          </div>
        </>
      )}

      <div
        style={{
          marginTop: 18,
          textAlign: "center",
          fontSize: 11,
          color: "var(--ink-faint)",
          letterSpacing: "0.1em",
        }}
      >
        BY ENTERING YOU ACCEPT THE ARCADE HALL TERMS
      </div>
    </AuthCard>
  );
}
