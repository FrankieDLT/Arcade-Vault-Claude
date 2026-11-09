// Framework-free helpers for sign in, register and account pages (SPEC 13).
// No react, next or @supabase imports: Supabase errors arrive as plain objects.

export interface FieldErrors {
  [field: string]: string | undefined;
}

export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 8;
const EMAIL_MAX = 254;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = new RegExp(`^[A-Za-z0-9_-]{1,${USERNAME_MAX}}$`);

/** Trimmed and uppercase: the form a username is stored and shown in. */
export function normalizeUsername(v: string): string {
  return v.trim().toUpperCase();
}

/** 1-20 chars, A-Z a-z 0-9 _ -. Returns an error sentence, or null when valid. */
export function validateUsername(v: string): string | null {
  const value = v.trim();
  if (!value) return "Enter a username.";
  if (value.length > USERNAME_MAX) {
    return `Use at most ${USERNAME_MAX} characters.`;
  }
  if (!USERNAME_RE.test(value)) return "Use letters, numbers, _ or - only.";
  return null;
}

export function validateEmail(v: string): string | null {
  const value = v.trim();
  if (!value) return "Enter your email.";
  if (value.length > EMAIL_MAX || !EMAIL_RE.test(value)) {
    return "Enter a valid email.";
  }
  return null;
}

/** At least 8 chars. */
export function validatePassword(v: string): string | null {
  if (!v) return "Enter a password.";
  if (v.length < PASSWORD_MIN) {
    return `Use at least ${PASSWORD_MIN} characters.`;
  }
  return null;
}

export function validateConfirm(pw: string, confirm: string): string | null {
  if (!confirm) return "Repeat the password.";
  if (pw !== confirm) return "Passwords do not match.";
  return null;
}

/** Uppercase, only A-Z 0-9 _ -, cut to USERNAME_MAX chars. May return "". */
function sanitizeName(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, USERNAME_MAX);
}

/**
 * Username for a Supabase user: `username` metadata first, then the provider
 * profile name (`full_name`, `name`, `user_name`), then the email prefix.
 * A candidate that is empty after cleaning is skipped. Falls back to PLAYER1.
 * Not written back to Supabase.
 */
export function deriveUsername(
  meta: Record<string, unknown>,
  email: string | null,
): string {
  const candidates: unknown[] = [
    meta.username,
    meta.full_name,
    meta.name,
    meta.user_name,
    email ? email.split("@")[0] : null,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const name = sanitizeName(candidate);
    if (name) return name;
  }
  return "PLAYER1";
}

/**
 * Returns `path` only when it is a same-site path ("/x", not "//x", not
 * "/\x", not an /auth page). Anything else gives "/".
 */
export function safeNextPath(path: string | null | undefined): string {
  if (typeof path !== "string") return "/";
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  // Backslashes, whitespace and control characters are read as "//" by some browsers.
  if (/[\\\s\u0000-\u001f\u007f]/.test(path)) return "/";
  if (/^\/auth(?:[/?#]|$)/.test(path)) return "/";
  return path;
}

const GENERIC_ERROR = "Something went wrong. Try again.";

/** Maps a Supabase auth error ({ code?, message }) to one plain English sentence. */
export function authErrorMessage(err: {
  code?: string;
  message: string;
}): string {
  switch (err.code) {
    case "invalid_credentials":
      return "Wrong email or password.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists.";
    case "email_address_invalid":
      return "Enter a valid email.";
    case "email_not_confirmed":
      return "Confirm your email first. Check your inbox.";
    case "weak_password":
      return `Password is too weak. Use at least ${PASSWORD_MIN} characters.`;
    case "over_request_rate_limit":
      return "Too many attempts. Try again in a few minutes.";
    case "over_email_send_rate_limit":
      return "Too many emails sent. Try again in a few minutes.";
    case "same_password":
      return "The new password must be different from the old one.";
    case "provider_disabled":
    case "validation_failed":
      return "This sign in method is not available yet.";
  }

  const message = err.message ?? "";
  if (/failed to fetch|network|load failed/i.test(message)) {
    return "Network error. Check your connection and try again.";
  }
  if (/invalid login credentials/i.test(message)) {
    return "Wrong email or password.";
  }
  if (/already registered/i.test(message)) {
    return "An account with this email already exists.";
  }
  return GENERIC_ERROR;
}
