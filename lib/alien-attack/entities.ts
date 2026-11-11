import {
  BOMB_H,
  BOMB_W,
  CANNON_H,
  CANNON_W,
  GROUND_Y,
  H,
  SHOT_H,
  SHOT_W,
  W,
  type InvadersPalette,
} from "./constants";

export interface Invader {
  col: number; // 0..10
  row: number; // 0..4, row 0 is the top row
  alive: boolean;
}

export interface Bullet {
  x: number; // center, px
  y: number; // top of the shot, px
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const CELL = 3; // px per sprite cell: an 11x8 sprite is 33x24

// Sprite frames as horizontal runs [x, y, width] in cells. Frame B swaps arms and legs.
const FRAME_A: [number, number, number][] = [
  [2, 0, 1], [8, 0, 1],
  [3, 1, 1], [7, 1, 1],
  [2, 2, 7],
  [1, 3, 2], [4, 3, 3], [8, 3, 2],
  [0, 4, 11],
  [0, 5, 1], [2, 5, 7], [10, 5, 1],
  [0, 6, 1], [2, 6, 1], [8, 6, 1], [10, 6, 1],
  [3, 7, 2], [6, 7, 2],
];
const FRAME_B: [number, number, number][] = [
  [2, 0, 1], [8, 0, 1],
  [0, 1, 1], [3, 1, 1], [7, 1, 1], [10, 1, 1],
  [0, 2, 1], [2, 2, 7], [10, 2, 1],
  [0, 3, 3], [4, 3, 3], [8, 3, 3],
  [0, 4, 11],
  [2, 5, 7],
  [3, 6, 1], [7, 6, 1],
  [1, 7, 1], [9, 7, 1],
];

export function drawField(ctx: CanvasRenderingContext2D, palette: InvadersPalette): void {
  ctx.shadowBlur = 0;
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = palette.ground;
  ctx.fillRect(0, GROUND_Y, W, 2);
}

/** `frame` is 0 or 1 and flips on every march step. */
export function drawInvader(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  frame: number,
): void {
  ctx.fillStyle = color;
  const runs = frame === 0 ? FRAME_A : FRAME_B;
  for (const [cx, cy, cw] of runs) ctx.fillRect(x + cx * CELL, y + cy * CELL, cw * CELL, CELL);
}

/** `cx` is the cannon center, `y` its top edge. */
export function drawCannon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  color: string,
  glow: number,
): void {
  ctx.fillStyle = color;
  if (glow > 0) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
  }
  ctx.fillRect(cx - CANNON_W / 2, y + 10, CANNON_W, CANNON_H - 10); // base
  ctx.fillRect(cx - CANNON_W / 2 + 8, y + 4, CANNON_W - 16, 6); // body
  ctx.fillRect(cx - 3, y, 6, 6); // barrel
  ctx.shadowBlur = 0;
}

export function drawShot(
  ctx: CanvasRenderingContext2D,
  shot: Bullet,
  color: string,
  glow: number,
): void {
  ctx.fillStyle = color;
  if (glow > 0) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
  }
  ctx.fillRect(shot.x - SHOT_W / 2, shot.y, SHOT_W, SHOT_H);
  ctx.shadowBlur = 0;
}

/** A zigzag bomb: three short bars that swap sides every few pixels of fall. */
export function drawBomb(ctx: CanvasRenderingContext2D, bomb: Bullet, color: string): void {
  ctx.fillStyle = color;
  const left = bomb.x - BOMB_W / 2;
  const wiggle = Math.floor(bomb.y / 6) % 2 === 0 ? 0 : 2;
  const seg = BOMB_H / 3;
  ctx.fillRect(left + wiggle, bomb.y, BOMB_W - 2, seg);
  ctx.fillRect(left + 2 - wiggle, bomb.y + seg, BOMB_W - 2, seg);
  ctx.fillRect(left + wiggle, bomb.y + 2 * seg, BOMB_W - 2, seg);
}
