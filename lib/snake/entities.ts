import {
  BONUS_BLINK,
  BONUS_FRUIT,
  BONUS_LIFETIME,
  CELL,
  COLS,
  FRUIT_SPRITES,
  H,
  ROWS,
  SPRITE_BOX,
  W,
  type FruitName,
  type SkinPalette,
} from "./constants";
import { DIRECTION_VECTORS } from "./utils";

export interface Cell {
  col: number;
  row: number;
}

export type Direction = "up" | "down" | "left" | "right";

export interface Fruit extends Cell {
  sprite: FruitName;
}

export interface Bonus extends Cell {
  age: number; // seconds of game time since it appeared
}

// One per engine instance. Loads fruits.png once and keeps a filtered copy for the skin.
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
      this.applyFilter(this.filter);
      onDone(true);
    };
    img.onerror = () => {
      if (this.destroyed) return;
      console.error("Snake: failed to load the fruit sprite sheet");
      this.failed = true;
      onDone(false);
    };
    img.src = src;
  }

  // "none" restores the original. Does nothing when ctx.filter is unsupported.
  // Before the sheet loads the filter is remembered and applied on load.
  applyFilter(filter: string): void {
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

  // Draws a fruit scaled to fit the SPRITE_BOX square, centered on (cx, cy), keeping its ratio.
  drawFruit(ctx: CanvasRenderingContext2D, name: FruitName, cx: number, cy: number): void {
    if (!this.loaded || !this.source) return;
    const s = FRUIT_SPRITES[name];
    const scale = Math.min(SPRITE_BOX / s.w, SPRITE_BOX / s.h);
    const w = s.w * scale;
    const h = s.h * scale;
    ctx.drawImage(this.source, s.x, s.y, s.w, s.h, cx - w / 2, cy - h / 2, w, h);
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

const cellCenter = (c: Cell): { x: number; y: number } => ({
  x: c.col * CELL + CELL / 2,
  y: c.row * CELL + CELL / 2,
});

export const drawBoard = (ctx: CanvasRenderingContext2D, palette: SkinPalette): void => {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      ctx.fillStyle = (col + row) % 2 === 0 ? palette.boardA : palette.boardB;
      ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
    }
  }
  if (palette.grid) {
    ctx.strokeStyle = palette.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let col = 1; col < COLS; col++) {
      ctx.moveTo(col * CELL + 0.5, 0);
      ctx.lineTo(col * CELL + 0.5, H);
    }
    for (let row = 1; row < ROWS; row++) {
      ctx.moveTo(0, row * CELL + 0.5);
      ctx.lineTo(W, row * CELL + 0.5);
    }
    ctx.stroke();
  }
};

// `snake` is ordered head first. The head gets two eyes looking along `dir`.
export const drawSnake = (
  ctx: CanvasRenderingContext2D,
  snake: readonly Cell[],
  dir: Direction,
  palette: SkinPalette,
): void => {
  ctx.save();
  if (palette.glow > 0) {
    ctx.shadowColor = palette.body;
    ctx.shadowBlur = palette.glow;
  }
  const inset = 2;
  const size = CELL - inset * 2;
  for (let i = snake.length - 1; i >= 1; i--) {
    ctx.fillStyle = palette.body;
    ctx.fillRect(snake[i].col * CELL + inset, snake[i].row * CELL + inset, size, size);
  }
  const head = snake[0];
  if (palette.glow > 0) ctx.shadowColor = palette.head;
  ctx.fillStyle = palette.head;
  ctx.fillRect(head.col * CELL + inset, head.row * CELL + inset, size, size);
  ctx.restore();

  const { x, y } = cellCenter(head);
  const v = DIRECTION_VECTORS[dir];
  const side = { x: -v.row, y: v.col }; // perpendicular to the heading
  for (const k of [-1, 1]) {
    const ex = x + v.col * 7 + side.x * k * 8;
    const ey = y + v.row * 7 + side.y * k * 8;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ex, ey, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.eye;
    ctx.beginPath();
    ctx.arc(ex + v.col * 1.5, ey + v.row * 1.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
};

const drawFlatFruit = (
  ctx: CanvasRenderingContext2D,
  c: Cell,
  color: string,
): void => {
  const { x, y } = cellCenter(c);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, SPRITE_BOX / 2 - 3, 0, Math.PI * 2);
  ctx.fill();
};

// Waits for the sheet: nothing is drawn until it loaded or failed (then flat circles).
export const drawFruit = (
  ctx: CanvasRenderingContext2D,
  fruit: Fruit,
  sheet: SpriteSheet,
  palette: SkinPalette,
): void => {
  if (sheet.failed) {
    drawFlatFruit(ctx, fruit, palette.fallbackFruit);
    return;
  }
  if (!sheet.loaded) return;
  const { x, y } = cellCenter(fruit);
  sheet.drawFruit(ctx, fruit.sprite, x, y);
};

// `clock` is the engine clock in seconds (frozen while paused), used for the pulse and the blink.
// The ring shrinks as the timer runs out; during the last BONUS_BLINK seconds the whole bonus blinks.
export const drawBonus = (
  ctx: CanvasRenderingContext2D,
  bonus: Bonus,
  clock: number,
  sheet: SpriteSheet,
  palette: SkinPalette,
): void => {
  const remaining = Math.max(0, BONUS_LIFETIME - bonus.age);
  if (remaining < BONUS_BLINK && Math.floor(clock * 6) % 2 === 0) return;
  const { x, y } = cellCenter(bonus);
  const life = remaining / BONUS_LIFETIME; // 1 -> 0
  const radius = 14 + 8 * life + Math.sin(clock * 8) * 1.5;
  ctx.save();
  ctx.strokeStyle = palette.bonusRing;
  ctx.lineWidth = 3;
  ctx.shadowColor = palette.bonusRing;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  if (sheet.failed) drawFlatFruit(ctx, bonus, palette.bonusRing);
  else sheet.drawFruit(ctx, BONUS_FRUIT, x, y);
};
