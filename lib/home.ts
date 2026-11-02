import type { GameColor } from "./types";

export interface Feature {
  icon: "GAMEPAD" | "FREE" | "TROPHY" | "ROCKET";
  title: string;
  desc: string;
  color: GameColor;
}

export interface ActivityRow {
  player: string;
  /** Game.id, resolved to the title for display */
  gameId: string;
  score: number;
  /** e.g. "2 min ago" */
  ago: string;
  color: GameColor;
}

export interface TopPlayer {
  rank: number;
  player: string;
  score: number;
}

export interface HomeStat {
  /** "12+", "THOUSANDS", "GLOBAL" */
  value: string;
  unit: string;
  sub: string;
}

export const FEATURES: Feature[] = [
  {
    icon: "GAMEPAD",
    title: "CLASSIC GAMES",
    desc: "Arkanoid, Tetris, Snake and many more. The greatest arcade games of all time in one place.",
    color: "cyan",
  },
  {
    icon: "FREE",
    title: "100% FREE",
    desc: "No subscriptions, no hidden fees. Every game is available for free.",
    color: "yellow",
  },
  {
    icon: "TROPHY",
    title: "LEADERBOARDS",
    desc: "Compete with players from all over the world. Climb the ranking and prove who is the best.",
    color: "magenta",
  },
  {
    icon: "ROCKET",
    title: "ALWAYS GROWING",
    desc: "We keep adding new games. Come back often, there will always be something new to play.",
    color: "green",
  },
];

export const ACTIVITY: ActivityRow[] = [
  { player: "NEONFOX", gameId: "drop", score: 184220, ago: "2 min ago", color: "magenta" },
  { player: "PX_KAI", gameId: "chomper", score: 96400, ago: "5 min ago", color: "yellow" },
  { player: "Z3R0COOL", gameId: "invaders", score: 54190, ago: "8 min ago", color: "green" },
  { player: "VAULT_07", gameId: "rocks", score: 41200, ago: "12 min ago", color: "cyan" },
  { player: "GLITCHA", gameId: "brick-buster", score: 28450, ago: "18 min ago", color: "cyan" },
  { player: "ARKADYA", gameId: "serpentine", score: 7820, ago: "24 min ago", color: "green" },
  { player: "CYBER_LU", gameId: "hopper", score: 18900, ago: "31 min ago", color: "yellow" },
];

export const TOP_PLAYERS: TopPlayer[] = [
  { rank: 1, player: "NEONFOX", score: 312840 },
  { rank: 2, player: "PX_KAI", score: 248110 },
  { rank: 3, player: "M00NRYU", score: 196720 },
  { rank: 4, player: "VAULT_07", score: 154300 },
  { rank: 5, player: "GLITCHA", score: 138900 },
];

export const HOME_STATS: HomeStat[] = [
  { value: "12+", unit: "GAMES", sub: "AND COUNTING" },
  { value: "THOUSANDS", unit: "OF PLAYS", sub: "EVERY DAY" },
  { value: "GLOBAL", unit: "RANKING", sub: "COMPETE WITH THE WORLD" },
];

export const PRICING_FEATURES: string[] = [
  "Access to every game",
  "Global ranking and Hall of Fame",
  "No ads between games",
  "Save your scores",
  "New games every month",
  "Works in any browser",
];

export const FAQ: { q: string; a: string }[] = [
  {
    q: "IS IT REALLY FREE?",
    a: 'Yes. Arcade Vault is a non-profit project made out of love for the classics. There is no hidden "premium" version.',
  },
  {
    q: "DO I NEED AN ACCOUNT?",
    a: "No. You can play as a guest. If you want to save your score and appear in the ranking, sign up in 10 seconds.",
  },
  {
    q: "HOW DO YOU SURVIVE WITHOUT CHARGING?",
    a: "It is a community project. If you like it, share it. That is the only coin we accept.",
  },
];
