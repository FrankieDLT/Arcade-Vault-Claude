import {
  CELL,
  COLS,
  DAZE_BLINK,
  H,
  MAZE_X,
  MAZE_Y,
  PLAYER_RADIUS,
  RING_RADIUS,
  STREAK_STEP,
  W,
  type SkinPalette,
} from "./constants";
import {
  DIR_VEC,
  cellCenter,
  clamp,
  streakMultiplier,
  type Cell,
  type Dir,
  type Maze,
} from "./utils";

export type { Cell, Dir };

export type DrifterKind = "hunter" | "mirror" | "roamer" | "pacer";
export type DrifterState = "den" | "leaving" | "hunting" | "dazed" | "eyes";

const MAZE_W = COLS * CELL;
const LEFT_EDGE = MAZE_X;
const RIGHT_EDGE = MAZE_X + MAZE_W;
const EPS = 1e-6;

const DIR_ANGLE: Record<Dir, number> = {
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
  up: -Math.PI / 2,
};

/**
 * A mover advances along its heading in px and stops at every tile center it
 * reaches or crosses, where `resolve` may change the heading (or clear it).
 */
class Mover {
  x = 0;
  y = 0;
  dir: Dir | null = null;

  place(col: number, row: number): void {
    const c = cellCenter(col, row);
    this.x = c.x;
    this.y = c.y;
  }

  get cell(): Cell {
    return {
      col: clamp(Math.round((this.x - MAZE_X - CELL / 2) / CELL), 0, COLS - 1),
      row: Math.max(0, Math.round((this.y - MAZE_Y - CELL / 2) / CELL)),
    };
  }

  advance(px: number, resolve: (m: this) => void): void {
    let rem = px;
    let guard = 0;
    while (rem > EPS && this.dir && guard++ < 16) {
      const dist = this.distToCenter(this.dir);
      if (rem < dist - EPS) {
        this.move(rem);
        return;
      }
      this.move(dist);
      this.snap();
      rem -= dist;
      resolve(this);
    }
  }

  /** Distance to the next tile center ahead (the warp edge counts as part of the way). */
  private distToCenter(dir: Dir): number {
    const v = DIR_VEC[dir];
    if (v.x !== 0) {
      const local = (this.x - MAZE_X - CELL / 2) / CELL;
      if (v.x > 0) {
        const k = Math.floor(local + EPS) + 1;
        return k > COLS - 1 ? RIGHT_EDGE - this.x + CELL / 2 : (k - local) * CELL;
      }
      const k = Math.ceil(local - EPS) - 1;
      return k < 0 ? this.x - LEFT_EDGE + CELL / 2 : (local - k) * CELL;
    }
    const local = (this.y - MAZE_Y - CELL / 2) / CELL;
    if (v.y > 0) {
      const k = Math.floor(local + EPS) + 1;
      return (k - local) * CELL;
    }
    const k = Math.ceil(local - EPS) - 1;
    return (local - k) * CELL;
  }

  private move(d: number): void {
    if (!this.dir) return;
    const v = DIR_VEC[this.dir];
    this.x += v.x * d;
    this.y += v.y * d;
    if (this.x > RIGHT_EDGE) this.x -= MAZE_W;
    else if (this.x < LEFT_EDGE) this.x += MAZE_W;
  }

  private snap(): void {
    const col = (((Math.round((this.x - MAZE_X - CELL / 2) / CELL) % COLS) + COLS) % COLS);
    const row = Math.round((this.y - MAZE_Y - CELL / 2) / CELL);
    this.place(col, row);
  }
}

export class Glowmaw extends Mover {
  /** Draws the orb with its wedge mouth, facing its heading. */
  draw(ctx: CanvasRenderingContext2D, clock: number, palette: SkinPalette, moving: boolean, facing: Dir): void {
    const half = moving
      ? 0.05 + 0.85 * (0.5 + 0.5 * Math.sin(Math.PI * 2 * 12 * clock))
      : 0.35;
    this.drawOrb(ctx, palette, PLAYER_RADIUS, half, facing);
  }

  /** Death animation: the mouth closes, then the orb shrinks away. `p` runs 0..1. */
  drawDeath(ctx: CanvasRenderingContext2D, p: number, palette: SkinPalette, facing: Dir): void {
    const close = Math.min(1, p / 0.4);
    const shrink = Math.max(0, (p - 0.4) / 0.6);
    const r = PLAYER_RADIUS * (1 - shrink);
    if (r <= 0.2) return;
    this.drawOrb(ctx, palette, r, 0.9 * (1 - close), facing);
  }

