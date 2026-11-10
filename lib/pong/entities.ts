import {
  BALL_SIZE,
  H,
  PADDLE_H,
  PADDLE_W,
  START_LIVES,
  W,
  type PongPalette,
} from "./constants";

export interface Player {
  y: number; // paddle top, px
  lives: number; // START_LIVES at start; the CPU has none in PvE
  score: number;
}

export interface Ball {
  x: number; // center
  y: number; // center
  vx: number;
  vy: number;
}

// 3x5 pixel digits, one string per row.
const DIGITS: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "001", "001", "001"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
};

const NUMERAL_CELL = 12; // px per digit cell
const NUMERAL_MAX_WIDTH = 330; // widest a score may be, so it stays on its half
const NUMERAL_TOP = 24;
const TAG_Y = 112;
const PIP_Y = 124;
const PIP_SIZE = 12;
const PIP_GAP = 8;

/** Background and the dashed center net. */
export function drawField(ctx: CanvasRenderingContext2D, palette: PongPalette): void {
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = palette.net;
  for (let y = 6; y < H; y += 28) ctx.fillRect(W / 2 - 2, y, 4, 16);
}

export function drawPaddle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  glow: number,
): void {
  ctx.save();
  ctx.fillStyle = color;
  if (glow > 0) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
  }
  ctx.fillRect(x, y, PADDLE_W, PADDLE_H);
  ctx.restore();
}

export function drawBall(
  ctx: CanvasRenderingContext2D,
  ball: Ball,
  color: string,
  glow: number,
): void {
  ctx.save();
  ctx.fillStyle = color;
  if (glow > 0) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
  }
  ctx.fillRect(ball.x - BALL_SIZE / 2, ball.y - BALL_SIZE / 2, BALL_SIZE, BALL_SIZE);
  ctx.restore();
}

function drawNumeral(
  ctx: CanvasRenderingContext2D,
  value: number,
  centerX: number,
  color: string,
): void {
  const text = String(value);
  const cell = Math.min(NUMERAL_CELL, Math.floor(NUMERAL_MAX_WIDTH / (4 * text.length - 1)));
  const width = (4 * text.length - 1) * cell;
  const left = Math.round(centerX - width / 2);
  ctx.fillStyle = color;
  for (let i = 0; i < text.length; i++) {
    const rows = DIGITS[text[i]];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        if (rows[r][c] === "1") {
          ctx.fillRect(left + (i * 4 + c) * cell, NUMERAL_TOP + r * cell, cell, cell);
        }
      }
    }
  }
}

function drawPips(
  ctx: CanvasRenderingContext2D,
  lives: number,
  centerX: number,
  palette: PongPalette,
): void {
  const width = START_LIVES * PIP_SIZE + (START_LIVES - 1) * PIP_GAP;
  const left = centerX - width / 2;
  for (let i = 0; i < START_LIVES; i++) {
    const x = left + i * (PIP_SIZE + PIP_GAP);
    if (i < lives) {
      ctx.fillStyle = palette.pipOn;
      ctx.fillRect(x, PIP_Y, PIP_SIZE, PIP_SIZE);
    } else {
      ctx.strokeStyle = palette.pipOff;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, PIP_Y + 1, PIP_SIZE - 2, PIP_SIZE - 2);
    }
  }
}

export interface ScoreboardSide {
  score: number;
  lives: number | null; // null = no life pips (the CPU)
  tag: string; // "P1", "P2" or "CPU"
}

/** Both scores as pixel numerals, with a tag and life pips under each, one per half. */
export function drawScoreboard(
  ctx: CanvasRenderingContext2D,
  palette: PongPalette,
  left: ScoreboardSide,
  right: ScoreboardSide,
): void {
  const sides: [ScoreboardSide, number][] = [
    [left, W / 4],
    [right, (W * 3) / 4],
  ];
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = "bold 16px monospace";
  for (const [side, cx] of sides) {
    drawNumeral(ctx, side.score, cx, palette.numeral);
    ctx.fillStyle = palette.tag;
    ctx.fillText(side.tag, cx, TAG_Y);
    if (side.lives !== null) drawPips(ctx, side.lives, cx, palette);
  }
  ctx.restore();
}
