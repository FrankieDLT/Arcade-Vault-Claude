import { getSupabase } from "./supabase/client";

// Client use only: getSupabase() is the browser client.
// Likes live in `game_likes` (no client access) and move only through the RPCs
// `get_game_likes` (anon + authenticated) and `toggle_game_like` (authenticated), SPEC 26.

export type GameLikes = { count: number; liked: boolean };

export type LikesErrorKind = "signin" | "unknown_game" | "network";

export class LikesError extends Error {
  readonly kind: LikesErrorKind;

  constructor(kind: LikesErrorKind) {
    super(kind);
    this.name = "LikesError";
    this.kind = kind;
  }
}

/** Maps a PostgREST error from an RPC to a LikesError kind. */
function toLikesError(error: { message?: string; code?: string }): LikesError {
  const message = error.message ?? "";
  // not_authenticated, or EXECUTE denied for anon (42501).
  if (message.includes("not_authenticated") || error.code === "42501") {
    return new LikesError("signin");
  }
  if (message.includes("unknown_game")) return new LikesError("unknown_game");
  return new LikesError("network");
}

function parseLikes(data: unknown): GameLikes {
  const row = data as { count?: unknown; liked?: unknown } | null;
  if (!row || typeof row.count !== "number" || typeof row.liked !== "boolean") {
    throw new LikesError("network");
  }
  return { count: row.count, liked: row.liked };
}

/** Public count of a game and whether the signed-in account liked it (false for a guest). */
export async function fetchGameLikes(gameId: string): Promise<GameLikes> {
  const { data, error } = await getSupabase().rpc("get_game_likes", {
    p_game_id: gameId,
  });
  if (error) throw toLikesError(error);
  return parseLikes(data);
}

/** Adds the like when absent, removes it when present. Signed-in accounts only. */
export async function toggleGameLike(gameId: string): Promise<GameLikes> {
  const { data, error } = await getSupabase().rpc("toggle_game_like", {
    p_game_id: gameId,
  });
  if (error) throw toLikesError(error);
  return parseLikes(data);
}

/** Compact count: 999 stays 999, 1,234 becomes 1.2K, 1,200,000 becomes 1.2M. */
export function formatLikes(count: number): string {
  if (count < 1000) return String(count);
  const compact = (n: number, unit: string) =>
    `${(Math.floor(n * 10) / 10).toFixed(1).replace(/\.0$/, "")}${unit}`;
  if (count < 1_000_000) return compact(count / 1000, "K");
  return compact(count / 1_000_000, "M");
}
