"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CONTACT_LIMITS, type ContactResponse } from "@/lib/contact";
import { getSupabase } from "@/lib/supabase/client";

type ErrorCode = Extract<ContactResponse, { ok: false }>["error"];

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  invalid: "Please check your details and try again.",
  rate_limited: "Too many messages. Please wait a few minutes and try again.",
  send_failed: "We couldn't send your message. Please try again later.",
};

const EMPTY = { name: "", email: "", message: "", website: "" };

export function ContactForm() {
  const [form, setForm] = useState(EMPTY);
  const [sentName, setSentName] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
    };
  }, []);

  const triggerShake = () => {
    setShake(true);
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    shakeTimer.current = setTimeout(() => setShake(false), 400);
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (sending) return;
    setError(null);

    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      triggerShake();
      return;
    }

    setSending(true);
    try {
      // Supabase Edge Function `contact` (GitHub Pages has no server routes).
      const { data, error: fnError } =
        await getSupabase().functions.invoke<ContactResponse>("contact", {
          body: form,
        });

      if (!fnError && data?.ok) {
        setSentName(form.name.trim());
        return;
      }

      // On a non-2xx reply the body (our error code) is in `error.context`.
      let body: ContactResponse | null = data ?? null;
      const ctx = (fnError as { context?: Response } | null)?.context;
      if (ctx && typeof ctx.json === "function") {
        body = (await ctx.json().catch(() => null)) as ContactResponse | null;
      }
      setError(ERROR_MESSAGES[body && !body.ok ? body.error : "send_failed"]);
    } catch {
      setError(ERROR_MESSAGES.send_failed);
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setSentName(null);
    setError(null);
    setForm(EMPTY);
  };

  return (
    <form
      className={"contact-form" + (shake ? " shake" : "")}
      onSubmit={onSubmit}
      noValidate
    >
      {sentName === null ? (
        <>
          <div className="field">
            <label htmlFor="contact-name">NAME</label>
            <input
              id="contact-name"
              name="name"
              value={form.name}
              maxLength={CONTACT_LIMITS.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="px_kai"
              autoComplete="name"
            />
          </div>
          <div className="field">
            <label htmlFor="contact-email">EMAIL</label>
            <input
              id="contact-email"
              name="email"
              type="email"
              value={form.email}
              maxLength={CONTACT_LIMITS.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="player@vault.gg"
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label htmlFor="contact-message">MESSAGE</label>
            <textarea
              id="contact-message"
              name="message"
              rows={5}
              value={form.message}
              maxLength={CONTACT_LIMITS.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Tell us what's on your mind…"
            ></textarea>
          </div>

          {/* Honeypot: invisible to people, bots tend to fill it. */}
          <div
            aria-hidden="true"
            className="absolute -left-[9999px] h-px w-px overflow-hidden"
          >
            <label htmlFor="contact-website">Website</label>
            <input
              id="contact-website"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="pixel mb-3 border border-magenta px-3 py-2 text-[9px] leading-relaxed tracking-widest text-magenta"
            >
              ✖ {error}
            </div>
          )}

          <button
            className="btn xl press disabled:cursor-wait disabled:opacity-60"
            type="submit"
            style={{ width: "100%" }}
            disabled={sending}
          >
            {sending ? "▶  SENDING…" : "▶  SEND MESSAGE"}
          </button>
        </>
      ) : (
        <div className="terminal-success">
          <div className="term-bar">
            <span className="dot r"></span>
            <span className="dot y"></span>
            <span className="dot g"></span>
            <span className="term-title">VAULT-OS // TERMINAL</span>
          </div>
          <div className="term-body">
            <div className="line">
              <span className="prompt">vault@arcade:~$</span> ./send_message
              --to=team
            </div>
            <div className="line dim">[OK] Connecting to server…</div>
            <div className="line dim">[OK] Validating content…</div>
            <div className="line dim">[OK] Transmitting packet…</div>
            <div className="line success">
              &gt; MESSAGE RECEIVED. WE&apos;LL GET BACK TO YOU SOON. THANKS,{" "}
              {sentName.toUpperCase()}.<span className="caret">_</span>
            </div>
            <div style={{ marginTop: 18 }}>
              <button className="btn ghost" type="button" onClick={reset}>
                SEND ANOTHER MESSAGE
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
