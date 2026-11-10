import {
  DUAL_GAP,
  ENEMY_SHOT_H,
  ENEMY_SHOT_W,
  H,
  PLAYER_Y,
  SHOT_H,
  SHOT_W,
  W,
  type DogfightPalette,
  type EnemyKind,
} from "./constants";
import type { Path } from "./paths";
import { badgesFor, beamGeometry } from "./utils";

export type { EnemyKind } from "./constants";

export type EnemyMode =
  | "entering" // flying its entry path toward the slot
  | "formation" // parked in its slot (sway and breathing)
  | "diving" // on an attack path
  | "returning" // re-entering from the top (or from the beam) toward its slot
  | "beaming" // Boss only: stopped, emitting the tractor beam
  | "challenge" // Challenging Stage flight, never shoots, leaves the screen
  | "dead";

export interface Enemy {
  id: number;
  kind: EnemyKind;
  col: number; // 0..9, formation slot
  row: number; // 0..4
  mode: EnemyMode;
  t: number; // seconds on the current path (negative = waiting to launch)
  x: number;
  y: number; // center, px
  hp: number; // Boss starts at 2, others 1
  carrying: boolean; // Boss holds a captured fighter above it
  escortOf: number | null; // Boss id when diving as an escort
  wave: number; // 0..4, entry group
  path: Path; // current flight
  dur: number; // seconds the current flight takes
  angle: number; // heading, radians (0 = facing down)
  fromX: number; // start of a `returning` glide
  fromY: number;
  retDur: number; // seconds a `returning` glide takes
  fireAt: number[]; // path times at which this ship fires, ascending
  beamDive: boolean; // Boss dive that ends in a tractor beam
}

export interface Fighter {
  x: number; // center of the pair, px
  dual: boolean; // two ships side by side
  alive: boolean;
  state: "ready" | "playing" | "captured" | "respawning";
  respawnIn: number; // seconds, engine clock
}

export interface Shot {
  x: number;
  y: number; // top of the bullet
}

export interface EnemyShot {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface RescuePod {
  x: number;
  y: number;
  angle: number;
}

export interface Beam {
  bossId: number;
  t: number;
  x: number; // the Boss is stopped here
  y: number;
}

export interface Star {
  x: number;
  y: number;
  speed: number;
  phase: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Sprites as horizontal runs [x, y, width] in cells, parsed once from the pictures below ('#' = filled).
type Runs = [number, number, number][];

function toRuns(rows: string[]): Runs {
  const runs: Runs = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== "#") {
        x++;
        continue;
      }
      const start = x;
      while (x < row.length && row[x] === "#") x++;
      runs.push([start, y, x - start]);
    }
  });
  return runs;
}

const CELL = 2; // px per cell: enemies are 14 x 12 cells (28 x 24 px), the fighter 13 x 13 (26 x 26 px)

const BEE_A = toRuns([
  "#............#",
  "##..........##",
  "##..######..##",
  ".##.######.##.",
  ".###.####.###.",
  "..##########..",
  "...##.##.##...",
  "...########...",
  "....######....",
  ".....#..#.....",
  "....#....#....",
  "...#......#...",
]);
const BEE_B = toRuns([
  "...#......#...",
  "....#....#....",
  "....######....",
  "...########...",
  "..##########..",
  ".###.####.###.",
  "##..######..##",
  "##..##..##..##",
  "#...######...#",
  "....##..##....",
  "....#....#....",
  "...##....##...",
]);
const BUTTERFLY_A = toRuns([
  "##..........##",
  "###........###",
  "####..##..####",
  "#####.##.#####",
  "#####.##.#####",
  ".####.##.####.",
  "..###.##.###..",
  "...##.##.##...",
  "..###.##.###..",
  ".####....####.",
  "####......####",
  "###........###",
]);
const BUTTERFLY_B = toRuns([
  "....#....#....",
  ".....#..#.....",
  "...########...",
  "..##########..",
  "..###.##.###..",
  "..###.##.###..",
  "..###.##.###..",
  "..##########..",
  "...###..###...",
  "...##....##...",
  "....#....#....",
  "....#....#....",
]);
const BOSS_A = toRuns([
  "#..#......#..#",
  "##.##....##.##",
  "##.########.##",
  ".############.",
  "##############",
  "###..####..###",
  ".############.",
  "..####..####..",
  "..###....###..",
  "..##......##..",
  "..#........#..",
  "..#........#..",
]);
const BOSS_B = toRuns([
  ".#..#....#..#.",
  ".##.##..##.##.",
  "..##########..",
  ".############.",
  "##############",
  "###..####..###",
  ".############.",
  "..####..####..",
  ".###......###.",
  ".##........##.",
  "##..........##",
  "#............#",
]);
const FIGHTER = toRuns([
  "......#......",
  "......#......",
  ".....###.....",
  ".....###.....",
  "#....###....#",
  "#....###....#",
  "##..#####..##",
  "##.#######.##",
  "#############",
  "####.###.####",
  "###..###..###",
  "##...###...##",
  "#....###....#",
]);

