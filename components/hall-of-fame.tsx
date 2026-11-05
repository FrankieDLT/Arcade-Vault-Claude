"use client";

import Link from "next/link";
import { useState } from "react";
import { scoresStatusMessage, useTopScores } from "@/components/leaderboard";
import { GAMES } from "@/lib/games";

const ROW_COUNT = 12;

export function HallOfFame() {
  const [tab, setTab] = useState(GAMES[0].id);
  const { rows, status } = useTopScores(tab, ROW_COUNT);
  const [first, second, third] = rows;

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>HALL OF FAME</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          THE NAMES THAT NEVER LEAVE THE SCREEN
        </p>
      </div>

      <div className="hall-tabs">
        {GAMES.map((g) => (
          <button
            key={g.id}
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      <div className="podium">
        <div className="podium-slot silver">
          <div className="rank-num">02</div>
          <div className="name">{second?.name ?? "---"}</div>
          <div className="score">
            {second ? second.score.toLocaleString("en-US") : "—"}
          </div>
          <div className="date">{second?.date ?? ""}</div>
        </div>
        <div className="podium-slot gold">
          <div
            className="pixel"
            style={{
              fontSize: 9,
              color: "var(--gold)",
              letterSpacing: "0.18em",
            }}
          >
            CHAMPION
          </div>
          <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
            01
          </div>
          <div className="name">{first?.name ?? "---"}</div>
          <div className="score" style={{ fontSize: 20 }}>
            {first ? first.score.toLocaleString("en-US") : "—"}
          </div>
          <div className="date">{first?.date ?? ""}</div>
        </div>
        <div className="podium-slot bronze">
          <div className="rank-num">03</div>
          <div className="name">{third?.name ?? "---"}</div>
          <div className="score">
            {third ? third.score.toLocaleString("en-US") : "—"}
          </div>
          <div className="date">{third?.date ?? ""}</div>
        </div>
      </div>

      <div className="hall-table">
        <div className="th">
          <div>RANK</div>
          <div>PLAYER</div>
          <div>SCORE</div>
          <div>DATE</div>
        </div>
        {rows.length === 0 && (
          <div className="tr">
            <div className="pl">{scoresStatusMessage(status)}</div>
          </div>
        )}
        {rows.map((r, i) => (
          <div
            key={`${r.name}-${r.score}-${i}`}
            className={
              "tr" +
              (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")
            }
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
            <div className="pl">{r.name}</div>
            <div className="sc">{r.score.toLocaleString("en-US")}</div>
            <div className="dt">{r.date}</div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/library" className="btn lg">
          BACK TO THE LIBRARY
        </Link>
      </div>
    </div>
  );
}
