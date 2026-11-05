"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GAMES } from "@/lib/games";
import {
  fetchLatestScores,
  fetchTopScoresSince,
  type RecentScore,
} from "@/lib/scores-db";

const fmt = (n: number) => n.toLocaleString("en-US");
const game = (id: string) => GAMES.find((g) => g.id === id);

function ago(ms: number): string {
  const min = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  if (min < 1440) return `${Math.floor(min / 60)} h ago`;
  return `${Math.floor(min / 1440)} d ago`;
}

function startOfToday(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Best score per player name, highest first. */
function topPlayers(rows: RecentScore[], count: number): RecentScore[] {
  const best = new Map<string, RecentScore>();
  for (const r of rows) {
    const cur = best.get(r.name);
    if (!cur || r.score > cur.score) best.set(r.name, r);
  }
  return [...best.values()].sort((a, b) => b.score - a.score).slice(0, count);
}

export function LiveActivity() {
  const [latest, setLatest] = useState<RecentScore[] | null>(null);
  const [today, setToday] = useState<RecentScore[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchLatestScores(7)
      .then((rows) => {
        if (!cancelled) setLatest(rows);
      })
      .catch(() => {
        if (!cancelled) setLatest([]);
      });
    fetchTopScoresSince(startOfToday(), 50)
      .then((rows) => {
        if (!cancelled) setToday(topPlayers(rows, 5));
      })
      .catch(() => {
        if (!cancelled) setToday([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="activity-grid">
      <div className="activity-card">
        <div className="ac-head">
          <div className="ac-title pixel">▸ LATEST SCORES</div>
        </div>
        <div className="ticker">
          {latest === null && <div className="tick-row">LOADING...</div>}
          {latest?.length === 0 && (
            <div className="tick-row">NO SCORES YET</div>
          )}
          {latest?.map((r, i) => (
            <div
              key={`${r.name}-${r.createdAt}-${i}`}
              className="tick-row"
              style={{ animationDelay: i * 60 + "ms" }}
            >
              <span
                className={"tk-p neon-" + (game(r.gameId)?.color ?? "cyan")}
              >
                {r.name}
              </span>
              <span className="tk-mid">
                ▸ {game(r.gameId)?.title ?? r.gameId}
              </span>
              <span className="tk-s">+{fmt(r.score)}</span>
              <span className="tk-t">{ago(r.createdAt)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="activity-card">
        <div className="ac-head">
          <div className="ac-title pixel neon-magenta">
            ▸ TOP PLAYERS · TODAY
          </div>
          <Link href="/hall-of-fame" className="lb-link">
            VIEW HALL →
          </Link>
        </div>
        <div className="top-list">
          {today === null && <div className="top-row">LOADING...</div>}
          {today?.length === 0 && (
            <div className="top-row">NO SCORES TODAY</div>
          )}
          {today?.map((r, i) => (
            <div
              key={r.name}
              className={
                "top-row" +
                (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")
              }
            >
              <span className="tp-rk">#{String(i + 1).padStart(2, "0")}</span>
              <span className="tp-bar">
                <span
                  className="tp-fill"
                  style={{ width: 100 - i * 16 + "%" }}
                ></span>
              </span>
              <span className="tp-p">{r.name}</span>
              <span className="tp-s">{fmt(r.score)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
