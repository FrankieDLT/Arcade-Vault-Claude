import { COLS, MAX_SCORE, MAX_TPS, ROWS, START_TPS, TPS_PER_FRUIT } from "./constants";
import type { Cell, Direction } from "./entities";

export const DIRECTION_VECTORS: Record<Direction, Cell> = {
  up: { col: 0, row: -1 },
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 },
};

// Ticks per second: 8 at the start, +0.4 per fruit eaten (bonus included), capped at 16.
export const ticksPerSecond = (fruitsEaten: number): number =>
  Math.min(MAX_TPS, START_TPS + TPS_PER_FRUIT * fruitsEaten);

// Random cell not in `snake` or `occupied`, or null when the board is full.
// Builds the list of free cells first, so it never loops on a nearly full board.
export const randomFreeCell = (
  snake: readonly Cell[],
  occupied: readonly Cell[],
  rng: () => number = Math.random,
): Cell | null => {
  const taken = new Set<number>();
  for (const c of snake) taken.add(c.row * COLS + c.col);
  for (const c of occupied) taken.add(c.row * COLS + c.col);
  const free: Cell[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (!taken.has(row * COLS + col)) free.push({ col, row });
    }
  }
  if (free.length === 0) return null;
  return free[Math.floor(rng() * free.length)];
};

export const isOpposite = (a: Direction, b: Direction): boolean =>
  (a === "up" && b === "down") ||
  (a === "down" && b === "up") ||
  (a === "left" && b === "right") ||
  (a === "right" && b === "left");

// Integer in 0..MAX_SCORE, the range the database accepts.
export const clampScore = (score: number): number =>
  Math.min(Math.max(Math.trunc(score), 0), MAX_SCORE);
