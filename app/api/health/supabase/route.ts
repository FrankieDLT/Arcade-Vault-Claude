export type SupabaseHealth =
  | { ok: true }
  | { ok: false; error: "missing_env" | "unreachable" | "invalid_key" };

const TIMEOUT_MS = 5000;

function respond(body: SupabaseHealth, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

// Dev-only probe: checks the Supabase URL and publishable key against the Auth API.
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new Response(null, { status: 404 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return respond({ ok: false, error: "missing_env" }, 500);

  let res: Response;
  try {
    res = await fetch(`${url.replace(/\/+$/, "")}/auth/v1/settings`, {
      headers: { apikey: key },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return respond({ ok: false, error: "unreachable" }, 503);
  }

  if (res.status >= 500) return respond({ ok: false, error: "unreachable" }, 503);
  if (res.status === 401 || res.status === 403) {
    return respond({ ok: false, error: "invalid_key" }, 401);
  }
  return respond({ ok: true }, 200);
}
