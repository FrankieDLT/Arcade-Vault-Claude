import type { SavedScore, SessionUser } from "./types";

const USER_KEY = "av_user";
const SCORES_KEY = "av_scores";

// In-memory fallback for when localStorage is unavailable (private mode, quota).
let memoryUser: SessionUser | null = null;
let memoryScores: SavedScore[] = [];

export function readUser(): SessionUser | null {
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    const parsed = JSON.parse(raw || "null");
    if (parsed && typeof parsed.name === "string") return { name: parsed.name };
    return null;
  } catch {
    return memoryUser;
  }
}

export function writeUser(user: SessionUser | null): void {
  memoryUser = user;
  try {
    if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(USER_KEY);
  } catch {
    // Fall back to in-memory state.
  }
}

export function readScores(): SavedScore[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SCORES_KEY) || "[]");
    return Array.isArray(parsed) ? (parsed as SavedScore[]) : [];
  } catch {
    return memoryScores;
  }
}

export function addScore(score: SavedScore): void {
  const all = [...readScores(), score];
  memoryScores = all;
  try {
    window.localStorage.setItem(SCORES_KEY, JSON.stringify(all));
  } catch {
    // Fall back to in-memory state.
  }
}
