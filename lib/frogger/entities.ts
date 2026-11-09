import {
  CELL,
  COLS,
  GOAL_SLOTS,
  GOAL_SPAN,
  H,
  LANE_TEMPLATES,
  ROW_GOALS,
  ROW_RIVER_BOT,
  ROW_RIVER_TOP,
  ROW_ROAD_BOT,
  ROW_ROAD_TOP,
  ROW_SAFE_MID,
  ROW_START,
  TURTLE_DOWN,
  TURTLE_UP,
  TURTLE_WARN,
  W,
  type EntityType,
  type LaneKind,
  type SkinPalette,
} from "./constants";
import { speedFactor, wrapCol, type Direction } from "./utils";

export interface Entity {
  /** Left edge in cells (float). */
  col: number;
  width: number;
  type: EntityType;
  /** Seconds offset of this turtle group inside the dive cycle. */
  phase: number;
  /** True while a turtle is underwater (no support). */
  submerged: boolean;
  /** True during the last moments before a dive. */
  warning: boolean;
  /** Index used to vary colors. */
  variant: number;
}

export interface Lane {
  row: number;
  kind: LaneKind;
  /** Cells per second, already scaled by the level. */
  speed: number;
  dir: 1 | -1;
  entities: Entity[];
}

/** Build every lane for a level: same layout, speeds scaled by the level. */
export const buildLanes = (level: number): Lane[] => {
  const factor = speedFactor(level);
  return LANE_TEMPLATES.map((t) => ({
    row: t.row,
    kind: t.kind,
    speed: t.speed * factor,
    dir: t.dir,
    entities: t.entities.map(([col, width, type], i) => ({
      col: wrapCol(col),
      width,
      type,
      phase: i * (TURTLE_UP + TURTLE_DOWN) / 3,
      submerged: false,
      warning: false,
      variant: i,
    })),
  }));
};

/** Move every entity of every lane and refresh the turtle dive state. */
export const advanceLanes = (lanes: Lane[], dt: number, clock: number): void => {
  const cycle = TURTLE_UP + TURTLE_DOWN;
  for (const lane of lanes) {
    for (const e of lane.entities) {
      e.col = wrapCol(e.col + lane.speed * lane.dir * dt);
      if (e.type === "turtle") {
        const t = (clock + e.phase) % cycle;
        e.submerged = t >= TURTLE_UP;
        e.warning = !e.submerged && t >= TURTLE_UP - TURTLE_WARN;
      }
    }
  }
};

/** Update turtle dive state without moving anything (initial draw). */
export const refreshTurtles = (lanes: Lane[], clock: number): void => advanceLanes(lanes, 0, clock);

export const laneAt = (lanes: Lane[], row: number): Lane | undefined =>
  lanes.find((l) => l.row === row);

/** Does a frog box [x + 0.15, x + 0.85] on a road row hit a vehicle? */
export const hitsVehicle = (lanes: Lane[], x: number, row: number): boolean => {
  if (row < ROW_ROAD_TOP || row > ROW_ROAD_BOT) return false;
  const lane = laneAt(lanes, row);
  if (!lane) return false;
  const f0 = x + 0.15;
  const f1 = x + 0.85;
  return lane.entities.some((e) => f0 < e.col + e.width - 0.05 && e.col + 0.05 < f1);
};

/** The log or visible turtle group under the frog center on a river row, or null. */
export const getSupport = (lanes: Lane[], x: number, row: number): Entity | null => {
  if (row < ROW_RIVER_TOP || row > ROW_RIVER_BOT) return null;
  const lane = laneAt(lanes, row);
  if (!lane) return null;
  const cx = x + 0.5;
  for (const e of lane.entities) {
    if (e.type === "turtle" && e.submerged) continue;
    if (cx >= e.col && cx < e.col + e.width) return e;
  }
  return null;
};

// ---- drawing -----------------------------------------------------------

const rowY = (row: number): number => row * CELL;

const rect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string): void => {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
};

const roundRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
): void => {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
};

const circle = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string): void => {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};