const ENEMY_FRAMES: Record<EnemyKind, [Runs, Runs]> = {
  bee: [BEE_A, BEE_B],
  butterfly: [BUTTERFLY_A, BUTTERFLY_B],
  boss: [BOSS_A, BOSS_B],
};

const FIGHTER_SIZE = 13;

function fillRuns(ctx: CanvasRenderingContext2D, runs: Runs, x: number, y: number, cell: number) {
  for (const [rx, ry, rw] of runs) ctx.fillRect(x + rx * cell, y + ry * cell, rw * cell, cell);
}

export function drawField(ctx: CanvasRenderingContext2D, palette: DogfightPalette): void {
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, W, H);
}

/** Starfield: three brightness levels by speed, a slow twinkle by phase. */
export function drawStars(
  ctx: CanvasRenderingContext2D,
  stars: Star[],
  palette: DogfightPalette,
  clock: number,
): void {
  ctx.fillStyle = palette.star;
  for (const s of stars) {
    if (Math.sin(clock * 2.5 + s.phase) < -0.7) continue;
    ctx.globalAlpha = s.speed > 70 ? 0.9 : s.speed > 45 ? 0.6 : 0.35;
    const size = s.speed > 70 ? 2 : 1;
    ctx.fillRect(Math.floor(s.x), Math.floor(s.y), size, size);
  }
  ctx.globalAlpha = 1;
}

/** `flap` is 0 or 1 and flips on a fixed beat. */
export function drawEnemy(
  ctx: CanvasRenderingContext2D,
  e: Enemy,
  palette: DogfightPalette,
  flap: number,
): void {
  const color =
    e.kind === "bee"
      ? palette.bee
      : e.kind === "butterfly"
        ? palette.butterfly
        : e.hp < 2
          ? palette.bossHit
          : palette.boss;
  ctx.fillStyle = color;
  const runs = ENEMY_FRAMES[e.kind][flap];
  if (Math.abs(e.angle) < 0.01) {
    fillRuns(ctx, runs, Math.round(e.x - 14), Math.round(e.y - 12), CELL);
    return;
  }
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.rotate(e.angle);
  fillRuns(ctx, runs, -14, -12, CELL);
  ctx.restore();
}

/** One fighter ship centered on (cx, cy). `cell` 2 = full size, 1 = reserve icon. */
export function drawFighterShip(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string,
  glow: number,
  cell = CELL,
): void {
  ctx.fillStyle = color;
  if (glow > 0) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
  }
  const half = (FIGHTER_SIZE * cell) / 2;
  fillRuns(ctx, FIGHTER, Math.round(cx - half), Math.round(cy - half), cell);
  ctx.shadowBlur = 0;
}

/** The player's fighter: one ship, or two side by side when `dual`. */
export function drawFighter(
  ctx: CanvasRenderingContext2D,
  x: number,
  dual: boolean,
  palette: DogfightPalette,
): void {
  if (dual) {
    drawFighterShip(ctx, x - DUAL_GAP / 2, PLAYER_Y, palette.fighter, palette.glow);
    drawFighterShip(ctx, x + DUAL_GAP / 2, PLAYER_Y, palette.fighter, palette.glow);
  } else {
    drawFighterShip(ctx, x, PLAYER_Y, palette.fighter, palette.glow);
  }
}

