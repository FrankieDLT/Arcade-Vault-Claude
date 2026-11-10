"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchRoyalty, fetchTopScores } from "@/lib/scores-db";
import type { RoyaltyRow, ScoreRow } from "@/lib/types";

export type ScoresStatus = "loading" | "ready" | "error";

/**
 * Top scores stored in Supabase for `gameId`. No mock rows: until the fetch
 * resolves (or if it fails) `rows` is empty and `status` says why.
 */
export function useTopScores(
  gameId: string,
  count: number,
): { rows: ScoreRow[]; status: ScoresStatus } {
  // Results are tagged with their game so a response for a previous game is
  // never shown for the current one.
  const [result, setResult] = useState<{
    gameId: string;
    count: number;
    rows: ScoreRow[];
    failed: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTopScores(gameId, count)
      .then((rows) => {
        if (!cancelled) setResult({ gameId, count, rows, failed: false });
      })
      .catch(() => {
        if (!cancelled) setResult({ gameId, count, rows: [], failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [gameId, count]);

  return useMemo(() => {
    if (!result || result.gameId !== gameId || result.count !== count) {
      return { rows: [], status: "loading" as const };
    }
    return {
      rows: result.rows.map((r, i) => ({ ...r, rank: i + 1 })),
      status: result.failed ? ("error" as const) : ("ready" as const),
    };
  }, [result, gameId, count]);
}

/** Royalty of Games ranking. Same loading / ready / error contract as `useTopScores`. */
export function useRoyalty(count: number): {
  rows: RoyaltyRow[];
  status: ScoresStatus;
} {
  const [result, setResult] = useState<{
    count: number;
    rows: RoyaltyRow[];
    failed: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchRoyalty(count)
      .then((rows) => {
        if (!cancelled) setResult({ count, rows, failed: false });
      })
      .catch(() => {
        if (!cancelled) setResult({ count, rows: [], failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [count]);

  return useMemo(() => {
    if (!result || result.count !== count) {
      return { rows: [], status: "loading" as const };
    }
    return {
      rows: result.rows,
      status: result.failed ? ("error" as const) : ("ready" as const),
    };
  }, [result, count]);
}

export function scoresStatusMessage(status: ScoresStatus): string {
  return status === "loading"
    ? "LOADING..."
    : status === "error"
      ? "SCORES UNAVAILABLE"
      : "NO SCORES YET";
}

export function Leaderboard({
  gameId,
  count = 10,
}: {
  gameId: string;
  count?: number;
}) {
  const { rows, status } = useTopScores(gameId, count);

  return (
    <div className="leaderboard">
      <h3>TOP SCORES</h3>
      {rows.length === 0 && (
        <div className="lb-row">
          <div className="pl">{scoresStatusMessage(status)}</div>
        </div>
      )}
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