/** Zone backgrounds, lane dashes and river waves. `clock` animates the waves. */
export const drawBackground = (
  ctx: CanvasRenderingContext2D,
  p: SkinPalette,
  goals: readonly boolean[],
  clock: number,
): void => {
  // Goal row: walls with 5 slots.
  rect(ctx, 0, rowY(ROW_GOALS), W, CELL, p.goalWall);
  GOAL_SLOTS.forEach((start, i) => {
    const x = start * CELL;
    rect(ctx, x, rowY(ROW_GOALS), GOAL_SPAN * CELL, CELL, p.goalSlot);
    ctx.strokeStyle = p.goalBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, rowY(ROW_GOALS) + 1, GOAL_SPAN * CELL - 2, CELL - 2);
    if (goals[i]) drawFrogShape(ctx, p, x + CELL, rowY(ROW_GOALS) + CELL / 2, "down", 0, p.frog);
  });

  // River.
  rect(ctx, 0, rowY(ROW_RIVER_TOP), W, (ROW_RIVER_BOT - ROW_RIVER_TOP + 1) * CELL, p.river);
  ctx.strokeStyle = p.riverWave;
  ctx.lineWidth = 2;
  for (let row = ROW_RIVER_TOP; row <= ROW_RIVER_BOT; row++) {
    const y = rowY(row) + CELL / 2;
    const shift = ((clock * 14 * (row % 2 === 0 ? 1 : -1)) % 40 + 40) % 40;
    ctx.beginPath();
    for (let x = -40 + shift; x < W; x += 40) {
      ctx.moveTo(x + 6, y);
      ctx.quadraticCurveTo(x + 14, y - 5, x + 22, y);
    }
    ctx.stroke();
  }

  // Median and start rows.
  for (const row of [ROW_SAFE_MID, ROW_START]) {
    rect(ctx, 0, rowY(row), W, CELL, p.safe);
    rect(ctx, 0, rowY(row), W, 3, p.safeEdge);
    rect(ctx, 0, rowY(row) + CELL - 3, W, 3, p.safeEdge);
  }

  // Road with dashed lane dividers.
  rect(ctx, 0, rowY(ROW_ROAD_TOP), W, (ROW_ROAD_BOT - ROW_ROAD_TOP + 1) * CELL, p.road);
  ctx.fillStyle = p.roadLine;
  for (let row = ROW_ROAD_TOP + 1; row <= ROW_ROAD_BOT; row++) {
    for (let x = 8; x < W; x += 56) ctx.fillRect(x, rowY(row) - 1, 28, 2);
  }
};

const drawCar = (ctx: CanvasRenderingContext2D, p: SkinPalette, e: Entity, row: number, dir: 1 | -1): void => {
  const x = e.col * CELL;
  const y = rowY(row);
  const w = e.width * CELL;
  const color = p.cars[e.variant % p.cars.length] ?? "#e03030";
  roundRect(ctx, x + 2, y + 7, w - 4, CELL - 14, 5, color);
  // Windshield on the leading end.
  const wx = dir === 1 ? x + w - 14 : x + 4;
  rect(ctx, wx, y + 11, 10, CELL - 22, "rgba(180,220,255,0.75)");
  circle(ctx, x + 10, y + 7, 4, p.wheel);
  circle(ctx, x + w - 10, y + 7, 4, p.wheel);
  circle(ctx, x + 10, y + CELL - 7, 4, p.wheel);
  circle(ctx, x + w - 10, y + CELL - 7, 4, p.wheel);
};

const drawTruck = (ctx: CanvasRenderingContext2D, p: SkinPalette, e: Entity, row: number, dir: 1 | -1): void => {
  const x = e.col * CELL;
  const y = rowY(row);
  const w = e.width * CELL;
  const cab = 34;
  const trailerX = dir === 1 ? x + 2 : x + cab;
  const cabX = dir === 1 ? x + w - cab : x + 2;
  roundRect(ctx, trailerX, y + 5, w - cab - 2, CELL - 10, 3, p.truckBody);
  roundRect(ctx, cabX, y + 7, cab - 2, CELL - 14, 5, p.truckCab);
  rect(ctx, dir === 1 ? cabX + cab - 14 : cabX + 4, y + 11, 8, CELL - 22, "rgba(180,220,255,0.75)");
  for (const wx of [x + 14, x + w / 2, x + w - 14]) {
    circle(ctx, wx, y + 6, 4, p.wheel);
    circle(ctx, wx, y + CELL - 6, 4, p.wheel);
  }
};

