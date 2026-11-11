import {
  BASE_INTERVAL,
  COLS,
  INTERVAL_STEP,
  MAX_SCORE,
  MIN_INTERVAL,
  ROWS,
  type Shape,
} from "./constants";

export const createBoard = (): number[][] =>
  Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));

// Clockwise rotation of a square or rectangular matrix.
export const rotateCW = (shape: Shape): Shape => {
  const rows = shape.length;
  const cols = shape[0].length;
  const result: Shape = Array.from({ length: cols }, () => new Array<number>(rows).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      result[c][rows - 1 - r] = shape[r][c];
    }
  }
  return result;
};

// Gravity interval in ms for a level.
export const intervalFor = (level: number): number =>
  Math.max(MIN_INTERVAL, BASE_INTERVAL - (level - 1) * INTERVAL_STEP);

// Integer in 0..MAX_SCORE, the range the database accepts.
export const clampScore = (score: number): number =>
  Math.min(Math.max(Math.trunc(score), 0), MAX_SCORE);
