import {
  COLS,
  GOAL_SLOTS,
  GOAL_SPAN,
  LOOP,
  LOOP_MARGIN,
  MAX_SCORE,
  SPEED_CAP,
  SPEED_PER_LEVEL,
  TIME_BASE,
  TIME_MIN,
  TIME_STEP,
} from "./constants";

export type Direction = "up" | "down" | "left" | "right";

export const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v));

export const clampScore = (score: number): number => clamp(Math.round(score), 0, MAX_SCORE);

/** Speed multiplier of a level: +15% per level, compounded, capped. */
export const speedFactor = (level: number): number =>
  Math.min(SPEED_CAP, Math.pow(SPEED_PER_LEVEL, Math.max(0, level - 1)));

/** Seconds a round lasts at a level. */
export const roundTime = (level: number): number =>
  Math.max(TIME_MIN, TIME_BASE - TIME_STEP * Math.max(0, level - 1));

/** Keep a lane position inside [-LOOP_MARGIN, COLS) by wrapping it around the lane loop. */
export const wrapCol = (col: number): number => {
  let c = col;
  while (c >= COLS) c -= LOOP;
  while (c < -LOOP_MARGIN) c += LOOP;
  return c;
};

/** Index of the goal slot that covers a column, or -1 when the column is a wall. */
export const goalSlotAt = (col: number): number =>
  GOAL_SLOTS.findIndex((start) => col >= start && col < start + GOAL_SPAN);

/** Do two horizontal ranges [a0, a1) and [b0, b1) overlap? */
export const overlaps = (a0: number, a1: number, b0: number, b1: number): boolean =>
  a0 < b1 && b0 < a1;