  private drawOrb(
    ctx: CanvasRenderingContext2D,
    palette: SkinPalette,
    r: number,
    half: number,
    facing: Dir,
  ): void {
    const a = DIR_ANGLE[facing];
    ctx.save();
    ctx.shadowColor = palette.halo;
    ctx.shadowBlur = palette.haloBlur;
    ctx.fillStyle = palette.player;
    ctx.beginPath();
    if (half <= 0.02) {
      ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    } else {
      ctx.moveTo(this.x, this.y);
      ctx.arc(this.x, this.y, r, a + half, a - half + Math.PI * 2, false);
      ctx.closePath();
    }
    ctx.fill();
    ctx.shadowBlur = 0;
    if (r > 8) {
      ctx.fillStyle = palette.eye;
      ctx.beginPath();
      ctx.arc(this.x + 4 * Math.cos(a), this.y - 7 + 3 * Math.sin(a), 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export class Drifter extends Mover {
  state: DrifterState = "den";
  /** Seconds left before it leaves the den. */
  wait = 0;
  dazeLeft = 0;

  constructor(
    readonly kind: DrifterKind,
    readonly index: number,
  ) {
    super();
  }

  draw(ctx: CanvasRenderingContext2D, clock: number, palette: SkinPalette): void {
    const look = this.dir ? DIR_VEC[this.dir] : { x: 0, y: 0 };
    const x = this.x;
    const y = this.y;
    ctx.save();
    if (this.state === "eyes") {
      this.drawEyes(ctx, x, y, look, 5.5, palette);
      ctx.restore();
      return;
    }
    const dazed = this.state === "dazed";
    const blink = dazed && this.dazeLeft <= DAZE_BLINK && Math.floor(clock * 6) % 2 === 0;
    const color = dazed ? (blink ? palette.dazedBlink : palette.dazed) : palette.drifters[this.index] ?? palette.drifters[0];
    const R = 15;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y - 3, R, Math.PI, 0, false);
    ctx.lineTo(x + R, y + R);
    const wave = clock * 9;
    for (let i = 0; i < 4; i++) {
      const x1 = x + R - (i + 1) * (R / 2);
      const cx = x + R - (i + 0.5) * (R / 2);
      const wob = Math.sin(wave + i * 1.7) * 3;
      ctx.quadraticCurveTo(cx, y + R + (i % 2 === 0 ? 4 : -4) + wob, x1, y + R);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    if (dazed) {
      ctx.fillStyle = palette.eye;
      ctx.beginPath();
      ctx.arc(x - 5, y - 4, 2, 0, Math.PI * 2);
      ctx.arc(x + 5, y - 4, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = palette.eye;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x - 8, y + 6);
      for (let i = 1; i <= 4; i++) ctx.lineTo(x - 8 + i * 4, y + 6 + (i % 2 === 0 ? 0 : -3));
      ctx.stroke();
    } else {
      this.drawEyes(ctx, x, y - 4, look, 4, palette);
    }
    ctx.restore();
  }

  private drawEyes(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    look: { x: number; y: number },
    r: number,
    palette: SkinPalette,
  ): void {
    for (const dx of [-5, 5]) {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x + dx, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = palette.eye;
      ctx.beginPath();
      ctx.arc(x + dx + look.x * 1.8, y + look.y * 1.8, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Draws the static maze: background, wall blocks with a glowing outline and the den door. */
export function drawMaze(
  ctx: CanvasRenderingContext2D,
  maze: Maze,
  palette: SkinPalette,
  flash: boolean,
): void {
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, W, H);
  const inset = 5;
  const s = CELL - inset * 2;
  const isWall = (col: number, row: number) =>
    col >= 0 && col < maze.cols && row >= 0 && row < maze.rows && maze.tiles[row * maze.cols + col] === "wall";
  const path = new Path2D();
  for (let row = 0; row < maze.rows; row++) {
    for (let col = 0; col < maze.cols; col++) {
      if (!isWall(col, row)) continue;
      const x = MAZE_X + col * CELL;
      const y = MAZE_Y + row * CELL;
      path.roundRect(x + inset, y + inset, s, s, 9);
      if (isWall(col + 1, row)) path.rect(x + CELL - 12, y + inset, 24, s);
      if (isWall(col, row + 1)) path.rect(x + inset, y + CELL - 12, s, 24);
    }
  }
  // Outline first, then the fill hides the inner half of the stroke and every inner seam.
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineWidth = 6;
  ctx.strokeStyle = flash ? palette.flash : palette.wallStroke;
  ctx.shadowColor = flash ? palette.flash : palette.wallStroke;
  ctx.shadowBlur = palette.wallGlow;
  ctx.stroke(path);
  ctx.shadowBlur = 0;
  ctx.fillStyle = palette.wallFill;
  ctx.fill(path);
  ctx.restore();

  for (let row = 0; row < maze.rows; row++) {
    for (let col = 0; col < maze.cols; col++) {
      if (maze.tiles[row * maze.cols + col] !== "door") continue;
      const c = cellCenter(col, row);
      ctx.fillStyle = palette.door;
      ctx.fillRect(c.x - 16, c.y - 3, 32, 6);
    }
  }
}

/** Draws the motes and pulsing pearls that are still on the board. */
export function drawMotes(
  ctx: CanvasRenderingContext2D,
  maze: Maze,
  eaten: Uint8Array,
  clock: number,
  palette: SkinPalette,
): void {
  ctx.save();
  for (const p of maze.pellets) {
    if (eaten[p.row * maze.cols + p.col]) continue;
    const c = cellCenter(p.col, p.row);
    if (p.kind === "mote") {
      ctx.fillStyle = palette.mote;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const r = 8 * (1 + 0.12 * Math.sin(clock * 6));
      ctx.shadowColor = palette.pearl;
      ctx.shadowBlur = 12;
      ctx.fillStyle = palette.pearl;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
  ctx.restore();
}

/** Streak ring around Glowmaw (fills toward the next multiplier step) and the x2..x5 tag. */
export function drawStreak(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  links: number,
  palette: SkinPalette,
): void {
  if (links <= 0) return;
  const fill = ((links - 1) % STREAK_STEP) / STREAK_STEP;
  const mult = streakMultiplier(links);
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = palette.ring;
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.arc(x, y, RING_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (fill > 0) {
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(x, y, RING_RADIUS, -Math.PI / 2, -Math.PI / 2 + fill * Math.PI * 2, false);
    ctx.stroke();
  }
  if (mult > 1) {
    ctx.fillStyle = palette.tag;
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`x${mult}`, x, y - RING_RADIUS - 5);
  }
  ctx.restore();
}
