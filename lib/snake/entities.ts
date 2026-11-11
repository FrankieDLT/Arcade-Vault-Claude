import {
  BONUS_BLINK,
  BONUS_FRUIT,
  BONUS_LIFETIME,
  CELL,
  COLS,
  H,
  ROWS,
  W,
  type FruitName,
  type SpriteName,
  type SkinPalette,
} from "./constants";
import { FRUIT_SPRITES, SPRITE_GRID } from "./sprites";
import { DIRECTION_VECTORS } from "./utils";

const SPRITE_SCALE = 2; // 16 px run tables drawn at 32 px (fits SPRITE_BOX)

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

// One per engine instance. Draws the run tables of sprites.ts once per skin filter into 32x32 offscreen
// canvases (2x, no smoothing); a frame only calls drawImage.
export class FruitArt {
  private readonly cache = new Map<string, Map<SpriteName, HTMLCanvasElement>>();
  private filter = "none";

  setFilter(filter: string): void {
    this.filter = filter;
  }

  private build(name: SpriteName): HTMLCanvasElement | null {
    const def = FRUIT_SPRITES[name];
    const [raw, rctx] = makeCanvas(SPRITE_GRID);
    const [out, octx] = makeCanvas(SPRITE_GRID * SPRITE_SCALE);
    if (!rctx || !octx) return null;
    def.rows.forEach((row, y) => {
      for (let x = 0; x < SPRITE_GRID; x++) {
        if (row[x] === ".") continue;
        rctx.fillStyle = def.palette[row[x]] ?? "#ff00ff";
        rctx.fillRect(x, y, 1, 1);
      }
    });
    octx.imageSmoothingEnabled = false;
    // ctx.filter is missing in some browsers (Safari): the sprite then keeps its own colors.
    if (this.filter !== "none" && "filter" in octx) octx.filter = this.filter;
    octx.drawImage(raw, 0, 0, SPRITE_GRID * SPRITE_SCALE, SPRITE_GRID * SPRITE_SCALE);
    return out;
  }

  get(name: SpriteName): HTMLCanvasElement | null {
    let sprites = this.cache.get(this.filter);
    if (!sprites) {
      sprites = new Map();
      this.cache.set(this.filter, sprites);
    }
    let c = sprites.get(name) ?? null;
    if (!c) {
      c = this.build(name);
      if (c) sprites.set(name, c);
    }
    return c;
  }

  // Draws a sprite centered on (cx, cy).
  draw(ctx: CanvasRenderingContext2D, name: SpriteName, cx: number, cy: number): void {
    const c = this.get(name);
    if (c) ctx.drawImage(c, Math.round(cx - c.width / 2), Math.round(cy - c.height / 2));
  }

  destroy(): void {
    this.cache.clear();
  }
}

const makeCanvas = (size: number): [HTMLCanvasElement, CanvasRenderingContext2D | null] => {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  return [c, c.getContext("2d")];
};

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

export const drawFruit = (ctx: CanvasRenderingContext2D, fruit: Fruit, art: FruitArt): void => {
  const { x, y } = cellCenter(fruit);
  art.draw(ctx, fruit.sprite, x, y);
};

// `clock` is the engine clock in seconds (frozen while paused), used for the pulse and the blink.
// The ring shrinks as the timer runs out; during the last BONUS_BLINK seconds the whole bonus blinks.
export const drawBonus = (
  ctx: CanvasRenderingContext2D,
  bonus: Bonus,
  clock: number,
  art: FruitArt,
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
  art.draw(ctx, BONUS_FRUIT, x, y);
};
