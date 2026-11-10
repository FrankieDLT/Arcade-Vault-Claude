import {
  BALL_MAX_SPEED,
  BALL_SIZE,
  BALL_SPEED_PER_HIT,
  BALL_START_SPEED,
  CPU,
  H,
  MAX_BOUNCE_ANGLE,
  MAX_SCORE,
  PADDLE_MARGIN,
  PADDLE_W,
  W,
  type PongDifficulty,
} from "./constants";
import type { Ball } from "./entities";

export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(MAX_SCORE, Math.floor(score)));
}

/** Bounce angle in radians for a hit `offset` (-1 top edge .. 1 bottom edge) from the paddle center. */
export function reflectAngle(offset: number): number {
  const clamped = Math.max(-1, Math.min(1, offset));
  return (clamped * MAX_BOUNCE_ANGLE * Math.PI) / 180;
}

/** Ball speed in px/s after `hits` paddle hits in the rally. */
export function ballSpeed(hits: number): number {
  return Math.min(BALL_MAX_SPEED, BALL_START_SPEED * (1 + BALL_SPEED_PER_HIT * hits));
}

/** Ball center y when its center reaches x = `targetX`, folding the path over the top and bottom walls. */
export function predictBallY(ball: Ball, targetX: number): number {
  const half = BALL_SIZE / 2;
  if (ball.vx === 0) return ball.y;
  const t = (targetX - ball.x) / ball.vx;
  if (t <= 0) return ball.y;
  const span = H - BALL_SIZE;
  const period = span * 2;
  let u = (ball.y - half + ball.vy * t) % period;
  if (u < 0) u += period;
  return half + (u > span ? period - u : u);
}

/** Where the CPU paddle center should go: the predicted ball y plus a fixed aim error (`aimUnit` in -1..1, rolled once per rally). */
export function cpuTarget(ball: Ball, difficulty: PongDifficulty, aimUnit: number): number {
  const faceX = W - PADDLE_MARGIN - PADDLE_W - BALL_SIZE / 2; // ball center when it touches the CPU paddle
  const target = predictBallY(ball, faceX) + aimUnit * CPU[difficulty].aim;
  return Math.max(0, Math.min(H, target));
}
