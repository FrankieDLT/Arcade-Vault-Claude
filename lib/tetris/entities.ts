import {
  COLS,
  PIECES,
  PREVIEW_BLOCK,
  SKIN_COLORS,
  type Shape,
  type TetrisSkin,
} from "./constants";

export interface Piece {
  type: number; // 1 to 7 (I, O, T, S, Z, J, L)
  shape: Shape;
  x: number;
  y: number;
}

// Fresh piece at its spawn position: x = floor(COLS / 2) - floor(width / 2), y = 0.
export const makePiece = (type: number): Piece => {
  const shape = PIECES[type].map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
};

type BlockDrawer = (ctx: CanvasRenderingContext2D, px: number, py: number, s: number, color: string) => void;

// Rounded rect path; falls back to a plain rect where roundRect is missing.
const roundedRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void => {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
};

export const BLOCK_DRAWERS: Record<TetrisSkin, BlockDrawer> = {
  retro(ctx, px, py, s, color) {
    ctx.fillStyle = color;
    ctx.fillRect(px, py, s, s);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(px, py, s, 4);
  },
  neon(ctx, px, py, s, color) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    ctx.fillRect(px + 2, py + 2, s - 4, s - 4);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(px + 4, py + 4, s - 8, s - 8);
  },
  pastel(ctx, px, py, s, color) {
    ctx.fillStyle = color;
    roundedRectPath(ctx, px, py, s, s, s * 0.3);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    roundedRectPath(ctx, px + s * 0.18, py + s * 0.14, s * 0.64, s * 0.18, s * 0.09);
    ctx.fill();
  },
  pixel(ctx, px, py, s, color) {
    ctx.fillStyle = color;
    ctx.fillRect(px, py, s, s);
    const cell = Math.max(2, Math.round(s / 6));
    const n = Math.floor(s / cell);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const edge = i === 0 || j === 0 || i === n - 1 || j === n - 1;
        if (edge) {
          ctx.fillStyle = i === 0 || j === 0 ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)";
        } else if ((i + j) % 2) {
          ctx.fillStyle = "rgba(0,0,0,0.18)";
        } else {
          continue;
        }
        ctx.fillRect(px + i * cell, py + j * cell, cell, cell);
      }
    }
  },
};

// Draws one block at grid cell (x, y). colorIndex 0 is empty and draws nothing.
export const drawBlock = (
  ctx: CanvasRenderingContext2D,
  skin: TetrisSkin,
  x: number,
  y: number,
  colorIndex: number,
  size: number,
  alpha = 1,
): void => {
  if (!colorIndex) return;
  ctx.globalAlpha = alpha;
  BLOCK_DRAWERS[skin](ctx, x * size + 1, y * size + 1, size - 2, SKIN_COLORS[skin][colorIndex]);
  ctx.globalAlpha = 1;
};

// Piece centered in a 4x4 grid of PREVIEW_BLOCK blocks whose top-left corner is (ox, oy).
export const drawPreview = (
  ctx: CanvasRenderingContext2D,
  skin: TetrisSkin,
  piece: Piece | null,
  ox: number,
  oy: number,
): void => {
  if (!piece) return;
  const { shape } = piece;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  ctx.save();
  ctx.translate(ox, oy);
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      drawBlock(ctx, skin, offX + c, offY + r, shape[r][c], PREVIEW_BLOCK);
    }
  }
  ctx.restore();
};
