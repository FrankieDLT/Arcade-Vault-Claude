import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { BestScore } from "@/components/best-score";
import { LikeButton } from "@/components/like-button";
import { Leaderboard } from "@/components/leaderboard";
import { OriginEmoji } from "@/components/origin-emoji";
import { GAMES, ORIGINS } from "@/lib/games";

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/games/[id]">): Promise<Metadata> {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
  return game ? { title: game.title, description: game.short } : {};
}

export default function GameDetailPage({ params }: PageProps<"/games/[id]">) {
  return (
    <Suspense fallback={<div className="av-detail fade-in" aria-busy="true" />}>
      <GameDetail params={params} />
    </Suspense>
  );
}

async function GameDetail({
  params,
}: {
  params: PageProps<"/games/[id]">["params"];
}) {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
  if (!game) notFound();

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={"cover-bg " + game.cover}></div>
        </div>
        <div style={{ marginTop: 20 }} className="detail-info">
          <div className="detail-tags">
            <span className="origin-tag">
              <OriginEmoji origin={game.origin} decorative />
              {ORIGINS[game.origin].tag}
            </span>
            <span>{game.cat}</span>
            <span>1 PLAYER</span>
            <span>KEYBOARD / TOUCH</span>
            <span>RETRO 1985</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>
          <div className="stat-strip">
            <LikeButton gameId={game.id} />
            <div>
              <div className="l">Global best</div>
              <div
                className="v"
                style={{
                  color: "var(--magenta)",
                  textShadow: "0 0 6px rgba(255,0,110,0.5)",
                }}
              >
                <BestScore gameId={game.id} />
              </div>
            </div>
            <div>
              <div className="l">Difficulty</div>
              <div
                className="v"
                style={{
                  color: "var(--yellow)",
                  textShadow: "0 0 6px rgba(245,255,0,0.5)",
                }}
              >
                ★ ★ ★ ☆ ☆
              </div>
            </div>
          </div>
          <div className="detail-actions">
            <Link href={`/games/${game.id}/play`} className="btn xl pulse">
              ▶ PLAY NOW
            </Link>
            <Link href="/library" className="btn ghost lg">
              BACK TO THE VAULT
            </Link>
          </div>
        </div>
      </div>

      <aside>
        <Leaderboard gameId={game.id} count={10} />
      </aside>
    </div>
  );
}
