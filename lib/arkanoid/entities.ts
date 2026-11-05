import {
  BALL,
  BAR,
  BRICK,
  CAPSULE_STYLE,
  EXPLOSION_DURATION,
  EXPLOSION_FRAMES,
  H,
  PADDLE,
  POWERUP,
  ROW_COLORS,
  SPRITES,
  W,
  type BrickColor,
  type PowerUpType,
  type Sprite,
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

// One per engine instance. Keeps the untouched sheet so skins always start from it.
export class SpriteSheet {
  private original: HTMLCanvasElement | null = null;
  private source: HTMLCanvasElement | null = null;
  private filter = "none";
  private destroyed = false;
  private image: HTMLImageElement | null = null;
  loaded = false;
  failed = false;

  // onDone(true) once the sheet is ready, onDone(false) if the image failed to load.
  // Nothing is called after destroy().
  load(src: string, onDone: (ok: boolean) => void): void {
    if (this.loaded) {
      onDone(true);
      return;
    }
    if (this.image) return;
    const img = new Image();
    this.image = img;
    img.onload = () => {
      if (this.destroyed) return;
      const oc = document.createElement("canvas");
      oc.width = img.width;
      oc.height = img.height;
      oc.getContext("2d")?.drawImage(img, 0, 0);
      this.original = oc;
      this.source = oc;
      this.loaded = true;
      this.applySkin(this.filter);
      onDone(true);
    };
    img.onerror = () => {
      if (this.destroyed) return;
      console.error("Failed to load spritesheet");
      this.failed = true;
      onDone(false);
    };
    img.src = src;
  }

  // "none" restores the original. Does nothing when ctx.filter is unsupported.
  // Before the sheet loads the filter is remembered and applied on load.
  applySkin(filter: string): void {
    this.filter = filter;
    if (!this.loaded || !this.original) return;
    if (filter === "none") {
      this.source = this.original;
      return;
    }
    const oc = document.createElement("canvas");
    oc.width = this.original.width;
    oc.height = this.original.height;
    const octx = oc.getContext("2d");
    if (!octx || !("filter" in octx)) return;
    octx.filter = filter;
    octx.drawImage(this.original, 0, 0);
    this.source = oc;
  }

  drawFrame(ctx: CanvasRenderingContext2D, f: Sprite, x: number, y: number, w: number, h: number) {
    if (!this.loaded || !this.source) return;
    ctx.drawImage(this.source, f.sx, f.sy, f.sw, f.sh, x, y, w, h);
  }

  drawSprite(
    ctx: CanvasRenderingContext2D,
    name: "paddle" | "ball" | `block_${BrickColor}`,
    x: number,
    y: number,
    w: number,
    h: number,
  ) {
    const sp = name.startsWith("block_")
      ? SPRITES.blocks[name.slice(6) as BrickColor]
      : SPRITES[name as "paddle" | "ball"];
    if (sp) this.drawFrame(ctx, sp, x, y, w, h);
  }

  // Late onload / onerror become no-ops.
  destroy(): void {
    this.destroyed = true;
    if (this.image) {
      this.image.onload = null;
      this.image.onerror = null;
      this.image = null;
    }
    this.original = null;
    this.source = null;
    this.loaded = false;
  }
}

export const drawBricks = (ctx: CanvasRenderingContext2D, sheet: SpriteSheet, bricks: Brick[]) => {
  for (const br of bricks) {
    if (!br.alive) continue;
    if (sheet.failed) {
      ctx.fillStyle = br.color;
      ctx.fillRect(br.x, br.y, BRICK.w, BRICK.h);
    } else {
      sheet.drawSprite(ctx, `block_${br.color}`, br.x, br.y, BRICK.w, BRICK.h);
    }
  }
};

export const drawBar = (ctx: CanvasRenderingContext2D, active: boolean) => {
  if (!active) return;
  ctx.fillStyle = BAR.color;
  ctx.fillRect(0, BAR.y, W, BAR.h);
};

export const drawPaddle = (ctx: CanvasRenderingContext2D, sheet: SpriteSheet, x: number) => {
  if (sheet.failed) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(x, PADDLE.y, PADDLE.w, PADDLE.h);
  } else {
    sheet.drawSprite(ctx, "paddle", x, PADDLE.y, PADDLE.w, PADDLE.h);
  }
};

export const drawBalls = (ctx: CanvasRenderingContext2D, sheet: SpriteSheet, balls: Ball[]) => {
  for (const b of balls) {
    if (sheet.failed) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(b.x, b.y, BALL.size, BALL.size);
    } else {
      sheet.drawSprite(ctx, "ball", b.x, b.y, BALL.size, BALL.size);
    }
  }
};

// 4 frames over EXPLOSION_DURATION ms. `now` is the engine clock; finished ones are drawn as nothing
// (the engine removes them in update).
export const drawExplosions = (
  ctx: CanvasRenderingContext2D,
  sheet: SpriteSheet,
  explosions: Explosion[],
  now: number,
) => {
  const frames = EXPLOSION_FRAMES.red.length;
  const frameTime = EXPLOSION_DURATION / frames;
  for (const ex of explosions) {
    const idx = Math.floor((now - ex.start) / frameTime);
    if (idx >= frames) continue;
    if (sheet.failed) {
      ctx.fillStyle = ex.color;
      ctx.fillRect(ex.x, ex.y, BRICK.w, BRICK.h);
    } else {
      sheet.drawFrame(ctx, EXPLOSION_FRAMES[ex.color][Math.max(0, idx)], ex.x, ex.y, BRICK.w, BRICK.h);
    }
  }
};

export const drawCapsules = (ctx: CanvasRenderingContext2D, capsules: Capsule[]) => {
  if (capsules.length === 0) return;
  const { w, h } = POWERUP.capsule;
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const c of capsules) {
    const style = CAPSULE_STYLE[c.type];
    ctx.fillStyle = style.color;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") ctx.roundRect(c.x, c.y, w, h, 8);
    else ctx.rect(c.x, c.y, w, h);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(style.letter, c.x + w / 2, c.y + h / 2 + 1);
  }
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
