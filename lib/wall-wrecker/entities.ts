import {
  BALL,
  BAR,
  BRICK,
  CAPSULE_LETTER,
  EXPLOSION_DURATION,
  EXPLOSION_FRAMES,
  EXPLOSION_PAD,
  H,
  PADDLE,
  POWERUP,
  ROW_COLORS,
  SKINS,
  W,
  type BrickColor,
  type PowerUpType,
  type SkinId,
} from "./constants";
import { generateLevel } from "./utils";

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Brick {
  x: number;
  y: number;
  color: BrickColor;
  alive: boolean;
}

export interface Capsule {
  x: number;
  y: number;
  type: PowerUpType;
}

// `start` is in engine-clock milliseconds, not performance.now().
export interface Explosion {
  x: number;
  y: number;
  color: BrickColor;
  start: number;
}

export const createBricks = (level: number): Brick[] => {
  const layout = generateLevel(level);
  const bricks: Brick[] = [];
  for (let row = 0; row < BRICK.rows; row++) {
    for (let col = 0; col < BRICK.cols; col++) {
      if (!layout[row][col]) continue;
      bricks.push({
        x: col * BRICK.w,
        y: BRICK.top + row * BRICK.h,
        color: ROW_COLORS[row],
        alive: true,
      });
    }
  }
  return bricks;
};

// ── Original art, drawn in code (SPEC 26) ─────────────────────────────────────
// Everything below is pre-rendered once per skin into offscreen canvases, so a frame only calls drawImage.

type Rgb = [number, number, number];

const parseHex = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

// amount > 0 mixes toward white, amount < 0 toward black.
const shade = (hex: string, amount: number): string => {
  const [r, g, b] = parseHex(hex);
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  const mix = (c: number) => Math.round(c + (target - c) * t);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
};

const makeCanvas = (w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D | null] => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")];
};

const pill = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
};

export interface Art {
  bricks: Record<BrickColor, HTMLCanvasElement>;
  paddle: HTMLCanvasElement;
  ball: HTMLCanvasElement;
  capsules: Record<PowerUpType, HTMLCanvasElement>;
  explosions: Record<BrickColor, HTMLCanvasElement[]>; // EXPLOSION_FRAMES frames, each BRICK + 2 * EXPLOSION_PAD
  bar: string;
}

const paintBrick = (ctx: CanvasRenderingContext2D, color: string, glow: number) => {
  const { w, h } = BRICK;
  ctx.save();
  if (glow > 0) {
    // Neon: dark body, bright rim and a soft halo.
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
    ctx.fillStyle = shade(color, -0.55);
    ctx.fillRect(3, 3, w - 6, h - 6);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    ctx.fillStyle = shade(color, 0.55);
    ctx.fillRect(8, 8, w - 16, 3);
    ctx.restore();
    return;
  }
  // Solid: bevelled slab with a studded highlight.
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, shade(color, 0.18));
  g.addColorStop(1, shade(color, -0.12));
  ctx.fillStyle = g;
  ctx.fillRect(1, 1, w - 2, h - 2);
  ctx.fillStyle = shade(color, 0.45); // top and left light edges
  ctx.fillRect(1, 1, w - 2, 3);
  ctx.fillRect(1, 1, 3, h - 2);
  ctx.fillStyle = shade(color, -0.4); // bottom and right shade edges
  ctx.fillRect(1, h - 4, w - 2, 3);
  ctx.fillRect(w - 4, 1, 3, h - 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)"; // glint
  ctx.fillRect(8, 8, 14, 3);
  ctx.strokeStyle = shade(color, -0.55);
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  ctx.restore();
};

