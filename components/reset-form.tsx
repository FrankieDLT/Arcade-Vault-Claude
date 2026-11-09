"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AuthCard, Field } from "@/components/auth-ui";
import {
  authErrorMessage,
  validateConfirm,
  validatePassword,
  type FieldErrors,
} from "@/lib/auth";
import { getSupabase } from "@/lib/supabase/client";

type RecoveryState = "checking" | "ready" | "invalid";

export function ResetForm() {
  const router = useRouter();
  const [state, setState] = useState<RecoveryState>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The email link brings a code (or an error). The Supabase client turns the
  // code into a recovery session; wait for it before showing the form.
  useEffect(() => {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    if (url.searchParams.has("error") || hash.has("error")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState("invalid");
      return;
    }
    const hasCode =
      url.searchParams.has("code") ||
      hash.has("access_token") ||
      hash.has("token_hash");

    let supabase;
    try {
      supabase = getSupabase();
    } catch {
      setState("invalid");
      return;
    }

    // No awaits inside the callback.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === "PASSWORD_RECOVERY" ||
        (session && event !== "SIGNED_OUT")
      ) {
        setState("ready");
      } else if (event === "INITIAL_SESSION" && !session && !hasCode) {
        setState("invalid");
      }
    });
    // Code never became a session: the link is bad or already used.
    const timer = hasCode
      ? setTimeout(
          () => setState((s) => (s === "checking" ? "invalid" : s)),
          8000,
        )
      : undefined;

    return () => {
      data.subscription.unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setFormError(null);
    const next: FieldErrors = {
      password: validatePassword(password) ?? undefined,
      confirm: validateConfirm(password, confirm) ?? undefined,
    };
    setErrors(next);
    if (next.password || next.confirm) return;

    setBusy(true);
    try {
      const { error } = await getSupabase().auth.updateUser({ password });
      if (error) {
        setFormError(authErrorMessage(error));
      } else {
        router.replace("/");
        return;
      }
    } catch (err) {
      setFormError(
        authErrorMessage({ message: err instanceof Error ? err.message : "" }),
      );
    }
    setBusy(false);
  };

  return (
    <AuthCard subtitle="CHOOSE A NEW PASSWORD">
      {state === "checking" && (
        <div className="form-info" role="status">
          Checking your reset link…
        </div>
      )}

      {state === "invalid" && (
        <>
          <div className="form-alert" role="alert">
            This reset link is invalid or has expired.
          </div>
          <Link
            href="/auth/forgot"
            className="btn lg"
            style={{ width: "100%" }}
          >
            GET A NEW LINK
          </Link>
        </>
      )}

      {state === "ready" && (
        <form onSubmit={submit} noValidate>
          <Field
            id="reset-password"
            label="New password"
            type="password"
            value={password}
            onChange={setPassword}
            error={errors.password}
            placeholder="••••••••"
            autoComplete="new-password"
          />
          <Field
            id="reset-confirm"
            label="Confirm new password"
            type="password"
            value={confirm}
            onChange={setConfirm}
            error={errors.confirm}
            placeholder="••••••••"
            autoComplete="new-password"
          />
          {formError && (
            <div className="form-alert" role="alert">
              {formError}
            </div>
          )}
          <button
            className="btn lg"
            type="submit"
            disabled={busy}
            style={{ width: "100%", marginTop: 8 }}
          >
            {busy ? "SAVING…" : "SAVE NEW PASSWORD"}
          </button>
        </form>
      )}
    </AuthCard>
  );
}