const drawLog = (ctx: CanvasRenderingContext2D, p: SkinPalette, e: Entity, row: number): void => {
  const x = e.col * CELL;
  const y = rowY(row);
  const w = e.width * CELL;
  roundRect(ctx, x + 1, y + 6, w - 2, CELL - 12, 8, p.log);
  ctx.strokeStyle = p.logLine;
  ctx.lineWidth = 2;
  for (let lx = x + 14; lx < x + w - 8; lx += 22) {
    ctx.beginPath();
    ctx.moveTo(lx, y + 11);
    ctx.lineTo(lx + 6, y + CELL - 11);
    ctx.stroke();
  }
};

const drawTurtles = (ctx: CanvasRenderingContext2D, p: SkinPalette, e: Entity, row: number): void => {
  const y = rowY(row);
  for (let i = 0; i < e.width; i++) {
    const cx = (e.col + i + 0.5) * CELL;
    const cy = y + CELL / 2;
    if (e.submerged) {
      ctx.strokeStyle = "rgba(158,232,180,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 13, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    circle(ctx, cx, cy - 1, 14, e.warning ? p.turtleWarn : p.turtle);
    circle(ctx, cx, cy - 1, 9, e.warning ? p.turtle : p.turtleShell);
    ctx.strokeStyle = p.turtleShell;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy - 1);
    ctx.lineTo(cx + 9, cy - 1);
    ctx.moveTo(cx, cy - 10);
    ctx.lineTo(cx, cy + 8);
    ctx.stroke();
  }
};

/** Draw every entity of every lane. */
export const drawLanes = (ctx: CanvasRenderingContext2D, p: SkinPalette, lanes: readonly Lane[]): void => {
  for (const lane of lanes) {
    for (const e of lane.entities) {
      if (e.col >= COLS || e.col + e.width <= 0) continue;
      if (e.type === "car") drawCar(ctx, p, e, lane.row, lane.dir);
      else if (e.type === "truck") drawTruck(ctx, p, e, lane.row, lane.dir);
      else if (e.type === "log") drawLog(ctx, p, e, lane.row);
      else drawTurtles(ctx, p, e, lane.row);
    }
  }
};

const FACING_ANGLE: Record<Direction, number> = {
  up: 0,
  right: Math.PI / 2,
  down: Math.PI,
  left: -Math.PI / 2,
};

/** Frog centered at (cx, cy). `jump` 0..1 stretches the legs and lifts the body. */
export const drawFrogShape = (
  ctx: CanvasRenderingContext2D,
  p: SkinPalette,
  cx: number,
  cy: number,
  facing: Direction,
  jump: number,
  body: string,
): void => {
  const lift = Math.sin(jump * Math.PI);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(FACING_ANGLE[facing]);
  ctx.scale(1 + 0.25 * lift, 1 + 0.25 * lift);
  // Legs: tucked at rest, spread during the jump.
  ctx.fillStyle = body;
  const spread = 3 + 6 * lift;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * (11 + spread / 2), 7 + spread, 4, 7, s * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(s * (10 + spread / 3), -7 - spread / 2, 3, 5, -s * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.frogBelly;
  ctx.beginPath();
  ctx.ellipse(0, 2, 6, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const s of [-1, 1]) {
    circle(ctx, s * 7, -9, 4.5, p.frogEye);
    circle(ctx, s * 7, -10, 2, "#000000");
  }
  ctx.restore();
};

/** Time bar along the bottom of the start row. `ratio` is remaining / total, 0..1. */
export const drawTimeBar = (ctx: CanvasRenderingContext2D, p: SkinPalette, ratio: number): void => {
  const r = Math.max(0, Math.min(1, ratio));
  const y = H - 10;
  rect(ctx, 0, y, W, 10, p.timeTrack);
  const color = r > 0.5 ? p.timeGood : r > 0.25 ? p.timeMid : p.timeLow;
  rect(ctx, 0, y, W * r, 10, color);
};
