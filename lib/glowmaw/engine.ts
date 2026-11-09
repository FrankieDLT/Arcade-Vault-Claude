import {
  CELL,
  CLEAR_BONUS,
  CLEAR_FLASH,
  CLEAR_TIME,
  COLS,
  DAZED_SPEED,
  DEATH_TIME,
  DEN_COL,
  DEN_REST,
  DEN_ROW,
  DRIFTER_POINTS,
  EAT_RADIUS,
  EXIT_ROW,
  EXTRA_LIFE_FIRST,
  EXTRA_LIFE_STEP,
  EYES_SPEED,
  FOURTH_LEVEL,
  H,
  KILL_RADIUS,
  MAX_DT,
  MAX_LEVEL,
  MAX_LIVES,
  MAX_STEP,
  MAZE_A,
  MAZE_X,
  MAZE_Y,
  MOTE_POINTS,
  PEARL_POINTS,
  PLAYER_SPEED,
  READY_TIME,
  RELEASE_TIMES,
  SKINS,
  START_LIVES,
  STREAK_GAP,
  W,
  type SkinId,
  type SkinPalette,
} from "./constants";
import {
  Drifter,
  Glowmaw,
  drawMaze,
  drawMotes,
  drawStreak,
  type DrifterKind,
} from "./entities";
import {
  DIRS,
  buildDistanceField,
  clamp,
  clampScore,
  dazeTime,
  drifterSpeed,
  isOpen,
  neighbor,
  opposite,
  parseMaze,
  pickStraightLine,
  pickWallFollow,
  streakMultiplier,
  type Dir,
  type Maze,
} from "./utils";

export type GlowmawSkin = SkinId;

export interface GlowmawCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
  /** Sparse haptic events (`pearl`, `death`, `clear`); fired only from `update`. */
  onHaptic?: (name: string) => void;
}

type Phase = "ready" | "play" | "dying" | "clear" | "over";

const KEY_DIR: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
};

const KINDS: readonly DrifterKind[] = ["hunter", "mirror", "roamer", "pacer"];

/** Fastest mover (eyes), px/s: sets how many sub-steps a frame needs. */
const FASTEST_PX = EYES_SPEED * CELL;
const MAZE_PX_W = COLS * CELL;

