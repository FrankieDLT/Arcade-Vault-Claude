export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export type Origin = "ai" | "human" | "assisted";

export interface Game {
  /** URL slug, e.g. "brick-buster" */
  id: string;
  /** Uppercase display title, e.g. "BRICK BUSTER" */
  title: string;
  /** Card description */
  short: string;
  /** Detail description */
  long: string;
  cat: Category;
  /** CSS class from globals.css, e.g. "cover-bricks" */
  cover: string;
  /** Accent for the card's play button */
  color: GameColor;
  /** Who made the game. Shown as a tag (detail) and an emoji (library card). */
  origin: Origin;
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  /** "DD/MM/YYYY" */
  date: string;
}

/** One player of the Royalty of Games ranking (sum of best score per game). */
export interface RoyaltyRow {
  rank: number;
  name: string;
  total: number;
  /** Games the player has a saved score in. */
  games: number;
  /** "DD/MM/YYYY" */
  lastPlayed: string;
}

export type AuthProvider = "email" | "google" | "github";

export interface SessionUser {
  /** Uppercase, 1-10 chars. From user_metadata.username, else derived. */
  name: string;
  email: string | null;
  /** Provider of the sign in that built this session. */
  provider: AuthProvider;
  /** True when the account has an email + password identity (can change password). */
  hasPassword: boolean;
}

export interface SavedScore {
  /** Game.id */
  game: string;
  score: number;
  name: string;
  /** Date.now() */
  at: number;
}
