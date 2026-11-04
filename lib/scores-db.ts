import { formatDate } from "./format-date";
import { getSupabase } from "./supabase/client";
import type { ScoreRow } from "./types";

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

export async function insertScore(input: {
  gameId: string;
  name: string;
  score: number;
}): Promise<void> {
  const { error } = await getSupabase()
    .from("scores")
    .insert({
      game_id: input.gameId,
      name: input.name.trim().slice(0, 10),
      score: input.score,
    });

  if (error) throw error;
}
