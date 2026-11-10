import {
  BOMB_H,
  BOMB_SPEED,
  BOMB_W,
  CANNON_H,
  CANNON_SPEED,
  CANNON_W,
  CANNON_Y,
  COLS,
  FLEET_MARGIN,
  GROUND_Y,
  INVADER_H,
  INVADER_W,
  MAX_BOMBS,
  MAX_DT,
  MAX_STEP,
  PITCH_X,
  PITCH_Y,
  RESPAWN_DELAY,
  ROW_POINTS,
  SHOT_H,
  SHOT_SPEED,
  SHOT_W,
  SKINS,
  START_LIVES,
  STEP_DOWN,
  STEP_X,
  W,
  WAVE_BONUS,
  type InvadersPalette,
  type SpaceInvadersSkin,
} from "./constants";
import {
  drawBomb,
  drawCannon,
  drawField,
  drawInvader,
  drawShot,
  type Bullet,
  type Invader,
  type Rect,
} from "./entities";
import {
  bombInterval,
  clampLevel,
  clampScore,
  createInvaders,
  fleetStartY,
  invaderRect,
  lowestAliveInColumn,
  rectsOverlap,
  stepInterval,
} from "./utils";

export type { SpaceInvadersSkin } from "./constants";

export interface SpaceInvadersCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void; // once per run
  onSound?: (name: "shoot" | "hit" | "boom" | "gameover") => void;
  onHaptic?: (name: "death" | "clear") => void;
}

export interface SpaceInvadersOptions {
  skin?: SpaceInvadersSkin; // default "retro"
}

const FLEET_START_X = (W - ((COLS - 1) * PITCH_X + INVADER_W)) / 2;
const CANNON_START_X = W / 2;
const LEFT_KEYS = ["ArrowLeft", "KeyA"];
const RIGHT_KEYS = ["ArrowRight", "KeyD"];
const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "KeyA", "KeyD", "Space"]);

export class SpaceInvadersEngine {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly callbacks: SpaceInvadersCallbacks;
  private skin: SpaceInvadersSkin;

  // Lifecycle
  private started = false;
  private paused = false;
  private finished = false; // onGameOver already fired for this run
  private destroyed = false;
  private listening = false;
  private rafId: number | null = null;
  private lastTime: number | null = null;

  // Game state (instance-owned, nothing shared between engines)
  private invaders: Invader[] = [];
  private fleetX = FLEET_START_X;
  private fleetY = 0;
  private dir: 1 | -1 = 1;
  private frame: 0 | 1 = 0; // sprite frame, flips on every march step
  private stepTimer = 0;
  private cannonX = CANNON_START_X;
  private shot: Bullet | null = null;
  private bombs: Bullet[] = [];
  private bombTimer = 0;
  private respawnIn = 0;
  private score = 0;
  private lives = START_LIVES;
  private level = 1;
  private clock = 0; // seconds, advanced only in update (drives the respawn blink)
  private held = new Set<string>();

  // Last values sent to the callbacks, so they only fire on change.
  private emittedScore = NaN;
  private emittedLives = NaN;
  private emittedLevel = NaN;

