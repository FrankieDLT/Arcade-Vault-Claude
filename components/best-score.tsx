"use client";

import { useEffect, useState } from "react";
import { fetchTopScores } from "@/lib/scores-db";

/** Highest Supabase score for `gameId`, or an em dash when there is none. */
export function BestScore({ gameId }: { gameId: string }) {
  const [best, setBest] = useState<{ gameId: string; score: number } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    fetchTopScores(gameId, 1)
      .then((rows) => {
        if (!cancelled && rows[0]) setBest({ gameId, score: rows[0].score });
      })
      .catch(() => {
        // Keep the dash.
      });
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  return (
    <>
      {best && best.gameId === gameId
        ? best.score.toLocaleString("en-US")
        : "—"}
    </>
  );
}