/** A captured / rescued ship, spinning by `angle`. */
export function drawCapturedShip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  color: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  drawFighterShip(ctx, 0, 0, color, 0);
  ctx.restore();
}

export function drawShot(
  ctx: CanvasRenderingContext2D,
  shot: Shot,
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

export function drawEnemyShot(
  ctx: CanvasRenderingContext2D,
  shot: EnemyShot,
  color: string,
): void {
  ctx.fillStyle = color;
  const wiggle = Math.floor(shot.y / 5) % 2 === 0 ? 0 : 1;
  ctx.fillRect(shot.x - ENEMY_SHOT_W / 2 + wiggle, shot.y, ENEMY_SHOT_W - 1, ENEMY_SHOT_H / 2);
  ctx.fillRect(
    shot.x - ENEMY_SHOT_W / 2 + 1 - wiggle,
    shot.y + ENEMY_SHOT_H / 2,
    ENEMY_SHOT_W - 1,
    ENEMY_SHOT_H / 2,
  );
}

/** Tractor beam: a plain-alpha cone with stripes sliding down it. No blur, no blend modes. */
export function drawBeam(
  ctx: CanvasRenderingContext2D,
  beam: Beam,
  palette: DogfightPalette,
): void {
  const g = beamGeometry(beam);
  ctx.fillStyle = palette.beam;
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.moveTo(beam.x - g.hw0, g.y0);
  ctx.lineTo(beam.x + g.hw0, g.y0);
  ctx.lineTo(beam.x + g.hw1, g.y1);
  ctx.lineTo(beam.x - g.hw1, g.y1);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 0.5;
  const length = g.y1 - g.y0;
  if (length > 0) {
    const gap = 22;
    for (let k = 0; k * gap < length; k++) {
      const off = (k * gap + beam.t * 90) % length;
      const y = g.y0 + off;
      const hw = g.hw0 + (y - g.y0) * (g.hw1 - g.hw0) / length;
      ctx.fillRect(beam.x - hw, y, hw * 2, 3);
    }
  }
  ctx.globalAlpha = 1;
}

/** Reserve fighters (lives - 1) bottom-left. */
export function drawReserve(
  ctx: CanvasRenderingContext2D,
  count: number,
  palette: DogfightPalette,
): void {
  for (let i = 0; i < Math.min(count, 4); i++) {
    drawFighterShip(ctx, 18 + i * 20, H - 16, palette.fighter, 0, 1);
  }
}

/** Stage badges bottom-right: pennant = 1, shield = 5, winged shield = 10 and up. */
export function drawBadges(
  ctx: CanvasRenderingContext2D,
  stage: number,
  palette: DogfightPalette,
): void {
  let x = W - 10;
  for (const v of badgesFor(stage)) {
    const w = v >= 10 ? 16 : v >= 5 ? 12 : 8;
    x -= w;
    const y = H - 24;
    ctx.fillStyle = palette.boss;
    if (v >= 10) {
      ctx.fillRect(x, y, w, 10);
      ctx.fillRect(x + 3, y + 10, w - 6, 4);
      ctx.fillStyle = palette.bg;
      ctx.fillRect(x + w / 2 - 1, y + 2, 2, 8);
    } else if (v >= 5) {
      ctx.fillRect(x, y, w, 8);
      ctx.fillRect(x + 2, y + 8, w - 4, 4);
    } else {
      ctx.fillRect(x, y, 2, 14);
      ctx.fillRect(x + 2, y, w - 2, 6);
    }
    x -= 4;
  }
}

export interface BannerLine {
  text: string;
  size: number;
  color: string;
}

/** Centered banner text, one line per entry, centered vertically on `cy`. */
export function drawBanner(ctx: CanvasRenderingContext2D, lines: BannerLine[], cy: number): void {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const gap = 10;
  const total = lines.reduce((sum, l) => sum + l.size, 0) + gap * (lines.length - 1);
  let y = cy - total / 2;
  for (const line of lines) {
    ctx.font = `bold ${line.size}px "Courier New", monospace`;
    ctx.fillStyle = line.color;
    ctx.fillText(line.text, W / 2, y + line.size / 2);
    y += line.size + gap;
  }
}