  constructor(
    canvas: HTMLCanvasElement,
    callbacks: SpaceInvadersCallbacks,
    options: SpaceInvadersOptions = {},
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("SpaceInvadersEngine: 2D canvas context is not available");
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.skin = options.skin && options.skin in SKINS ? options.skin : "retro";
    this.initGame();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  start(): void {
    if (this.started || this.destroyed) return;
    this.started = true;
    this.paused = false;
    this.finished = false;
    this.initGame();
    this.emitChanges();
    this.attachListeners();
    this.draw();
    this.schedule();
  }

  pause(): void {
    if (!this.started || this.paused || this.finished || this.destroyed) return;
    this.paused = true;
    this.cancelFrame();
    this.clearInput();
    this.lastTime = null;
  }

  resume(): void {
    if (!this.started || !this.paused || this.finished || this.destroyed) return;
    this.paused = false;
    this.lastTime = null; // first frame after resume has dt = 0, so no time jump
    this.schedule();
  }

  end(): void {
    if (!this.started || this.finished || this.destroyed) return;
    this.finishRun();
  }

  destroy(): void {
    this.destroyed = true;
    this.cancelFrame();
    this.detachListeners();
    this.clearInput();
  }

  setSkin(skin: SpaceInvadersSkin): void {
    if (!(skin in SKINS)) return;
    this.skin = skin;
    this.draw();
  }

  /** Restarts the wave at `level`, keeping score and lives. Ignored after game over. */
  setLevel(level: number): void {
    if (this.finished || this.destroyed || !Number.isFinite(level)) return;
    this.level = clampLevel(level);
    this.buildWave();
    this.emitChanges();
    this.draw();
  }

  // ── Loop ───────────────────────────────────────────────────────────────────

  private schedule(): void {
    this.cancelFrame();
    this.rafId = requestAnimationFrame(this.loop);
  }

  private cancelFrame(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private loop = (ts: number): void => {
    this.rafId = null;
    if (!this.started || this.paused || this.finished || this.destroyed) return;
    const dt = this.lastTime === null ? 0 : Math.min((ts - this.lastTime) / 1000, MAX_DT);
    this.lastTime = ts;
    this.update(dt);
    this.emitChanges();
    if (this.finished) return;
    this.draw();
    this.schedule();
  };

  private update(dt: number): void {
    this.clock += dt;

    // After a hit everything waits for the cannon to come back.
    if (this.respawnIn > 0) {
      this.respawnIn -= dt;
      if (this.respawnIn <= 0) {
        this.respawnIn = 0;
        this.cannonX = CANNON_START_X;
      }
      return;
    }

    this.moveCannon(dt);
    this.tryFire();
    this.moveProjectiles(dt);
    if (this.finished || this.respawnIn > 0) return;

    this.stepTimer -= dt;
    if (this.stepTimer <= 0) {
      this.marchStep();
      if (this.finished) return;
      this.stepTimer = stepInterval(this.aliveCount(), this.level);
    }

    this.bombTimer -= dt;
    if (this.bombTimer <= 0) {
      this.bombTimer = bombInterval(this.level) * (0.7 + Math.random() * 0.6);
      this.dropBomb();
    }
  }

  // ── Cannon and shots ───────────────────────────────────────────────────────

  private axis(): number {
    const l = LEFT_KEYS.some((c) => this.held.has(c));
    const r = RIGHT_KEYS.some((c) => this.held.has(c));
    return (r ? 1 : 0) - (l ? 1 : 0); // both together cancel
  }

  private moveCannon(dt: number): void {
    const half = CANNON_W / 2;
    const next = this.cannonX + this.axis() * CANNON_SPEED * dt;
    this.cannonX = Math.max(half, Math.min(W - half, next));
  }

  private tryFire(): void {
    if (this.shot !== null || !this.held.has("Space")) return;
    this.shot = { x: this.cannonX, y: CANNON_Y - SHOT_H };
    this.callbacks.onSound?.("shoot");
  }

  private cannonRect(): Rect {
    return { x: this.cannonX - CANNON_W / 2, y: CANNON_Y, w: CANNON_W, h: CANNON_H };
  }

  // Shot and bombs move in sub-steps of at most MAX_STEP px so nothing tunnels through a target.
  private moveProjectiles(dt: number): void {
    const distance = Math.max(SHOT_SPEED, BOMB_SPEED) * dt;
    const steps = Math.max(1, Math.ceil(distance / MAX_STEP));
    const sdt = dt / steps;
    for (let i = 0; i < steps && !this.finished && this.respawnIn <= 0; i++) {
      if (this.shot) {
        this.shot.y -= SHOT_SPEED * sdt;
        this.checkShot();
      }
      for (const bomb of this.bombs) bomb.y += BOMB_SPEED * sdt;
      this.checkBombs();
    }
  }

  private shotRect(shot: Bullet): Rect {
    return { x: shot.x - SHOT_W / 2, y: shot.y, w: SHOT_W, h: SHOT_H };
  }

  private bombRect(bomb: Bullet): Rect {
    return { x: bomb.x - BOMB_W / 2, y: bomb.y, w: BOMB_W, h: BOMB_H };
  }

  private checkShot(): void {
    const shot = this.shot;
    if (!shot) return;
    if (shot.y + SHOT_H < 0) {
      this.shot = null;
      return;
    }
    const rect = this.shotRect(shot);
    // A shot that meets a bomb removes both, no points.
    const hitBomb = this.bombs.findIndex((b) => rectsOverlap(rect, this.bombRect(b)));
    if (hitBomb >= 0) {
      this.bombs.splice(hitBomb, 1);
      this.shot = null;
      return;
    }
    for (const inv of this.invaders) {
      if (inv.alive && rectsOverlap(rect, invaderRect(inv, this.fleetX, this.fleetY))) {
        this.killInvader(inv);
        return;
      }
    }
  }

  private checkBombs(): void {
    const cannon = this.cannonRect();
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const bomb = this.bombs[i];
      if (bomb.y > GROUND_Y) {
        this.bombs.splice(i, 1);
        continue;
      }
      if (rectsOverlap(this.bombRect(bomb), cannon)) {
        this.hitCannon();
        return;
      }
    }
  }

  private killInvader(inv: Invader): void {
    inv.alive = false;
    this.shot = null;
    this.score = clampScore(this.score + ROW_POINTS[inv.row]);
    this.callbacks.onSound?.("hit");
    if (this.aliveCount() === 0) this.clearWave();
  }

  private hitCannon(): void {
    this.lives = Math.max(0, this.lives - 1);
    this.bombs = [];
    this.shot = null;
    this.callbacks.onSound?.("boom");
    this.callbacks.onHaptic?.("death");
    this.emitChanges();
    if (this.lives <= 0) {
      this.finishRun();
      return;
    }
    this.respawnIn = RESPAWN_DELAY;
    this.cannonX = CANNON_START_X; // the new cannon blinks at center until it is live
  }

  // ── Fleet ──────────────────────────────────────────────────────────────────

  private aliveCount(): number {
    let n = 0;
    for (const inv of this.invaders) if (inv.alive) n++;
    return n;
  }

  private marchStep(): void {
    let minCol = COLS;
    let maxCol = -1;
    let maxRow = -1;
    for (const inv of this.invaders) {
      if (!inv.alive) continue;
      if (inv.col < minCol) minCol = inv.col;
      if (inv.col > maxCol) maxCol = inv.col;
      if (inv.row > maxRow) maxRow = inv.row;
    }
    if (maxCol < 0) return;
    const left = this.fleetX + minCol * PITCH_X;
    const right = this.fleetX + maxCol * PITCH_X + INVADER_W;
    const blocked =
      this.dir > 0 ? right + STEP_X > W - FLEET_MARGIN : left - STEP_X < FLEET_MARGIN;
    if (blocked) {
      this.fleetY += STEP_DOWN;
      this.dir = this.dir > 0 ? -1 : 1;
    } else {
      this.fleetX += this.dir * STEP_X;
    }
    this.frame = this.frame === 0 ? 1 : 0;
    // Landing: an invader reaching the cannon row ends the run at once, lives untouched.
    if (this.fleetY + maxRow * PITCH_Y + INVADER_H >= CANNON_Y) this.finishRun();
  }

  private dropBomb(): void {
    if (this.bombs.length >= MAX_BOMBS) return;
    const cols: number[] = [];
    for (let c = 0; c < COLS; c++) {
      if (lowestAliveInColumn(this.invaders, c)) cols.push(c);
    }
    if (cols.length === 0) return;
    const col = cols[Math.floor(Math.random() * cols.length)];
    const inv = lowestAliveInColumn(this.invaders, col);
    if (!inv) return;
    const rect = invaderRect(inv, this.fleetX, this.fleetY);
    this.bombs.push({ x: rect.x + rect.w / 2, y: rect.y + rect.h });
  }

  // Rebuilds the grid for the current level. Score and lives are untouched.
  private buildWave(): void {
    this.invaders = createInvaders();
    this.fleetX = FLEET_START_X;
    this.fleetY = fleetStartY(this.level);
    this.dir = 1;
    this.frame = 0;
    this.stepTimer = stepInterval(this.aliveCount(), this.level);
    this.bombTimer = 1;
    this.shot = null;
    this.bombs = [];
  }

  private clearWave(): void {
    this.score = clampScore(this.score + WAVE_BONUS * this.level);
    this.level = clampLevel(this.level + 1);
    this.buildWave();
    this.callbacks.onHaptic?.("clear");
  }

  // ── Run end and callbacks ──────────────────────────────────────────────────

  // Stops the engine for good (until destroy) and reports the final score once.
  private finishRun(): void {
    if (this.finished) return;
    this.finished = true;
    this.cancelFrame();
    this.detachListeners();
    this.clearInput();
    this.emitChanges();
    this.draw();
    this.callbacks.onSound?.("gameover");
    this.callbacks.onGameOver(clampScore(this.score));
  }

  private emitChanges(): void {
    if (this.emittedScore !== this.score) {
      this.emittedScore = this.score;
      this.callbacks.onScore(this.score);
    }
    if (this.emittedLives !== this.lives) {
      this.emittedLives = this.lives;
      this.callbacks.onLives(this.lives);
    }
    if (this.emittedLevel !== this.level) {
      this.emittedLevel = this.level;
      this.callbacks.onLevel(this.level);
    }
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  private attachListeners(): void {
    if (this.listening) return;
    this.listening = true;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.clearInput);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  private detachListeners(): void {
    if (!this.listening) return;
    this.listening = false;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.clearInput);
    document.removeEventListener("visibilitychange", this.onVisibility);
  }

  // Only the game keys get preventDefault, and only while the engine runs and is not paused.
  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.paused || this.finished || !this.started) return;
    if (!GAME_KEYS.has(e.code)) return;
    e.preventDefault();
    this.held.add(e.code); // Space is read as a held key, so e.repeat does not matter
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (!GAME_KEYS.has(e.code)) return;
    this.held.delete(e.code);
  };

  private clearInput = (): void => {
    this.held.clear();
  };

  private onVisibility = (): void => {
    if (document.hidden) this.clearInput();
  };

  // ── Game state ─────────────────────────────────────────────────────────────

  private initGame(): void {
    this.score = 0;
    this.lives = START_LIVES;
    this.level = 1;
    this.cannonX = CANNON_START_X;
    this.respawnIn = 0;
    this.clock = 0;
    this.lastTime = null;
    this.held.clear();
    this.buildWave();
  }

  // ── Drawing ────────────────────────────────────────────────────────────────

  private rowColor(palette: InvadersPalette, row: number): string {
    if (row === 0) return palette.rowTop;
    return row <= 2 ? palette.rowMid : palette.rowBot;
  }

  private draw(): void {
    if (this.destroyed) return;
    const ctx = this.ctx;
    const palette = SKINS[this.skin];
    drawField(ctx, palette);
    for (const inv of this.invaders) {
      if (!inv.alive) continue;
      const r = invaderRect(inv, this.fleetX, this.fleetY);
      drawInvader(ctx, r.x, r.y, this.rowColor(palette, inv.row), this.frame);
    }
    for (const bomb of this.bombs) drawBomb(ctx, bomb, palette.bomb);
    if (this.shot) drawShot(ctx, this.shot, palette.shot, palette.glow);
    // The cannon is gone after the last life, and blinks while it waits to respawn.
    const blinkOn = this.respawnIn <= 0 || Math.floor(this.clock * 8) % 2 === 0;
    if (this.lives > 0 && blinkOn) {
      drawCannon(ctx, this.cannonX, CANNON_Y, palette.cannon, palette.glow);
    }
  }
}
