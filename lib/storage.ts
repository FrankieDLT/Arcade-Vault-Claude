import type { SavedScore } from "./types";

const SCORES_KEY = "av_scores";

// In-memory fallback for when localStorage is unavailable (private mode, quota).
let memoryScores: SavedScore[] = [];

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