const paintExplosionFrame = (
  ctx: CanvasRenderingContext2D,
  brick: HTMLCanvasElement,
  color: string,
  frame: number,
) => {
  // The brick breaks into an 4x2 grid of shards that fly outward, shrink and fade; frame 0 adds a flash.
  const t = (frame + 1) / EXPLOSION_FRAMES;
  const cols = 4;
  const rows = 2;
  const sw = BRICK.w / cols;
  const sh = BRICK.h / rows;
  const cx = BRICK.w / 2;
  const cy = BRICK.h / 2;
  if (frame === 0) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.fillRect(EXPLOSION_PAD, EXPLOSION_PAD, BRICK.w, BRICK.h);
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sx = c * sw;
      const sy = r * sh;
      const dx = sx + sw / 2 - cx;
      const dy = sy + sh / 2 - cy;
      const len = Math.hypot(dx, dy) || 1;
      const push = t * 12;
      const scale = 1 - t * 0.45;
      const ox = EXPLOSION_PAD + sx + sw / 2 + (dx / len) * push;
      const oy = EXPLOSION_PAD + sy + sh / 2 + (dy / len) * push + t * t * 6;
      ctx.save();
      ctx.globalAlpha = 1 - t * 0.75;
      ctx.translate(ox, oy);
      ctx.rotate(((c + r * 2) % 2 === 0 ? 1 : -1) * t * 0.5);
      ctx.drawImage(brick, sx, sy, sw, sh, (-sw / 2) * scale, (-sh / 2) * scale, sw * scale, sh * scale);
      ctx.restore();
    }
  }
  ctx.save();
  ctx.globalAlpha = 0.9 - t * 0.8;
  ctx.fillStyle = color;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    const d = 6 + t * 22;
    ctx.fillRect(EXPLOSION_PAD + cx + Math.cos(a) * d - 1.5, EXPLOSION_PAD + cy + Math.sin(a) * d * 0.6 - 1.5, 3, 3);
  }
  ctx.restore();
};

export const buildArt = (skin: SkinId): Art | null => {
  const pal = SKINS[skin];
  const bricks = {} as Art["bricks"];
  const explosions = {} as Art["explosions"];
  for (const color of ROW_COLORS) {
    const [c, ctx] = makeCanvas(BRICK.w, BRICK.h);
    if (!ctx) return null;
    paintBrick(ctx, pal.bricks[color], pal.glow);
    bricks[color] = c;
    explosions[color] = [];
    for (let f = 0; f < EXPLOSION_FRAMES; f++) {
      const [ec, ectx] = makeCanvas(BRICK.w + EXPLOSION_PAD * 2, BRICK.h + EXPLOSION_PAD * 2);
      if (!ectx) return null;
      paintExplosionFrame(ectx, c, pal.bricks[color], f);
      explosions[color].push(ec);
    }
  }

  const [paddle, pctx] = makeCanvas(PADDLE.w, PADDLE.h);
  if (!pctx) return null;
  pctx.shadowColor = pal.paddle.edge;
  pctx.shadowBlur = pal.paddle.glow;
  const pg = pctx.createLinearGradient(0, 0, 0, PADDLE.h);
  pg.addColorStop(0, shade(pal.paddle.body, 0.2));
  pg.addColorStop(1, shade(pal.paddle.body, -0.2));
  pctx.fillStyle = pg;
  pill(pctx, 1, 1, PADDLE.w - 2, PADDLE.h - 2, 5);
  pctx.fill();
  pctx.shadowBlur = 0;
  pctx.fillStyle = pal.paddle.edge; // end caps and a center groove
  pill(pctx, 1, 1, 14, PADDLE.h - 2, 5);
  pctx.fill();
  pill(pctx, PADDLE.w - 15, 1, 14, PADDLE.h - 2, 5);
  pctx.fill();
  pctx.fillRect(PADDLE.w / 2 - 12, PADDLE.h / 2 - 1, 24, 2);

  const [ball, bctx] = makeCanvas(BALL.size, BALL.size);
  if (!bctx) return null;
  const r = BALL.size / 2;
  bctx.shadowColor = pal.ball.rim;
  bctx.shadowBlur = pal.ball.glow;
  const bg = bctx.createRadialGradient(r - 3, r - 3, 1, r, r, r);
  bg.addColorStop(0, pal.ball.fill);
  bg.addColorStop(1, pal.ball.rim);
  bctx.fillStyle = bg;
  bctx.beginPath();
  bctx.arc(r, r, r - 1.5, 0, Math.PI * 2);
  bctx.fill();

  const capsules = {} as Art["capsules"];
  const { w, h } = POWERUP.capsule;
  for (const type of POWERUP.types) {
    const [c, ctx] = makeCanvas(w, h);
    if (!ctx) return null;
    const base = pal.capsule[type];
    if (pal.glow > 0) {
      ctx.shadowColor = base;
      ctx.shadowBlur = pal.glow - 2;
    }
    const cg = ctx.createLinearGradient(0, 0, 0, h);
    cg.addColorStop(0, shade(base, 0.3));
    cg.addColorStop(0.5, base);
    cg.addColorStop(1, shade(base, -0.3));
    ctx.fillStyle = cg;
    pill(ctx, 1, 1, w - 2, h - 2, 7);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillRect(6, 3, w - 12, 2);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(CAPSULE_LETTER[type], w / 2, h / 2 + 1);
    capsules[type] = c;
  }

  return { bricks, paddle, ball, capsules, explosions, bar: pal.bar };
};