export class GlowmawEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly cb: GlowmawCallbacks;
  private readonly maze: Maze = parseMaze(MAZE_A);
  private readonly denField: Int32Array;

  private skin: SkinId;
  private palette: SkinPalette;
  private staticNormal: HTMLCanvasElement | null = null;
  private staticFlash: HTMLCanvasElement | null = null;

  private rafId = 0;
  private lastTs = 0;
  private started = false;
  private destroyed = false;
  private paused = false;
  private listening = false;
  private gameOverFired = false;

  private phase: Phase = "ready";
  private phaseT = READY_TIME;
  private clock = 0;

  private score = 0;
  private lives = START_LIVES;
  private level = 1;
  private nextExtra = EXTRA_LIFE_FIRST;
  private shown = { score: -1, lives: -1, level: -1 };

  private eaten: Uint8Array;
  private remaining = 0;
  private links = 0;
  private lastEat = 0;
  private dazeChain = 0;

  private wanted: Dir | null = null;
  private facing: Dir = "left";
  private readonly glow = new Glowmaw();
  private drifters: Drifter[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    callbacks: GlowmawCallbacks,
    options?: { skin?: GlowmawSkin },
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Glowmaw: 2D canvas is not available");
    this.canvas = canvas;
    this.ctx = ctx;
    this.cb = callbacks;
    canvas.width = W;
    canvas.height = H;
    this.skin = options?.skin ?? "abyss";
    this.palette = SKINS[this.skin];
    this.denField = buildDistanceField(this.maze, { col: DEN_COL, row: DEN_ROW });
    this.eaten = new Uint8Array(this.maze.cols * this.maze.rows);
    this.buildStatic();
    this.beginReef();
    this.draw();
  }

  // ---- public API -------------------------------------------------------

  start(): void {
    if (this.started || this.destroyed) return;
    this.started = true;
    this.score = 0;
    this.lives = START_LIVES;
    this.level = 1;
    this.nextExtra = EXTRA_LIFE_FIRST;
    this.gameOverFired = false;
    this.paused = false;
    this.clock = 0;
    this.beginReef();
    this.emitAll();
    this.attach();
    this.lastTs = 0;
    this.rafId = requestAnimationFrame(this.loop);
    this.draw();
  }

  pause(): void {
    this.paused = true;
    this.wanted = null;
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

  setSkin(skin: GlowmawSkin): void {
    this.skin = skin;
    this.palette = SKINS[skin];
    this.buildStatic();
    this.draw();
  }

  setLevel(level: number): void {
    if (this.destroyed || this.phase === "over" || this.gameOverFired || this.lives <= 0) return;
    this.level = clamp(Math.round(level), 1, MAX_LEVEL);
    this.emitLevel();
    this.beginReef();
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

  // ---- input ------------------------------------------------------------

  private attach(): void {
    if (this.listening) return;
    this.listening = true;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  private detach(): void {
    if (!this.listening) return;
    this.listening = false;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onVisibility);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.paused || this.phase === "over" || this.destroyed) return;
    const dir = KEY_DIR[e.code];
    if (!dir) return;
    e.preventDefault();
    if (e.repeat) return;
    this.wanted = dir;
    // A 180 degree reversal applies at once, even mid-tile.
    if (this.phase === "play" && this.glow.dir && dir === opposite(this.glow.dir)) {
      this.glow.dir = dir;
      this.facing = dir;
    }
  };

  private onBlur = (): void => {
    this.wanted = null;
  };

  private onVisibility = (): void => {
    if (document.hidden) this.wanted = null;
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
    switch (this.phase) {
      case "ready":
        this.phaseT -= dt;
        if (this.phaseT <= 0) this.phase = "play";
        break;
      case "dying":
        this.phaseT -= dt;
        if (this.phaseT <= 0) this.finishDeath();
        break;
      case "clear":
        this.phaseT -= dt;
        if (this.phaseT <= 0) this.finishClear();
        break;
      case "play": {
        const n = Math.max(1, Math.ceil((dt * FASTEST_PX) / MAX_STEP));
        const h = dt / n;
        for (let i = 0; i < n; i++) {
          this.step(h);
          if (this.phase !== "play") break;
        }
        break;
      }
      case "over":
        break;
    }
  }

  /** One movement sub-step: Glowmaw, eating, clear check, drifters, contacts. */
  private step(h: number): void {
    const g = this.glow;
    if (this.links > 0 && this.clock - this.lastEat > STREAK_GAP) this.links = 0;

    if (!g.dir) this.resolveGlowmaw();
    g.advance(PLAYER_SPEED * CELL * h, () => this.resolveGlowmaw());
    if (g.dir) this.facing = g.dir;

    this.tryEat();
    if (this.remaining === 0) {
      this.startClear();
      return;
    }

    for (const d of this.drifters) this.updateDrifter(d, h);
    this.contacts();
  }

  // ---- Glowmaw ----------------------------------------------------------

  private open(col: number, row: number, dir: Dir, door: boolean): boolean {
    const n = neighbor(col, row, dir);
    return isOpen(this.maze, n.col, n.row, door);
  }

  private resolveGlowmaw(): void {
    const g = this.glow;
    const c = g.cell;
    if (this.wanted && this.open(c.col, c.row, this.wanted, false)) {
      g.dir = this.wanted;
    } else if (g.dir && !this.open(c.col, c.row, g.dir, false)) {
      g.dir = null;
    }
  }

  private tryEat(): void {
    const g = this.glow;
    const col = clamp(Math.floor((g.x - MAZE_X) / CELL), 0, COLS - 1);
    const row = clamp(Math.floor((g.y - MAZE_Y) / CELL), 0, this.maze.rows - 1);
    const idx = row * this.maze.cols + col;
    const kind = this.maze.pelletAt[idx];
    if (!kind || this.eaten[idx]) return;
    const cx = MAZE_X + col * CELL + CELL / 2;
    const cy = MAZE_Y + row * CELL + CELL / 2;
    if (Math.hypot(g.x - cx, g.y - cy) > EAT_RADIUS) return;

    this.eaten[idx] = 1;
    this.remaining--;
    if (this.links > 0 && this.clock - this.lastEat <= STREAK_GAP) this.links++;
    else this.links = 1;
    this.lastEat = this.clock;

    if (kind === 2) {
      this.addScore(PEARL_POINTS);
      this.dazeAll();
      this.cb.onHaptic?.("pearl");
    } else {
      this.addScore(MOTE_POINTS * streakMultiplier(this.links));
    }
  }

  private addScore(n: number): void {
    this.score = clampScore(this.score + n);
    this.emitScore();
    while (this.score >= this.nextExtra) {
      if (this.lives < MAX_LIVES) {
        this.lives++;
        this.emitLives();
      }
      this.nextExtra += EXTRA_LIFE_STEP;
    }
  }

  // ---- drifters ---------------------------------------------------------

  private dazeAll(): void {
    this.dazeChain = 0;
    const t = dazeTime(this.level);
    for (const d of this.drifters) {
      if (d.state === "hunting") {
        d.state = "dazed";
        d.dazeLeft = t;
        if (d.dir) d.dir = opposite(d.dir);
      } else if (d.state === "dazed") {
        d.dazeLeft = t;
      }
    }
  }

  private updateDrifter(d: Drifter, h: number): void {
    if (d.state === "den") {
      d.wait -= h;
      if (d.wait <= 0) {
        const c = d.cell;
        d.state = "leaving";
        d.dir = c.col === DEN_COL ? "up" : c.col < DEN_COL ? "right" : "left";
      }
      return;
    }
    if (d.state === "dazed") {
      d.dazeLeft -= h;
      if (d.dazeLeft <= 0) d.state = "hunting";
    }
    const tiles =
      d.state === "eyes" ? EYES_SPEED : d.state === "dazed" ? DAZED_SPEED : drifterSpeed(this.level);
    if (!d.dir) this.resolveDrifter(d);
    d.advance(tiles * CELL * h, () => this.resolveDrifter(d));
  }

  private resolveDrifter(d: Drifter): void {
    const c = d.cell;

    if (d.state === "eyes") {
      if (c.col === DEN_COL && c.row === DEN_ROW) {
        d.state = "den";
        d.wait = DEN_REST;
        d.dir = null;
        return;
      }
      let best: Dir | null = null;
      let bestV = Infinity;
      for (const dir of DIRS) {
        if (!this.open(c.col, c.row, dir, true)) continue;
        const n = neighbor(c.col, c.row, dir);
        const v = this.denField[n.row * this.maze.cols + n.col] ?? -1;
        if (v >= 0 && v < bestV) {
          bestV = v;
          best = dir;
        }
      }
      d.dir = best;
      return;
    }

    if (d.state === "leaving") {
      if (c.col !== DEN_COL) {
        d.dir = c.col < DEN_COL ? "right" : "left";
        return;
      }
      if (c.row > EXIT_ROW) {
        d.dir = "up";
        return;
      }
      d.state = "hunting";
    }

    // hunting or dazed: choose at the tile center.
    const all = DIRS.filter((dir) => this.open(c.col, c.row, dir, false));
    if (all.length === 0) {
      d.dir = null;
      return;
    }
    const back = d.dir ? opposite(d.dir) : null;
    const forward = all.filter((dir) => dir !== back);
    const options = forward.length > 0 ? forward : all;

    if (d.state === "dazed" || d.kind === "roamer") {
      d.dir = options[Math.floor(Math.random() * options.length)] ?? null;
    } else if (d.kind === "pacer") {
      d.dir = pickWallFollow(d.dir ?? "up", all);
    } else {
      const gc = this.glow.cell;
      const target =
        d.kind === "mirror"
          ? { col: this.maze.cols - 1 - gc.col, row: this.maze.rows - 1 - gc.row }
          : gc;
      d.dir = pickStraightLine(
        options.map((dir) => ({ dir, ...neighbor(c.col, c.row, dir) })),
        target,
      );
    }
  }

  private near(d: Drifter): boolean {
    const g = this.glow;
    let dx = Math.abs(g.x - d.x);
    dx = Math.min(dx, MAZE_PX_W - dx);
    return Math.hypot(dx, g.y - d.y) <= KILL_RADIUS;
  }

  private contacts(): void {
    for (const d of this.drifters) {
      if (d.state === "dazed" && this.near(d)) {
        this.dazeChain++;
        this.addScore(DRIFTER_POINTS * Math.min(4, this.dazeChain));
        d.state = "eyes";
        d.dazeLeft = 0;
      }
    }
    for (const d of this.drifters) {
      if ((d.state === "hunting" || d.state === "leaving") && this.near(d)) {
        this.loseLife();
        return;
      }
    }
  }

  // ---- sequences --------------------------------------------------------

  private loseLife(): void {
    this.lives = Math.max(0, this.lives - 1);
    this.emitLives();
    this.links = 0;
    this.cb.onHaptic?.("death");
    this.phase = "dying";
    this.phaseT = DEATH_TIME;
  }

  private finishDeath(): void {
    if (this.lives <= 0) {
      this.finishGame();
      return;
    }
    this.resetPositions();
  }

  private startClear(): void {
    this.addScore(CLEAR_BONUS);
    this.cb.onHaptic?.("clear");
    this.links = 0;
    this.phase = "clear";
    this.phaseT = CLEAR_TIME;
  }

  private finishClear(): void {
    this.level = Math.min(MAX_LEVEL, this.level + 1);
    this.emitLevel();
    this.beginReef();
  }

  /** Refills the pellets and starts the reef: positions reset, ready freeze. */
  private beginReef(): void {
    this.eaten.fill(0);
    this.remaining = this.maze.pellets.length;
    this.resetPositions();
  }

  private resetPositions(): void {
    const s = this.maze.start;
    this.glow.place(s.col, s.row);
    this.glow.dir = null;
    this.facing = "left";
    this.wanted = null;
    this.links = 0;
    this.dazeChain = 0;

    const count = this.level >= FOURTH_LEVEL ? 4 : 3;
    this.drifters = [];
    for (let i = 0; i < count; i++) {
      const kind = KINDS[i]!;
      const d = new Drifter(kind, i);
      d.wait = RELEASE_TIMES[i]!;
      if (kind === "hunter") {
        d.place(DEN_COL, EXIT_ROW);
        d.state = "hunting";
        d.dir = "left";
      } else {
        // Mirror in the middle of the den, Roamer to its right, Pacer to its left.
        d.place(kind === "mirror" ? DEN_COL : kind === "roamer" ? DEN_COL + 1 : DEN_COL - 1, DEN_ROW);
        d.state = "den";
      }
      this.drifters.push(d);
    }
    this.phase = "ready";
    this.phaseT = READY_TIME;
  }

  private finishGame(): void {
    if (this.gameOverFired) return;
    this.gameOverFired = true;
    this.phase = "over";
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.detach();
    this.draw();
    this.cb.onGameOver(this.score);
  }

  // ---- drawing ----------------------------------------------------------

  private buildStatic(): void {
    const make = (flash: boolean): HTMLCanvasElement => {
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const cx = c.getContext("2d");
      if (cx) drawMaze(cx, this.maze, this.palette, flash);
      return c;
    };
    this.staticNormal = make(false);
    this.staticFlash = make(true);
  }

  private draw(): void {
    const ctx = this.ctx;
    const flash = this.phase === "clear" && Math.floor(this.phaseT / CLEAR_FLASH) % 2 === 0;
    const bg = flash ? this.staticFlash : this.staticNormal;
    if (bg) ctx.drawImage(bg, 0, 0);
    else {
      ctx.fillStyle = this.palette.bg;
      ctx.fillRect(0, 0, W, H);
    }

    if (this.phase !== "clear") {
      drawMotes(ctx, this.maze, this.eaten, this.clock, this.palette);
      for (const d of this.drifters) d.draw(ctx, this.clock, this.palette);
    }

    const g = this.glow;
    if (this.phase === "dying") {
      g.drawDeath(ctx, 1 - this.phaseT / DEATH_TIME, this.palette, this.facing);
    } else if (!(this.phase === "over" && this.lives <= 0)) {
      g.draw(ctx, this.clock, this.palette, this.phase === "play" && g.dir !== null, this.facing);
      if (this.phase === "play") drawStreak(ctx, g.x, g.y, this.links, this.palette);
    }
  }
}
