import { Resend } from "resend";
import { validateContact, type ContactResponse } from "@/lib/contact";
import { isRateLimited } from "@/lib/rate-limit";

const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 10 * 60 * 1000;

function respond(body: ContactResponse, status: number) {
  return Response.json(body, { status });
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

// Strip control characters (incl. CR/LF) so the subject cannot be split.
function sanitizeSubjectPart(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return respond({ ok: false, error: "invalid" }, 400);
  }

  // Honeypot: bots fill hidden fields. Pretend success, send nothing.
  if (
    typeof body === "object" &&
    body !== null &&
    typeof (body as Record<string, unknown>).website === "string" &&
    ((body as Record<string, unknown>).website as string).trim() !== ""
  ) {
    return respond({ ok: true }, 200);
  }

  if (isRateLimited(clientIp(request), RATE_LIMIT, RATE_WINDOW_MS)) {
    return respond({ ok: false, error: "rate_limited" }, 429);
  }

  const payload = validateContact(body);
  if (!payload) {
    return respond({ ok: false, error: "invalid" }, 400);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  if (!apiKey || !to) {
    return respond({ ok: false, error: "send_failed" }, 500);
  }

  try {
    const resend = new Resend(apiKey);
    const name = sanitizeSubjectPart(payload.name);
    const { error } = await resend.emails.send({
      from: "Arcade Vault <onboarding@resend.dev>",
      to,
      replyTo: payload.email,
      subject: `[Arcade Vault] Message from ${name}`,
      text: [
        `Name: ${name}`,
        `Email: ${payload.email}`,
        "",
        "Message:",
        payload.message,
      ].join("\n"),
    });
    if (error) {
      return respond({ ok: false, error: "send_failed" }, 500);
    }
  } catch {
    return respond({ ok: false, error: "send_failed" }, 500);
  }

  return respond({ ok: true }, 200);
}
