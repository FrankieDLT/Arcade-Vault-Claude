"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchTopScores } from "@/lib/scores-db";
import type { ScoreRow } from "@/lib/types";

/**
 * Merges seeded rows with the top scores stored in Supabase for `gameId`.
 * The first render (server and client) returns the seeded rows only;
 * database rows are merged after mount to avoid hydration mismatches.
 * If the fetch fails, the seeded rows are kept.
 */
export function useMergedScores(
  gameId: string,
  seeded: ScoreRow[],
  count: number,
): ScoreRow[] {
  // Remote rows are tagged with their game so a response for a previous
  // game is never merged into the current one.
  const [remote, setRemote] = useState<{ gameId: string; rows: ScoreRow[] }>({
    gameId: "",
    rows: [],
  });

  useEffect(() => {
    let cancelled = false;
    fetchTopScores(gameId, count)
      .then((rows) => {
        if (!cancelled) setRemote({ gameId, rows });
      })
      .catch(() => {
        // Keep the seeded rows.
      });
    return () => {
      cancelled = true;
    };
  }, [gameId, count]);

  return useMemo(() => {
    const extra = remote.gameId === gameId ? remote.rows : [];
    return [...seeded, ...extra]
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [remote, gameId, seeded, count]);
}

export function Leaderboard({
  gameId,
  seeded,
  count = 10,
}: {
  gameId: string;
  seeded: ScoreRow[];
  count?: number;
}) {
  const rows = useMergedScores(gameId, seeded, count);

  return (
    <div className="leaderboard">
      <h3>TOP SCORES</h3>
      {rows.map((r, i) => (
        <div
          key={`${r.name}-${r.score}-${i}`}
          className={
            "lb-row" +
            (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")
          }
        >
          <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
          <div className="pl">
            {r.name}
            <div
              style={{
                fontSize: 10,
                color: "var(--ink-faint)",
                letterSpacing: "0.1em",
              }}
            >
              {r.date}
            </div>
          </div>
          <div className="sc">{r.score.toLocaleString("en-US")}</div>
        </div>
      ))}
    </div>
  );
}
