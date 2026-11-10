"use client";

import Link from "next/link";
import { useState } from "react";
import {
  scoresStatusMessage,
  useRoyalty,
  useTopScores,
  type ScoresStatus,
} from "@/components/leaderboard";
import { GAMES } from "@/lib/games";

const ROW_COUNT = 12;
const ROYALTY_TAB = "royalty";

/** One ranked line, already formatted for either kind of board. */
interface Entry {
  rank: number;
  name: string;
  score: string;
  extra: string;
}

interface BoardProps {
  entries: Entry[];
  status: ScoresStatus;
  /** Header of the last table column ("DATE" or "GAMES"). */
  extraHeader: string;
  scoreHeader: string;
  /** Text under the podium name when the slot has no extra. */
  championLabel: string;
}

function Board({
  entries,
  status,
  extraHeader,
  scoreHeader,
  championLabel,
}: BoardProps) {
  const [first, second, third] = entries;

  return (
    <>
      <div className="podium">
        <div className="podium-slot silver">
          <div className="rank-num">02</div>
          <div className="name">{second?.name ?? "---"}</div>
          <div className="score">{second?.score ?? "—"}</div>
          <div className="date">{second?.extra ?? ""}</div>
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
            {championLabel}
          </div>
          <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
            01
          </div>
          <div className="name">{first?.name ?? "---"}</div>
          <div className="score" style={{ fontSize: 20 }}>
            {first?.score ?? "—"}
          </div>
          <div className="date">{first?.extra ?? ""}</div>
        </div>
        <div className="podium-slot bronze">
          <div className="rank-num">03</div>
          <div className="name">{third?.name ?? "---"}</div>
          <div className="score">{third?.score ?? "—"}</div>
          <div className="date">{third?.extra ?? ""}</div>
        </div>
      </div>

      <div className="hall-table">
        <div className="th">
          <div>RANK</div>
          <div>PLAYER</div>
          <div>{scoreHeader}</div>
          <div>{extraHeader}</div>
        </div>
        {entries.length === 0 && (
          <div className="tr">
            <div className="pl">{scoresStatusMessage(status)}</div>
          </div>
        )}
        {entries.map((r, i) => (
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
            <div className="sc">{r.score}</div>
            <div className="dt">{r.extra}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function RoyaltyBoard() {
  const { rows, status } = useRoyalty(ROW_COUNT);
  const entries = rows.map((r) => ({
    rank: r.rank,
    name: r.name,
    score: r.total.toLocaleString("en-US"),
    extra: `${r.games} ${r.games === 1 ? "GAME" : "GAMES"}`,
  }));

  return (
    <>
      <p className="royalty-note">
        Each player&apos;s best score in every game, added up. Play more games
        to climb.
      </p>
      <Board
        entries={entries}
        status={status}
        scoreHeader="TOTAL"
        extraHeader="GAMES"
        championLabel="ROYALTY"
      />
    </>
  );
}

function GameBoard({ gameId }: { gameId: string }) {
  const { rows, status } = useTopScores(gameId, ROW_COUNT);
  const entries = rows.map((r) => ({
    rank: r.rank,
    name: r.name,
    score: r.score.toLocaleString("en-US"),
    extra: r.date,
  }));

  return (
    <Board
      entries={entries}
      status={status}
      scoreHeader="SCORE"
      extraHeader="DATE"
      championLabel="CHAMPION"
    />
  );
}

export function HallOfFame() {
  // Royalty of Games is the default board.
  const [tab, setTab] = useState<string>(ROYALTY_TAB);

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>HALL OF FAME</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          THE NAMES THAT NEVER LEAVE THE SCREEN
        </p>
      </div>

      <div className="hall-tabs">
        <button
          className={"chip royal" + (tab === ROYALTY_TAB ? " active" : "")}
          onClick={() => setTab(ROYALTY_TAB)}
        >
          <span aria-hidden="true">♛ </span>
          ROYALTY OF GAMES
        </button>
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

      {tab === ROYALTY_TAB ? <RoyaltyBoard /> : <GameBoard gameId={tab} />}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/library" className="btn lg">
          BACK TO THE LIBRARY
        </Link>
      </div>
    </div>
  );
}
