export const CONTACT_LIMITS = {
  name: 60,
  email: 254,
  message: 2000,
} as const;

export interface ContactPayload {
  name: string;
  email: string;
  message: string;
  website: string; // honeypot, must be "" for real users
}

export type ContactResponse =
  | { ok: true }
  | { ok: false; error: "invalid" | "rate_limited" | "send_failed" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Trims and validates the raw request body.
 * Returns the cleaned payload, or `null` on any failure.
 * `website` (honeypot) is allowed to be empty or non-empty; the route decides.
 */
export function validateContact(input: unknown): ContactPayload | null {
  if (typeof input !== "object" || input === null) return null;
  const raw = input as Record<string, unknown>;

  const { name, email, message } = raw;
  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof message !== "string"
  ) {
    return null;
  }
  const website = typeof raw.website === "string" ? raw.website.trim() : "";
  if (raw.website !== undefined && typeof raw.website !== "string") return null;

  const payload: ContactPayload = {
    name: name.trim(),
    email: email.trim(),
    message: message.trim(),
    website,
  };

  if (!payload.name || !payload.email || !payload.message) return null;
  if (payload.name.length > CONTACT_LIMITS.name) return null;
  if (payload.email.length > CONTACT_LIMITS.email) return null;
  if (payload.message.length > CONTACT_LIMITS.message) return null;
  if (!EMAIL_RE.test(payload.email)) return null;

  return payload;
}
