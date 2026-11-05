import {
  BALL,
  BAR,
  BRICK,
  EXPLOSION_DURATION,
  H,
  LEVEL_MAX,
  LEVEL_MIN,
  MAX_BOUNCE_ANGLE,
  MAX_DT,
  MAX_STEP,
  PADDLE,
  POINTS_PER_BRICK,
  POWERUP,
  SHEET_SRC,
  SKINS,
  START_LIVES,
  W,
  type PowerUpType,
  type SkinId,
} from "./constants";
import {
  createBricks,
  drawBalls,
  drawBar,
  drawBricks,
  drawCapsules,
  drawExplosions,
  drawPaddle,
  drawTimers,
  SpriteSheet,
  type Ball,
  type Brick,
  type Capsule,
  type Explosion,
} from "./entities";
import { baseBallSpeed, clampScore } from "./utils";

export type ArkanoidSkin = SkinId;
export type ArkanoidSound = "bounce" | "brick";

export interface ArkanoidCallbacks {
  onScore: (score: number) => void; // called when the score changes
  onLives: (lives: number) => void; // called when the lives change
  onLevel: (level: number) => void; // called when the level changes
  onSound: (sound: ArkanoidSound) => void; // each bounce / brick break, only while playing
  onGameOver: (finalScore: number) => void; // called once per run
}

export interface ArkanoidOptions {
  skin?: ArkanoidSkin; // default "retro"
}

type Mode = "ready" | "playing" | "over";

