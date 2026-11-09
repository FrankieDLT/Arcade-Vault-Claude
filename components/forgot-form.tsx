"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AuthCard, Field } from "@/components/auth-ui";
import { useSession } from "@/components/session-provider";
import { authErrorMessage, validateEmail } from "@/lib/auth";
import { withBasePath } from "@/lib/base-path";
import { getSupabase } from "@/lib/supabase/client";

export function ForgotForm() {
  const { status } = useSession();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    setFormError(null);
    const invalid = validateEmail(email) ?? undefined;
    setError(invalid);
    if (invalid) return;

    setBusy(true);
    try {
      const { error: err } = await getSupabase().auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}${withBasePath("/auth/reset/")}`,
        },
      );
      // Same answer whether or not the email has an account (no enumeration).
      // Only rate limit and network problems are worth telling.
      if (
        err &&
        (err.code === "over_email_send_rate_limit" ||
          err.code === "over_request_rate_limit" ||
          !err.code)
      ) {
        setFormError(authErrorMessage(err));
      } else {
        setSent(true);
      }
    } catch (caught) {
      setFormError(
        authErrorMessage({
          message: caught instanceof Error ? caught.message : "",
        }),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard subtitle="PASSWORD RESET">
      {status === "unavailable" ? (
        <div className="form-alert" role="alert">
          Sign in is not available right now.
        </div>
      ) : sent ? (
        <div className="form-info" role="status">
          If an account exists for that email, a reset link is on its way.
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          <p
            className="mono"
            style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 0 }}
          >
            Enter your email and we will send you a link to choose a new
            password.
          </p>
          <Field
            id="forgot-email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            error={error}
            placeholder="player@vault.gg"
            autoComplete="email"
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
            {busy ? "SENDING…" : "SEND RESET LINK"}
          </button>
        </form>
      )}
      <Link href="/auth" className="auth-back">
        Back to sign in
      </Link>
    </AuthCard>
  );
}
