import { BALL, BRICK, LEVEL, MAX_SCORE } from "./constants";

// Small seeded PRNG: the same seed always yields the same sequence in [0, 1).
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Rows x cols booleans (true = brick), seeded by level and left-right symmetric.
export const generateLevel = (level: number): boolean[][] => {
  const rand = mulberry32(level);
  const holeChance = Math.min(LEVEL.holeChanceMax, (level - 1) * LEVEL.holeChanceStep);
  const half = BRICK.cols / 2;
  const grid: boolean[][] = [];
  for (let row = 0; row < BRICK.rows; row++) {
    const line = new Array<boolean>(BRICK.cols);
    for (let col = 0; col < half; col++) {
      const brick = rand() >= holeChance;
      line[col] = brick;
      line[BRICK.cols - 1 - col] = brick;
    }
    grid.push(line);
  }
  if (!grid.some((line) => line.some(Boolean))) grid[0][0] = true;
  return grid;
};

// Ball speed in px/s without Frenzy: +5% of the base per level, capped at 2x.
export const baseBallSpeed = (level: number): number =>
  BALL.speed * Math.min(LEVEL.speedCapFactor, 1 + LEVEL.speedStep * (level - 1));

// Integer in 0..MAX_SCORE, the range the database accepts.
export const clampScore = (score: number): number =>
  Math.min(Math.max(Math.trunc(score), 0), MAX_SCORE);
