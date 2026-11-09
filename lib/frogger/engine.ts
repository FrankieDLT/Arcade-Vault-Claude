import {
  CELL,
  CLEAR_TIME,
  COLS,
  DEATH_TIME,
  GOAL_POINTS,
  GOAL_SLOTS,
  H,
  JUMP_TIME,
  MAX_DT,
  MAX_LEVEL,
  ROUND_POINTS,
  ROW_GOALS,
  ROW_POINTS,
  ROW_RIVER_BOT,
  ROW_RIVER_TOP,
  ROW_START,
  ROWS,
  SKINS,
  START_COL,
  START_LIVES,
  TIME_POINTS,
  TIME_RATE,
  W,
  type SkinId,
  type SkinPalette,
} from "./constants";
import {
  advanceLanes,
  buildLanes,
  drawBackground,
  drawFrogShape,
  drawLanes,
  drawTimeBar,
  getSupport,
  hitsVehicle,
  refreshTurtles,
  type Lane,
} from "./entities";
import { clamp, clampScore, goalSlotAt, roundTime, type Direction } from "./utils";

export type FroggerSkin = SkinId;

export interface FroggerCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
  /** Sparse haptic events (`death`, `clear`); fired only from `update`. */
  onHaptic?: (name: string) => void;
}

type Phase = "play" | "dying" | "clear" | "over";

const KEY_DIR: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
};

const STEP: Record<Direction, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

interface FrogState {
  /** Left edge in cells (float: a frog riding a log is between cells). */
  x: number;
  /** Row (integer while still; float while hopping). */
  y: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  animating: boolean;
  animT: number;
  facing: Direction;
}

