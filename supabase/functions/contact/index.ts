// Contact form backend (Deno). Replaces the old Next.js route handler, which cannot run on GitHub Pages.
// Secrets (Dashboard > Edge Functions > Secrets): RESEND_API_KEY, CONTACT_TO_EMAIL.

const ALLOWED_ORIGINS = [
  "https://frankiedlt.github.io",
  "http://localhost:3000",
];

const LIMITS = { name: 60, email: 254, message: 2000 } as const;
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ErrorCode = "invalid" | "rate_limited" | "send_failed";

// Best-effort, in-memory: per function instance, resets on cold start.
const hits = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

// Strip control characters (incl. CR/LF) so the subject cannot be split.
function sanitizeSubjectPart(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
}

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function respond(
  body: { ok: true } | { ok: false; error: ErrorCode },
  status: number,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function validate(raw: Record<string, unknown>) {
  const { name, email, message } = raw;
  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof message !== "string"
  ) {
    return null;
  }
  const payload = { name: name.trim(), email: email.trim(), message: message.trim() };
  if (!payload.name || !payload.email || !payload.message) return null;
  if (payload.name.length > LIMITS.name) return null;
  if (payload.email.length > LIMITS.email) return null;
  if (payload.message.length > LIMITS.message) return null;
  if (!EMAIL_RE.test(payload.email)) return null;
  return payload;
}

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("origin");

  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return respond({ ok: false, error: "invalid" }, 405, origin);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respond({ ok: false, error: "invalid" }, 400, origin);
  }
  if (typeof body !== "object" || body === null) {
    return respond({ ok: false, error: "invalid" }, 400, origin);
  }
  const raw = body as Record<string, unknown>;

  // Honeypot: bots fill hidden fields. Pretend success, send nothing.
  if (typeof raw.website === "string" && raw.website.trim() !== "") {
    return respond({ ok: true }, 200, origin);
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(ip)) {
    return respond({ ok: false, error: "rate_limited" }, 429, origin);
  }

  const payload = validate(raw);
  if (!payload) return respond({ ok: false, error: "invalid" }, 400, origin);

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const to = Deno.env.get("CONTACT_TO_EMAIL");
  if (!apiKey || !to) return respond({ ok: false, error: "send_failed" }, 500, origin);

  try {
    const name = sanitizeSubjectPart(payload.name);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Arcade Vault <onboarding@resend.dev>",
        to,
        reply_to: payload.email,
        subject: `[Arcade Vault] Message from ${name}`,
        text: [
          `Name: ${name}`,
          `Email: ${payload.email}`,
          "",
          "Message:",
          payload.message,
        ].join("\n"),
      }),
    });
    if (!res.ok) return respond({ ok: false, error: "send_failed" }, 500, origin);
  } catch {
    return respond({ ok: false, error: "send_failed" }, 500, origin);
  }

  return respond({ ok: true }, 200, origin);
});
