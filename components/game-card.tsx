"use client";

import Link from "next/link";
import { useRef, type MouseEvent } from "react";
import { BestScore } from "@/components/best-score";
import type { Game } from "@/lib/types";

export function GameCard({ game }: { game: Game }) {
  const tiltRef = useRef<HTMLAnchorElement>(null);

  const onMove = (e: MouseEvent<HTMLAnchorElement>) => {
    const el = tiltRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `translateY(-6px) rotateX(${-py * 6}deg) rotateY(${px * 8}deg)`;
  };

  const onLeave = () => {
    const el = tiltRef.current;
    if (!el) return;
    el.style.transform = "";
  };

  const btnColor =
    game.color === "magenta"
      ? " magenta"
      : game.color === "yellow"
        ? " yellow"
        : "";

  return (
    <Link
      ref={tiltRef}
      href={`/games/${game.id}`}
      className="card"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <div className="cover">
        <div className={"cover-bg " + game.cover}></div>
        <div className="label">{game.cat}</div>
      </div>
      <div className="meta">
        <div className="title">{game.title}</div>
        <div className="desc">{game.short}</div>
        <div className="row">
          <div className="score-badge">
            <span>BEST SCORE</span>
            <b>
              <BestScore gameId={game.id} />
            </b>
          </div>
          {/* Visual only: the whole card is the link, so no nested anchor. */}
          <span className={"btn" + btnColor}>PLAY</span>
        </div>
      </div>
    </Link>
  );
}
