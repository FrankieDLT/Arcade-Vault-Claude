import {
  COLS,
  INVADER_H,
  INVADER_W,
  MAX_LEVEL,
  MAX_SCORE,
  MIN_LEVEL,
  PITCH_X,
  PITCH_Y,
  ROWS,
} from "./constants";
import type { Invader, Rect } from "./entities";

export const clampScore = (score: number): number =>
  Math.max(0, Math.min(MAX_SCORE, Math.floor(score)));

export const clampLevel = (level: number): number =>
  Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, Math.round(level)));

/** Seconds between march steps: fewer invaders march faster, higher levels march faster. */
export const stepInterval = (alive: number, level: number): number =>
  Math.max(0.04, 0.9 * (alive / (COLS * ROWS))) / Math.min(2.5, 1 + 0.08 * (level - 1));

/** Seconds between bomb attempts, before the +-30% jitter the engine adds. */
export const bombInterval = (level: number): number => Math.max(0.35, 1.1 - 0.06 * (level - 1));

/** Top edge of the fleet at the start of a wave: later waves start lower (capped at level 9). */
export const fleetStartY = (level: number): number => 80 + 16 * Math.min(level - 1, 8);

/** A fresh, full grid of invaders. */
export const createInvaders = (): Invader[] => {
  const list: Invader[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) list.push({ col, row, alive: true });
  }
  return list;
};

/** The lowest alive invader in a column, or null when the column is empty. */
export const lowestAliveInColumn = (invaders: Invader[], col: number): Invader | null => {
  let found: Invader | null = null;
  for (const inv of invaders) {
    if (inv.alive && inv.col === col && (found === null || inv.row > found.row)) found = inv;
  }
  return found;
};

export const rectsOverlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** Hit box of an invader for the current fleet position. */
export const invaderRect = (inv: Invader, fleetX: number, fleetY: number): Rect => ({
  x: fleetX + inv.col * PITCH_X,
  y: fleetY + inv.row * PITCH_Y,
  w: INVADER_W,
  h: INVADER_H,
});