export class FroggerEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly cb: FroggerCallbacks;

  private skin: SkinId;
  private palette: SkinPalette;

  private rafId = 0;
  private lastTs = 0;
  private started = false;
  private destroyed = false;
  private paused = false;
  private listening = false;
  private gameOverFired = false;

  private phase: Phase = "play";
  private phaseT = 0;
  private clock = 0;

  private score = 0;
  private lives = START_LIVES;
  private level = 1;
  private shown = { score: -1, lives: -1, level: -1 };

  private lanes: Lane[] = buildLanes(1);
  private goals: boolean[] = GOAL_SLOTS.map(() => false);
  private frog: FrogState = this.freshFrog();
  private bestRow = ROW_START;
  private timeLeft = roundTime(1);
  private pending: Direction | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    callbacks: FroggerCallbacks,
    options?: { skin?: FroggerSkin },
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Frogger: 2D canvas is not available");
    this.canvas = canvas;
    this.ctx = ctx;
    this.cb = callbacks;
    canvas.width = W;
    canvas.height = H;
    this.skin = options?.skin ?? "retro";
    this.palette = SKINS[this.skin];
    refreshTurtles(this.lanes, 0);
    this.draw();
  }

  // ---- public API -------------------------------------------------------

  start(): void {
    if (this.started || this.destroyed) return;
    this.started = true;
    this.score = 0;
    this.lives = START_LIVES;
    this.level = 1;
    this.gameOverFired = false;
    this.paused = false;
    this.clock = 0;
    this.lanes = buildLanes(1);
    this.goals = GOAL_SLOTS.map(() => false);
    this.phase = "play";
    this.respawn();
    this.emitAll();
    this.attach();
    this.lastTs = 0;
    this.rafId = requestAnimationFrame(this.loop);
    this.draw();
  }

  pause(): void {
    this.paused = true;
    this.pending = null;
  }

  resume(): void {
    this.paused = false;
    this.lastTs = 0;
  }

  end(): void {
    if (!this.started || this.destroyed) return;
    this.finishGame();
  }

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.detach();
  }

  setSkin(skin: FroggerSkin): void {
    this.skin = skin;
    this.palette = SKINS[skin];
    this.draw();
  }

  // ---- callbacks (fire only on change) ----------------------------------

  private emitScore(): void {
    if (this.score === this.shown.score) return;
    this.shown.score = this.score;
    this.cb.onScore(this.score);
  }

  private emitLives(): void {
    if (this.lives === this.shown.lives) return;
    this.shown.lives = this.lives;
    this.cb.onLives(this.lives);
  }

  private emitLevel(): void {
    if (this.level === this.shown.level) return;
    this.shown.level = this.level;
    this.cb.onLevel(this.level);
  }

  private emitAll(): void {
    this.emitScore();
    this.emitLives();
    this.emitLevel();
  }

  private addScore(n: number): void {
    this.score = clampScore(this.score + n);
    this.emitScore();
  }

  // ---- input ------------------------------------------------------------

  private attach(): void {
    if (this.listening) return;
    this.listening = true;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("blur", this.onBlur);
  }

  private detach(): void {
    if (!this.listening) return;
    this.listening = false;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("blur", this.onBlur);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.paused || this.phase === "over" || this.destroyed) return;
    const dir = KEY_DIR[e.code];
    if (!dir) return;
    e.preventDefault();
    if (e.repeat) return;
    if (this.phase === "play") this.pending = dir;
  };

  private onBlur = (): void => {
    this.pending = null;
  };

  // ---- loop -------------------------------------------------------------

  private loop = (ts: number): void => {
    if (this.destroyed || this.phase === "over") return;
    this.rafId = requestAnimationFrame(this.loop);
    if (!this.lastTs) this.lastTs = ts;
    const dt = Math.min(MAX_DT, Math.max(0, (ts - this.lastTs) / 1000));
    this.lastTs = ts;
    if (this.paused) return;
    this.update(dt);
    if (!this.gameOverFired) this.draw();
  };

  private update(dt: number): void {
    this.clock += dt;
    if (this.phase === "dying") {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this.finishDeath();
      return;
    }
    if (this.phase === "clear") {
      this.phaseT -= dt;
      if (this.phaseT <= 0) this.finishClear();
      return;
    }
    if (this.phase !== "play") return;

    advanceLanes(this.lanes, dt, this.clock);
    this.timeLeft -= dt * TIME_RATE;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.die();
      return;
    }
    this.updateFrog(dt);
  }

  // ---- frog -------------------------------------------------------------

  private freshFrog(): FrogState {
    return {
      x: START_COL,
      y: ROW_START,
      fromX: START_COL,
      fromY: ROW_START,
      toX: START_COL,
      toY: ROW_START,
      animating: false,
      animT: 0,
      facing: "up",
    };
  }

  /** Put the frog on the start row and refill the round timer. */
  private respawn(): void {
    this.frog = this.freshFrog();
    this.bestRow = ROW_START;
    this.timeLeft = roundTime(this.level);
    this.pending = null;
  }

  private updateFrog(dt: number): void {
    const f = this.frog;

    if (f.animating) {
      f.animT += dt;
      const t = Math.min(1, f.animT / JUMP_TIME);
      f.x = f.fromX + (f.toX - f.fromX) * t;
      f.y = f.fromY + (f.toY - f.fromY) * t;
      if (t >= 1) {
        f.animating = false;
        f.animT = 0;
        f.x = f.toX;
        f.y = f.toY;
        this.land();
        if (this.phase !== "play") return;
      }
    } else if (this.pending) {
      const dir = this.pending;
      this.pending = null;
      this.startJump(dir);
    } else {
      this.ride(dt);
      if (this.phase !== "play") return;
    }

    // A vehicle can hit the frog on the row it is on, also mid-hop.
    if (hitsVehicle(this.lanes, f.x, Math.round(f.y))) this.die();
  }

  private startJump(dir: Direction): void {
    const f = this.frog;
    const { dx, dy } = STEP[dir];
    const toX = clamp(f.x + dx, 0, COLS - 1);
    const toY = clamp(f.y + dy, ROW_GOALS, ROWS - 1);
    f.facing = dir;
    if (toX === f.x && toY === f.y) return;
    f.fromX = f.x;
    f.fromY = f.y;
    f.toX = toX;
    f.toY = toY;
    f.animating = true;
    f.animT = 0;
  }

  /** A hop finished: score new rows, then resolve the cell it landed on. */
  private land(): void {
    const f = this.frog;
    const row = Math.round(f.y);
    if (row < this.bestRow) {
      this.addScore((this.bestRow - row) * ROW_POINTS);
      this.bestRow = row;
    }

    if (row === ROW_GOALS) {
      this.enterGoal();
    } else if (row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT) {
      if (!getSupport(this.lanes, f.x, row)) this.die();
    } else {
      // Safe rows and the road are cell-aligned.
      f.x = Math.round(f.x);
    }
  }

  /** While standing on a river row: drift with the support, die if there is none. */
  private ride(dt: number): void {
    const f = this.frog;
    const row = Math.round(f.y);
    if (row < ROW_RIVER_TOP || row > ROW_RIVER_BOT) return;
    const lane = this.lanes.find((l) => l.row === row);
    const support = getSupport(this.lanes, f.x, row);
    if (!lane || !support) {
      this.die();
      return;
    }
    f.x += lane.speed * lane.dir * dt;
    f.toX = f.x;
    const cx = f.x + 0.5;
    if (cx < 0 || cx > COLS) this.die();
  }

  private enterGoal(): void {
    const f = this.frog;
    const col = Math.round(f.x);
    const slot = goalSlotAt(col);
    if (slot < 0 || this.goals[slot]) {
      this.die();
      return;
    }
    this.goals[slot] = true;
    this.addScore(GOAL_POINTS + Math.floor(this.timeLeft) * TIME_POINTS);

    if (this.goals.every(Boolean)) {
      this.addScore(ROUND_POINTS);
      this.cb.onHaptic?.("clear");
      this.phase = "clear";
      this.phaseT = CLEAR_TIME;
      this.pending = null;
      return;
    }
    this.frog = this.freshFrog();
    this.bestRow = ROW_START;
    this.timeLeft = roundTime(this.level);
    this.pending = null;
  }

  // ---- rounds, death ----------------------------------------------------

  private finishClear(): void {
    this.level = clamp(this.level + 1, 1, MAX_LEVEL);
    this.emitLevel();
    this.lanes = buildLanes(this.level);
    refreshTurtles(this.lanes, this.clock);
    this.goals = GOAL_SLOTS.map(() => false);
    this.respawn();
    this.phase = "play";
  }

  private die(): void {
    if (this.phase !== "play") return;
    this.lives = Math.max(0, this.lives - 1);
    this.emitLives();
    this.cb.onHaptic?.("death");
    this.phase = "dying";
    this.phaseT = DEATH_TIME;
    this.pending = null;
  }

  private finishDeath(): void {
    if (this.lives <= 0) {
      this.finishGame();
      return;
    }
    this.respawn();
    this.phase = "play";
  }

  private finishGame(): void {
    if (this.gameOverFired) return;
    this.gameOverFired = true;
    this.lives = 0;
    this.emitLives();
    this.phase = "over";
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.detach();
    this.draw();
    this.cb.onGameOver(this.score);
  }

  // ---- drawing ----------------------------------------------------------

  private draw(): void {
    const ctx = this.ctx;
    const p = this.palette;
    drawBackground(ctx, p, this.goals, this.clock);
    drawLanes(ctx, p, this.lanes);

    if (this.phase !== "clear") {
      const f = this.frog;
      const cx = (f.x + 0.5) * CELL;
      const cy = (f.y + 0.5) * CELL;
      const jump = f.animating ? Math.min(1, f.animT / JUMP_TIME) : 0;
      const dead = this.phase === "dying" || (this.phase === "over" && this.lives <= 0);
      drawFrogShape(ctx, p, cx, cy, f.facing, jump, dead ? p.frogDead : p.frog);
    }

    drawTimeBar(ctx, p, this.timeLeft / roundTime(this.level));
  }
}
