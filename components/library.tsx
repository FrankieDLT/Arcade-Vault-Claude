"use client";

import { useMemo, useState } from "react";
import { GameCard } from "@/components/game-card";
import { CATEGORIES, GAMES } from "@/lib/games";

export function Library() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("ALL");

  const filtered = useMemo(() => {
    const needle = q.toLowerCase();
    return GAMES.filter(
      (g) =>
        (cat === "ALL" || g.cat === cat) && g.title.toLowerCase().includes(needle),
    );
  }, [q, cat]);

  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
        <div className="sub">
          INSERT COIN TO PLAY <span className="blink">_</span>
        </div>
      </section>

      <div className="av-filters">
        <div className="av-search">
          <span className="ico">⌕</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search for a game by title…"
            aria-label="Search games"
          />
        </div>
        <div className="av-chips">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={"chip" + (cat === c ? " active" : "")}
              onClick={() => setCat(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="av-grid">
        {filtered.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
        {filtered.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              padding: 80,
              color: "var(--ink-faint)",
            }}
          >
            <div
              className="pixel"
              style={{ fontSize: 14, color: "var(--magenta)", marginBottom: 12 }}
            >
              NO RESULTS
            </div>
            <div>Try another search or category.</div>
          </div>
        )}
      </div>
    </div>
  );
}
