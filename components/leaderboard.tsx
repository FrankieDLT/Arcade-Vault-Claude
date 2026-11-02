"use client";

import { useEffect, useMemo, useState } from "react";
import { readScores } from "@/lib/storage";
import type { SavedScore, ScoreRow } from "@/lib/types";

function formatDate(ms: number): string {
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/**
 * Merges seeded rows with the scores saved in localStorage for `gameId`.
 * The first render (server and client) returns the seeded rows only;
 * saved scores are merged after mount to avoid hydration mismatches.
 */
export function useMergedScores(
  gameId: string,
  seeded: ScoreRow[],
  count: number,
): ScoreRow[] {
  const [saved, setSaved] = useState<SavedScore[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(readScores().filter((s) => s.game === gameId));
  }, [gameId]);

  return useMemo(() => {
    const extra: ScoreRow[] = saved.map((s) => ({
      rank: 0,
      name: s.name,
      score: s.score,
      date: formatDate(s.at),
    }));
    return [...seeded, ...extra]
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [saved, seeded, count]);
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
            "lb-row" + (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")
          }
        >
          <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
          <div className="pl">
            {r.name}
            <div
              style={{ fontSize: 10, color: "var(--ink-faint)", letterSpacing: "0.1em" }}
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