export const drawBricks = (ctx: CanvasRenderingContext2D, art: Art, bricks: Brick[]) => {
  for (const br of bricks) {
    if (br.alive) ctx.drawImage(art.bricks[br.color], br.x, br.y);
  }
};

export const drawBar = (ctx: CanvasRenderingContext2D, art: Art, active: boolean) => {
  if (!active) return;
  ctx.fillStyle = art.bar;
  ctx.fillRect(0, BAR.y, W, BAR.h);
};

export const drawPaddle = (ctx: CanvasRenderingContext2D, art: Art, x: number) => {
  ctx.drawImage(art.paddle, x, PADDLE.y);
};

export const drawBalls = (ctx: CanvasRenderingContext2D, art: Art, balls: Ball[]) => {
  for (const b of balls) ctx.drawImage(art.ball, b.x, b.y);
};

// EXPLOSION_FRAMES frames over EXPLOSION_DURATION ms. `now` is the engine clock; finished ones are drawn
// as nothing (the engine removes them in update).
export const drawExplosions = (
  ctx: CanvasRenderingContext2D,
  art: Art,
  explosions: Explosion[],
  now: number,
) => {
  const frameTime = EXPLOSION_DURATION / EXPLOSION_FRAMES;
  for (const ex of explosions) {
    const idx = Math.floor((now - ex.start) / frameTime);
    if (idx >= EXPLOSION_FRAMES) continue;
    ctx.drawImage(art.explosions[ex.color][Math.max(0, idx)], ex.x - EXPLOSION_PAD, ex.y - EXPLOSION_PAD);
  }
};

export const drawCapsules = (ctx: CanvasRenderingContext2D, art: Art, capsules: Capsule[]) => {
  for (const c of capsules) ctx.drawImage(art.capsules[c.type], c.x, c.y);
};

// Remaining seconds of the active timed power-ups, in the empty strip above the wall.
export const drawTimers = (
  ctx: CanvasRenderingContext2D,
  effects: { bar: number; frenzy: number },
) => {
  const timers: string[] = [];
  if (effects.bar > 0) timers.push(`BAR ${Math.ceil(effects.bar)}s`);
  if (effects.frenzy > 0) timers.push(`FRENZY ${Math.ceil(effects.frenzy)}s`);
  if (timers.length === 0) return;
  ctx.fillStyle = "#fff";
  ctx.font = "bold 12px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(timers.join("   "), 16, BRICK.top - 10);
};

export const clearCanvas = (ctx: CanvasRenderingContext2D) => {
  ctx.clearRect(0, 0, W, H);
};