// Only these codes get preventDefault, and only while the engine runs and is not paused.
const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "KeyA", "KeyD", "Space"]);

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export class ArkanoidEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly callbacks: ArkanoidCallbacks;
  private readonly sheet = new SpriteSheet();
  private skin: ArkanoidSkin;

  // Lifecycle
  private started = false;
  private paused = false;
  private finished = false; // onGameOver already fired for this run
  private destroyed = false;
  private listening = false;
  private sheetDone = false; // spritesheet loaded or failed: the loop may run
  private rafId: number | null = null;
  private lastTime: number | null = null;

  // Input
  private left = false;
  private right = false;
  private mouseX: number | null = null; // canvas-space X of the cursor; null until the mouse moves

  // Game state (instance-owned, nothing shared between engines)
  private mode: Mode = "ready";
  private score = 0;
  private lives = START_LIVES;
  private level = 1;
  private paddleX = (W - PADDLE.w) / 2;
  private balls: Ball[] = [];
  private bricks: Brick[] = [];
  private capsules: Capsule[] = [];
  private explosions: Explosion[] = [];
  private effects = { bar: 0, frenzy: 0 }; // remaining seconds, 0 = inactive
  private clock = 0; // ms, advanced only in update

  // Last values sent to the callbacks, so they only fire on change.
  private emitted = { score: NaN, lives: NaN, level: NaN };

  constructor(canvas: HTMLCanvasElement, callbacks: ArkanoidCallbacks, options: ArkanoidOptions = {}) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("ArkanoidEngine: 2D canvas context is not available");
    this.canvas = canvas;
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.skin = options.skin ?? "retro";
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  setSkin(skin: ArkanoidSkin): void {
    if (!(skin in SKINS)) return;
    this.skin = skin;
    if (this.destroyed) return;
    this.sheet.applySkin(SKINS[skin].filter);
    this.draw();
  }

  // Level select: restarts the wall at that level, keeping score and lives.
  setLevel(level: number): void {
    if (!this.started || this.finished || this.destroyed) return;
    const next = clamp(Math.trunc(level), LEVEL_MIN, LEVEL_MAX);
    if (!Number.isFinite(next) || next === this.level) return;
    this.level = next;
    this.resetEffects();
    this.bricks = createBricks(this.level);
    this.explosions = [];
    this.mode = "ready";
    this.stickBallToPaddle();
    this.emitChanges();
    this.draw();
  }

  start(): void {
    if (this.started || this.destroyed) return;
    this.started = true;
    this.paused = false;
    this.finished = false;
    this.initGame();
    this.emitChanges();
    this.attachListeners();
    this.sheet.applySkin(SKINS[this.skin].filter);
    this.draw();
    this.sheet.load(SHEET_SRC, () => {
      if (this.destroyed) return;
      this.sheetDone = true;
      this.draw();
      if (!this.paused && !this.finished) this.schedule();
    });
  }

  pause(): void {
    if (!this.started || this.paused || this.finished || this.destroyed) return;
    this.paused = true;
    this.cancelFrame();
    this.clearKeys();
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
    this.emitChanges();
    this.finishRun();
  }

  destroy(): void {
    this.destroyed = true;
    this.cancelFrame();
    this.detachListeners();
    this.clearKeys();
    this.sheet.destroy();
  }

  // ── Loop ───────────────────────────────────────────────────────────────────

  private schedule(): void {
    if (!this.sheetDone) return;
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
    this.clock += dt * 1000;
    this.explosions = this.explosions.filter((ex) => this.clock - ex.start < EXPLOSION_DURATION);

    if (this.mouseX !== null) {
      this.paddleX = this.mouseX - PADDLE.w / 2;
      this.mouseX = null; // keyboard takes over until the mouse moves again
    }
    if (this.left) this.paddleX -= PADDLE.speed * dt;
    if (this.right) this.paddleX += PADDLE.speed * dt;
    this.paddleX = clamp(this.paddleX, 0, W - PADDLE.w);

    if (this.mode === "ready") {
      this.stickBallToPaddle();
    } else if (this.mode === "playing") {
      this.updateBalls(dt);
      if (this.mode !== "playing") return; // wall cleared or run over
      this.updateCapsules(dt);
      this.effects.bar = Math.max(0, this.effects.bar - dt);
      if (this.effects.frenzy > 0) {
        this.effects.frenzy = Math.max(0, this.effects.frenzy - dt);
        if (this.effects.frenzy === 0) this.rescaleBalls(); // back to normal speed
      }
    }
  }

  // Stops the engine for good (until destroy) and reports the final score once.
  private finishRun(): void {
    if (this.finished) return;
    this.finished = true;
    this.mode = "over";
    this.balls = [];
    this.cancelFrame();
    this.detachListeners();
    this.clearKeys();
    this.draw();
    this.callbacks.onGameOver(clampScore(this.score));
  }

  private emitChanges(): void {
    const score = clampScore(this.score);
    if (this.emitted.score !== score) {
      this.emitted.score = score;
      this.callbacks.onScore(score);
    }
    if (this.emitted.lives !== this.lives) {
      this.emitted.lives = this.lives;
      this.callbacks.onLives(this.lives);
    }
    if (this.emitted.level !== this.level) {
      this.emitted.level = this.level;
      this.callbacks.onLevel(this.level);
    }
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  private attachListeners(): void {
    if (this.listening) return;
    this.listening = true;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.clearKeys);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.canvas.addEventListener("mousemove", this.onMouseMove);
    this.canvas.addEventListener("mousedown", this.onMouseDown);
  }

  private detachListeners(): void {
    if (!this.listening) return;
    this.listening = false;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.clearKeys);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.canvas.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.paused || this.finished || !this.started) return;
    if (!GAME_KEYS.has(e.code)) return;
    e.preventDefault();
    switch (e.code) {
      case "ArrowLeft":
      case "KeyA":
        this.left = true;
        break;
      case "ArrowRight":
      case "KeyD":
        this.right = true;
        break;
      case "Space":
        if (!e.repeat) this.launchBall();
        break;
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    switch (e.code) {
      case "ArrowLeft":
      case "KeyA":
        this.left = false;
        break;
      case "ArrowRight":
      case "KeyD":
        this.right = false;
        break;
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.paused || this.finished) return;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    this.mouseX = (e.clientX - rect.left) * (W / rect.width);
  };

  private onMouseDown = (): void => {
    if (this.paused || this.finished) return;
    this.launchBall();
  };

  private clearKeys = (): void => {
    this.left = false;
    this.right = false;
  };

  private onVisibility = (): void => {
    if (document.hidden) this.clearKeys();
  };

  // ── Game state ─────────────────────────────────────────────────────────────

  private initGame(): void {
    this.mode = "ready";
    this.score = 0;
    this.lives = START_LIVES;
    this.level = 1;
    this.paddleX = (W - PADDLE.w) / 2;
    this.capsules = [];
    this.explosions = [];
    this.effects = { bar: 0, frenzy: 0 };
    this.clock = 0;
    this.bricks = createBricks(this.level);
    this.stickBallToPaddle();
    this.clearKeys();
    this.mouseX = null;
    this.lastTime = null;
    this.emitted = { score: NaN, lives: NaN, level: NaN };
  }

  // Single source of ball speed (px/s); Frenzy multiplies the base and is not capped.
  private currentBallSpeed(): number {
    return baseBallSpeed(this.level) * (this.effects.frenzy > 0 ? POWERUP.frenzyFactor : 1);
  }

  // A fresh serve starts with normal rules: no bar, no Frenzy, no capsules.
  private resetEffects(): void {
    this.effects.bar = 0;
    this.effects.frenzy = 0;
    this.capsules = [];
  }

  // Replaces all balls with a single stationary ball resting on the paddle.
  private stickBallToPaddle(): void {
    this.balls = [
      {
        x: this.paddleX + (PADDLE.w - BALL.size) / 2,
        y: PADDLE.y - BALL.size,
        vx: 0,
        vy: 0,
      },
    ];
  }

  private launchBall(): void {
    if (this.mode !== "ready") return;
    // Mostly upward with a small random horizontal component, normalized to the current speed.
    const vx = (Math.random() * 2 - 1) * 0.3;
    const vy = -1;
    const len = Math.hypot(vx, vy);
    const ball = this.balls[0];
    ball.vx = (vx / len) * this.currentBallSpeed();
    ball.vy = (vy / len) * this.currentBallSpeed();
    this.mode = "playing";
  }

  private normalizeBallSpeed(b: Ball): void {
    const len = Math.hypot(b.vx, b.vy);
    if (len === 0) return;
    b.vx = (b.vx / len) * this.currentBallSpeed();
    b.vy = (b.vy / len) * this.currentBallSpeed();
  }

  // Rescales every moving ball to currentBallSpeed(), keeping its direction.
  private rescaleBalls(): void {
    for (const b of this.balls) {
      if (b.vx !== 0 || b.vy !== 0) this.normalizeBallSpeed(b);
    }
  }

  private addScore(points: number): void {
    this.score = clampScore(this.score + points);
  }

  private loseLife(): void {
    this.lives--;
    this.resetEffects();
    if (this.lives <= 0) {
      this.emitChanges();
      this.finishRun();
    } else {
      this.mode = "ready";
      this.stickBallToPaddle();
    }
  }

  // Drops a capsule of a random type, centered on the destroyed brick.
  private spawnCapsule(br: Brick): void {
    const { w, h } = POWERUP.capsule;
    const type = POWERUP.types[Math.floor(Math.random() * POWERUP.types.length)];
    this.capsules.push({ x: br.x + (BRICK.w - w) / 2, y: br.y + (BRICK.h - h) / 2, type });
  }

  // Splits the first ball into 3: two copies rotated by +/- tripleAngle, up to maxBalls in total.
  private tripleBall(): void {
    const src = this.balls[0];
    if (!src) return;
    for (const sign of [1, -1]) {
      if (this.balls.length >= POWERUP.maxBalls) break;
      const a = sign * POWERUP.tripleAngle;
      this.balls.push({
        x: src.x,
        y: src.y,
        vx: src.vx * Math.cos(a) - src.vy * Math.sin(a),
        vy: src.vx * Math.sin(a) + src.vy * Math.cos(a),
      });
    }
  }

  // Catching an active effect again refreshes its timer.
  private applyCapsule(type: PowerUpType): void {
    if (type === "triple") {
      this.tripleBall();
    } else if (type === "bar") {
      this.effects.bar = POWERUP.barDuration;
    } else {
      this.effects.frenzy = POWERUP.frenzyDuration;
      this.rescaleBalls();
    }
  }

  // Capsules fall; they are removed offscreen or when the paddle catches them.
  private updateCapsules(dt: number): void {
    const { w, h, fallSpeed } = POWERUP.capsule;
    const px = this.paddleX;
    this.capsules = this.capsules.filter((c) => {
      c.y += fallSpeed * dt;
      if (c.y > H) return false;
      if (c.x + w > px && c.x < px + PADDLE.w && c.y + h > PADDLE.y && c.y < PADDLE.y + PADDLE.h) {
        this.applyCapsule(c.type);
        return false;
      }
      return true;
    });
  }

  // Destroys the first brick the ball overlaps and reflects the ball on the axis of least penetration.
  private collideBricks(b: Ball): void {
    for (const br of this.bricks) {
      if (!br.alive) continue;
      if (
        b.x + BALL.size <= br.x ||
        b.x >= br.x + BRICK.w ||
        b.y + BALL.size <= br.y ||
        b.y >= br.y + BRICK.h
      ) {
        continue;
      }

      br.alive = false;
      this.addScore(POINTS_PER_BRICK);
      this.callbacks.onSound("brick");
      this.explosions.push({ x: br.x, y: br.y, color: br.color, start: this.clock });
      if (Math.random() < POWERUP.dropChance) this.spawnCapsule(br);

      const overlapX = Math.min(b.x + BALL.size - br.x, br.x + BRICK.w - b.x);
      const overlapY = Math.min(b.y + BALL.size - br.y, br.y + BRICK.h - b.y);
      const fromLeft = b.x + BALL.size / 2 < br.x + BRICK.w / 2;
      const fromTop = b.y + BALL.size / 2 < br.y + BRICK.h / 2;

      if (overlapX < overlapY) {
        b.vx = fromLeft ? -Math.abs(b.vx) : Math.abs(b.vx);
        b.x += fromLeft ? -overlapX : overlapX;
      } else {
        b.vy = fromTop ? -Math.abs(b.vy) : Math.abs(b.vy);
        b.y += fromTop ? -overlapY : overlapY;
      }
      return; // one brick per sub-step
    }
  }

  // Moves one ball by dt and resolves walls, paddle, bar and brick collisions.
  private stepBall(b: Ball, dt: number): void {
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Left and right walls
    if (b.x < 0) {
      b.x = 0;
      b.vx = Math.abs(b.vx);
      this.callbacks.onSound("bounce");
    } else if (b.x + BALL.size > W) {
      b.x = W - BALL.size;
      b.vx = -Math.abs(b.vx);
      this.callbacks.onSound("bounce");
    }

    // Ceiling
    if (b.y < 0) {
      b.y = 0;
      b.vy = Math.abs(b.vy);
      this.callbacks.onSound("bounce");
    }

    // Paddle: only when moving down, so a ball already bouncing up is not caught again.
    const px = this.paddleX;
    if (
      b.vy > 0 &&
      b.x + BALL.size > px &&
      b.x < px + PADDLE.w &&
      b.y + BALL.size > PADDLE.y &&
      b.y < PADDLE.y + PADDLE.h
    ) {
      // -1 at the left edge, 0 at the center, 1 at the right edge
      const hit = clamp((b.x + BALL.size / 2 - (px + PADDLE.w / 2)) / (PADDLE.w / 2), -1, 1);
      const angle = hit * MAX_BOUNCE_ANGLE;
      b.vx = Math.sin(angle) * this.currentBallSpeed();
      b.vy = -Math.cos(angle) * this.currentBallSpeed();
      b.y = PADDLE.y - BALL.size;
      this.callbacks.onSound("bounce");
    }

    // Complete bar: only when moving down, same as the paddle.
    if (this.effects.bar > 0 && b.vy > 0 && b.y + BALL.size > BAR.y && b.y < BAR.y + BAR.h) {
      b.y = BAR.y - BALL.size;
      b.vy = -Math.abs(b.vy);
      this.callbacks.onSound("bounce");
    }

    this.collideBricks(b);
  }

  // Moves every ball in sub-steps of at most MAX_STEP px so fast balls cannot tunnel.
  private updateBalls(dt: number): void {
    for (const b of this.balls) {
      const steps = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vy) * dt) / MAX_STEP));
      for (let i = 0; i < steps; i++) {
        this.stepBall(b, dt / steps);

        // Wall cleared: next level, ball back on the paddle, score and lives carry over.
        if (!this.bricks.some((br) => br.alive)) {
          this.level++;
          this.resetEffects();
          this.bricks = createBricks(this.level);
          this.mode = "ready";
          this.stickBallToPaddle();
          return;
        }

        this.normalizeBallSpeed(b);
        if (b.y > H) break; // lost below the canvas
      }
    }

    // A life is lost only when the last ball is gone.
    this.balls = this.balls.filter((b) => b.y <= H);
    if (this.balls.length === 0) this.loseLife();
  }

  // ── Draw ───────────────────────────────────────────────────────────────────

  private draw(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);
    drawBricks(ctx, this.sheet, this.bricks);
    drawBar(ctx, this.effects.bar > 0);
    drawPaddle(ctx, this.sheet, this.paddleX);
    drawExplosions(ctx, this.sheet, this.explosions, this.clock);
    drawCapsules(ctx, this.capsules);
    drawTimers(ctx, this.effects);
    if (this.mode !== "over") drawBalls(ctx, this.sheet, this.balls);
  }
}
