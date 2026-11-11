"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/components/session-provider";
import { rememberNextPath } from "@/lib/auth-redirect";
import {
  fetchGameLikes,
  formatLikes,
  toggleGameLike,
  type GameLikes,
} from "@/lib/likes-db";

/**
 * The "Likes" stat cell of /games/[id] (SPEC 26). Same look as the other cells; it is a button.
 * One like per account per game, a second click removes it. A guest sees the count and, on click,
 * goes to /auth and comes back to this page.
 */
export function LikeButton({ gameId }: { gameId: string }) {
  const { user, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [likes, setLikes] = useState<GameLikes | null>(null);
  const busy = useRef(false);
  const signedInKey = user ? user.email : "";

  useEffect(() => {
    if (status === "loading") return;
    let cancelled = false;
    fetchGameLikes(gameId)
      .then((value) => {
        if (!cancelled) setLikes(value);
      })
      .catch(() => {
        // Keep the placeholder: the page works without the count.
      });
    return () => {
      cancelled = true;
    };
  }, [gameId, status, signedInKey]);

  function onClick() {
    if (status === "loading" || busy.current) return;
    if (!user) {
      rememberNextPath(pathname);
      router.push("/auth");
      return;
    }
    if (!likes) return;
    const before = likes;
    busy.current = true;
    setLikes({
      liked: !before.liked,
      count: Math.max(0, before.count + (before.liked ? -1 : 1)),
    });
    toggleGameLike(gameId)
      .then(setLikes)
      .catch(() => setLikes(before))
      .finally(() => {
        busy.current = false;
      });
  }

  const liked = likes?.liked ?? false;
  const shown = likes ? formatLikes(likes.count) : "—";

  return (
    <button
      type="button"
      className={"like-stat" + (liked ? " liked" : "")}
      aria-pressed={liked}
      aria-label={
        likes
          ? `Likes: ${likes.count}. ${user ? (liked ? "Remove your like" : "Like this game") : "Sign in to like this game"}`
          : "Likes"
      }
      onClick={onClick}
    >
      <span className="l">Likes</span>
      <span className="v">{shown}</span>
    </button>
  );
}
