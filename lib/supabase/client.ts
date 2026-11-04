import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Browser-only Supabase client. Import it from client components only.
let client: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
  if (client) return client;

  // Each NEXT_PUBLIC_ variable must be read with its literal name so Next.js can inline it.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) throw new Error("Missing env var NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing env var NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  client = createBrowserClient(url, key);
  return client;
}
