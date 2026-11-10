import { formatDate } from "./format-date";
import { getSupabase } from "./supabase/client";
import type { RoyaltyRow, ScoreRow } from "./types";

// Client use only: getSupabase() is the browser client.

export async function fetchTopScores(
  gameId: string,
  count: number,
): Promise<ScoreRow[]> {
  const { data, error } = await getSupabase()
    .from("scores")
    .select("name, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .limit(count);

  if (error) throw error;

  return data.map((r) => ({
    rank: 0,
    name: r.name,
    score: r.score,
    date: formatDate(new Date(r.created_at).getTime()),
  }));
}

/** Players ranked by the sum of their best score in every game (RPC `royalty_of_games`). */
export async function fetchRoyalty(count: number): Promise<RoyaltyRow[]> {
  const { data, error } = await getSupabase().rpc("royalty_of_games", {
    p_limit: count,
  });

  if (error) throw error;

  return data.map((r) => ({
    rank: r.rank,
    name: r.name,
    total: Number(r.total),
    games: r.games,
    lastPlayed: formatDate(new Date(r.last_at).getTime()),
  }));
}

export interface RecentScore {
  gameId: string;
  name: string;
  score: number;
  createdAt: number;
}

function toRecent(r: {
  game_id: string;
  name: string;
  score: number;
  created_at: string;
}): RecentScore {
  return {
    gameId: r.game_id,
    name: r.name,
    score: r.score,
    createdAt: new Date(r.created_at).getTime(),
  };
}

/** Newest scores across all games. */
export async function fetchLatestScores(count: number): Promise<RecentScore[]> {
  const { data, error } = await getSupabase()
    .from("scores")
    .select("game_id, name, score, created_at")
    .order("created_at", { ascending: false })
    .limit(count);

  if (error) throw error;
  return data.map(toRecent);
}

/** Highest scores across all games created at or after `sinceIso`. */
export async function fetchTopScoresSince(
  sinceIso: string,
  count: number,
): Promise<RecentScore[]> {
  const { data, error } = await getSupabase()
    .from("scores")
    .select("game_id, name, score, created_at")
    .gte("created_at", sinceIso)
    .order("score", { ascending: false })
    .limit(count);

  if (error) throw error;
  return data.map(toRecent);
}

/**
 * Why a save failed (SPEC 13):
 * - `banned`: the account is banned from saving scores (profiles.banned).
 * - `signin`: no valid session (guest or expired).
 * - `other`: anything else (network, validation, server).
 */
export type ScoreSaveFailure = "banned" | "signin" | "other";

export class ScoreSaveError extends Error {
  readonly kind: ScoreSaveFailure;

  constructor(kind: ScoreSaveFailure) {
    super(kind);
    this.name = "ScoreSaveError";
    this.kind = kind;
  }
}

// Postgres insufficient_privilege: what a row level security policy returns.
const RLS_VIOLATION = "42501";

/** Reads the caller's own ban flag. Never cached: a ban or unban applies at once. */
async function isCallerBanned(
  supabase: ReturnType<typeof getSupabase>,
): Promise<boolean> {
  try {
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) return false;
    const { data } = await supabase
      .from("profiles")
      .select("banned")
      .eq("id", uid)
      .maybeSingle();
    return data?.banned === true;
  } catch {
    return false;
  }
}

export async function insertScore(input: {
  gameId: string;
  name: string;
  score: number;
}): Promise<void> {
  const supabase = getSupabase();
  // user_id is filled by the column default auth.uid().
  const { error } = await supabase.from("scores").insert({
    game_id: input.gameId,
    name: input.name.trim().slice(0, 10),
    score: input.score,
  });

  if (!error) return;
  if (error.code === RLS_VIOLATION) {
    throw new ScoreSaveError(
      (await isCallerBanned(supabase)) ? "banned" : "signin",
    );
  }
  throw new ScoreSaveError("other");
}
