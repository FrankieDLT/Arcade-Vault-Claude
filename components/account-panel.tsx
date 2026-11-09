"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Field } from "@/components/auth-ui";
import { useSession } from "@/components/session-provider";
import {
  authErrorMessage,
  normalizeUsername,
  validateConfirm,
  validatePassword,
  validateUsername,
} from "@/lib/auth";
import { rememberNextPath } from "@/lib/auth-redirect";
import { getSupabase } from "@/lib/supabase/client";
import type { SessionUser } from "@/lib/types";

export function AccountPanel() {
  const router = useRouter();
  const { user, status } = useSession();

  // Signed-out visitors go to sign in, and come back here afterwards.
  useEffect(() => {
    if (status !== "ready" || user) return;
    rememberNextPath("/account/");
    router.replace("/auth/");
  }, [status, user, router]);

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card account-card">
        <div className="auth-header">
          <h2 className="neon-cyan">YOUR ACCOUNT</h2>
        </div>
        {status === "unavailable" ? (
          <div className="form-alert" role="alert">
            Sign in is not available right now.
          </div>
        ) : user ? (
          <AccountForms user={user} />
        ) : (
          <div className="form-info" role="status">
            Loading…
          </div>
        )}
      </div>
    </div>
  );
}

function AccountForms({ user }: { user: SessionUser }) {
  return (
    <>
      <Field
        id="account-email"
        label="Email"
        value={user.email ?? "Not shared by your sign in provider"}
        disabled
      />
      <UsernameForm user={user} />
      {user.hasPassword && <PasswordForm />}
    </>
  );
}

function UsernameForm({ user }: { user: SessionUser }) {
  const [username, setUsername] = useState(user.name);
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setFormError(null);
    setDone(false);
    const invalid = validateUsername(username) ?? undefined;
    setError(invalid);
    if (invalid) return;

    setBusy(true);
    try {
      const { error: err } = await getSupabase().auth.updateUser({
        data: { username: normalizeUsername(username) },
      });
      if (err) setFormError(authErrorMessage(err));
      else {
        setUsername(normalizeUsername(username));
        setDone(true);
      }
    } catch (caught) {
      setFormError(
        authErrorMessage({
          message: caught instanceof Error ? caught.message : "",
        }),
      );
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} noValidate>
      <Field
        id="account-username"
        label="Username"
        value={username}
        onChange={(v) => {
          setUsername(v);
          setDone(false);
        }}
        error={error}
        autoComplete="username"
        maxLength={32}
      />
      {formError && (
        <div className="form-alert" role="alert">
          {formError}
        </div>
      )}
      {done && (
        <div className="form-info" role="status">
          Username updated.
        </div>
      )}
      <button className="btn" type="submit" disabled={busy}>
        {busy ? "SAVING…" : "SAVE USERNAME"}
      </button>
    </form>
  );
}

function PasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setFormError(null);
    setDone(false);
    const next = {
      password: validatePassword(password) ?? undefined,
      confirm: validateConfirm(password, confirm) ?? undefined,
    };
    setErrors(next);
    if (next.password || next.confirm) return;

    setBusy(true);
    try {
      const { error } = await getSupabase().auth.updateUser({ password });
      if (error) setFormError(authErrorMessage(error));
      else {
        setPassword("");
        setConfirm("");
        setDone(true);
      }
    } catch (caught) {
      setFormError(
        authErrorMessage({
          message: caught instanceof Error ? caught.message : "",
        }),
      );
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} noValidate className="account-section">
      <Field
        id="account-password"
        label="New password"
        type="password"
        value={password}
        onChange={(v) => {
          setPassword(v);
          setDone(false);
        }}
        error={errors.password}
        placeholder="••••••••"
        autoComplete="new-password"
      />
      <Field
        id="account-confirm"
        label="Confirm new password"
        type="password"
        value={confirm}
        onChange={(v) => {
          setConfirm(v);
          setDone(false);
        }}
        error={errors.confirm}
        placeholder="••••••••"
        autoComplete="new-password"
      />
      {formError && (
        <div className="form-alert" role="alert">
          {formError}
        </div>
      )}
      {done && (
        <div className="form-info" role="status">
          Password updated.
        </div>
      )}
      <button className="btn" type="submit" disabled={busy}>
        {busy ? "SAVING…" : "CHANGE PASSWORD"}
      </button>
    </form>
  );
}
