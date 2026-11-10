import {
  BALL_SIZE,
  BALL_START_SPEED,
  CPU,
  GOAL_POINTS_PER_HIT,
  H,
  HIT_POINTS,
  MAX_DT,
  MAX_STEP,
  MULTIPLIER_GOALS_PER_STEP,
  MULTIPLIER_MAX_BONUS,
  PADDLE_H,
  PADDLE_MARGIN,
  PADDLE_SPEED,
  PADDLE_W,
  SERVE_ANGLE,
  SERVE_DELAY,
  SKINS,
  START_LIVES,
  W,
  type PongDifficulty,
  type PongSkin,
} from "./constants";
import {
  drawBall,
  drawField,
  drawPaddle,
  drawScoreboard,
  type Ball,
  type Player,
} from "./entities";
import { ballSpeed, clampScore, cpuTarget, reflectAngle } from "./utils";

export type { PongDifficulty, PongSkin } from "./constants";
export type PongMode = "pve" | "pvp";

export interface PongCallbacks {
  onScore: (record: number) => void; // record score: PvE = human, PvP = max(p1, p2); fires on change
  onGameOver: (finalScore: number) => void; // once per run, same value as the record
  onSound?: (name: "paddle" | "goal" | "gameover") => void; // only from update / game over
  onHaptic?: (name: "death") => void; // a life was lost
}

export interface PongOptions {
  mode: PongMode;
  difficulty?: PongDifficulty; // PvE only, default "normal"
  skin?: PongSkin; // default "retro"
}

const HALF = BALL_SIZE / 2;
const LEFT_FACE = PADDLE_MARGIN + PADDLE_W; // x of the front face of the left paddle
const RIGHT_FACE = W - PADDLE_MARGIN - PADDLE_W; // x of the front face of the right paddle
const RIGHT_X = RIGHT_FACE; // left edge of the right paddle
const PADDLE_START_Y = (H - PADDLE_H) / 2;

const UP_KEYS = { p1: ["KeyW"], p2: ["ArrowUp"], human: ["KeyW", "ArrowUp"] };
const DOWN_KEYS = { p1: ["KeyS"], p2: ["ArrowDown"], human: ["KeyS", "ArrowDown"] };
const GAME_KEYS = new Set(["KeyW", "KeyS", "ArrowUp", "ArrowDown"]);

export class PongEngine {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly callbacks: PongCallbacks;
  private readonly mode: PongMode;
  private difficulty: PongDifficulty;
  private skin: PongSkin;

  // Lifecycle
  private started = false;
  private paused = false;
  private finished = false; // onGameOver already fired for this run
  private destroyed = false;
  private listening = false;
  private rafId: number | null = null;
  private lastTime: number | null = null;

  // Game state (instance-owned, nothing shared between engines)
  private p1: Player = { y: PADDLE_START_Y, lives: START_LIVES, score: 0 };
  private p2: Player = { y: PADDLE_START_Y, lives: START_LIVES, score: 0 };
  private ball: Ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
  private hits = 0; // paddle hits in the current rally
  private humanGoals = 0; // goals scored by the human this match (PvE multiplier steps)
  private serveIn = SERVE_DELAY; // seconds left before the ball launches, 0 = in play
  private serveDir: 1 | -1 = 1; // 1 = toward the right paddle
  private clock = 0; // seconds, advanced only in update (drives the serve blink)
  private held = new Set<string>();

  // CPU state (PvE)
  private cpuWait = 0; // reaction delay left
  private cpuAim = 0; // aim error in -1..1, rolled once per rally
  private cpuTargetY: number | null = null; // where the CPU paddle center is heading, null = not decided

  // Last record sent to onScore, so it only fires on change.
  private emittedScore = NaN;

  constructor(canvas: HTMLCanvasElement, callbacks: PongCallbacks, options: PongOptions) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("PongEngine: 2D canvas context is not available");
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.mode = options.mode;
    this.difficulty = options.difficulty && options.difficulty in CPU ? options.difficulty : "normal";
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
    this.emitChanges();
    this.finishRun();
  }

  destroy(): void {
    this.destroyed = true;
    this.cancelFrame();
    this.detachListeners();
    this.clearInput();
  }

  setSkin(skin: PongSkin): void {
    if (!(skin in SKINS)) return;
    this.skin = skin;
    this.draw();
  }

  setDifficulty(difficulty: PongDifficulty): void {
    if (this.mode !== "pve" || !(difficulty in CPU) || difficulty === this.difficulty) return;
    this.difficulty = difficulty;
    if (this.finished || this.destroyed) return;
    // A new difficulty is a new match: lives, paddles, ball and score start over.
    this.initGame();
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
    this.movePaddles(dt);
    if (this.serveIn > 0) {
      this.serveIn -= dt;
      if (this.serveIn <= 0) {
        this.serveIn = 0;
        this.launch();
      }
      return;
    }
    this.moveBall(dt);
  }

  private moveBall(dt: number): void {
    const b = this.ball;
    const distance = Math.hypot(b.vx, b.vy) * dt;
    const steps = Math.max(1, Math.ceil(distance / MAX_STEP));
    const sdt = dt / steps;
    for (let i = 0; i < steps && !this.finished; i++) {
      const prevX = b.x;
      b.x += b.vx * sdt;
      b.y += b.vy * sdt;

      // Top and bottom walls reflect vy.
      if (b.y < HALF) {
        b.y = 2 * HALF - b.y;
        b.vy = Math.abs(b.vy);
      } else if (b.y > H - HALF) {
        b.y = 2 * (H - HALF) - b.y;
        b.vy = -Math.abs(b.vy);
      }

      // Paddle hits: the ball's leading edge crosses a paddle face while overlapping it vertically.
      if (b.vx < 0 && prevX - HALF >= LEFT_FACE && b.x - HALF < LEFT_FACE) {
        if (this.overlaps(this.p1)) {
          this.paddleHit(this.p1, 1, LEFT_FACE + HALF);
          continue;
        }
      } else if (b.vx > 0 && prevX + HALF <= RIGHT_FACE && b.x + HALF > RIGHT_FACE) {
        if (this.overlaps(this.p2)) {
          this.paddleHit(this.p2, -1, RIGHT_FACE - HALF);
          continue;
        }
      }

      // Goal: the ball center passes a side edge.
      if (b.x < 0) {
        this.goal(false);
        return;
      }
      if (b.x > W) {
        this.goal(true);
        return;
      }
    }
  }

  private overlaps(p: Player): boolean {
    return this.ball.y + HALF >= p.y && this.ball.y - HALF <= p.y + PADDLE_H;
  }

  // Adds points to a player. In PvE the human's points use the difficulty multiplier (rounded to a whole number); the CPU's do not.
  private award(p: Player, points: number): void {
    const factor = this.mode === "pve" && p === this.p1 ? this.humanMultiplier() : 1;
    p.score = clampScore(p.score + Math.round(points * factor));
  }

  // PvE human multiplier: the difficulty base plus 1 per 3 goals the human has scored this match (max +10).
  private humanMultiplier(): number {
    const bonus = Math.min(MULTIPLIER_MAX_BONUS, Math.floor(this.humanGoals / MULTIPLIER_GOALS_PER_STEP));
    return CPU[this.difficulty].points + bonus;
  }

  private paddleHit(p: Player, dir: 1 | -1, x: number): void {
    const b = this.ball;
    this.hits++;
    // A human who returns the ball earns points at once; the CPU earns nothing for hits.
    if (this.mode === "pvp" || p === this.p1) this.award(p, HIT_POINTS);
    const offset = (b.y - (p.y + PADDLE_H / 2)) / (PADDLE_H / 2 + HALF);
    const angle = reflectAngle(offset);
    const speed = ballSpeed(this.hits);
    b.x = x;
    b.vx = dir * speed * Math.cos(angle);
    b.vy = speed * Math.sin(angle);
    this.callbacks.onSound?.("paddle");
    if (dir === 1 && this.mode === "pve") this.resetCpu(); // ball now heads to the CPU
  }

  // `p1Scores`: the ball passed the right edge, so Player 1 scores and Player 2 concedes.
  private goal(p1Scores: boolean): void {
    const scorer = p1Scores ? this.p1 : this.p2;
    const conceder = p1Scores ? this.p2 : this.p1;
    this.award(scorer, GOAL_POINTS_PER_HIT * Math.max(1, this.hits));
    // The goal itself pays at the current multiplier; the next step up applies from the following points.
    if (p1Scores && this.mode === "pve") this.humanGoals++;
    // The CPU has no lives: only a human can lose one.
    const concederHasLives = this.mode === "pvp" || !p1Scores;
    if (concederHasLives) {
      conceder.lives = Math.max(0, conceder.lives - 1);
      this.callbacks.onHaptic?.("death");
    }
    this.hits = 0;
    this.callbacks.onSound?.("goal");
    this.emitChanges();
    if (this.p1.lives <= 0 || (this.mode === "pvp" && this.p2.lives <= 0)) {
      this.finishRun();
      return;
    }
    this.startServe(p1Scores ? 1 : -1);
  }

  private startServe(dir: 1 | -1): void {
    this.ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
    this.serveDir = dir;
    this.serveIn = SERVE_DELAY;
    this.cpuAim = Math.random() * 2 - 1; // one aim roll per rally
    this.cpuTargetY = null;
    this.cpuWait = 0;
  }

  private launch(): void {
    const angle = ((Math.random() * 2 - 1) * SERVE_ANGLE * Math.PI) / 180;
    this.ball.vx = this.serveDir * BALL_START_SPEED * Math.cos(angle);
    this.ball.vy = BALL_START_SPEED * Math.sin(angle);
    if (this.serveDir === 1 && this.mode === "pve") this.resetCpu();
  }

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
    this.callbacks.onGameOver(this.record());
  }

  private record(): number {
    const score = this.mode === "pve" ? this.p1.score : Math.max(this.p1.score, this.p2.score);
    return clampScore(score);
  }

  private emitChanges(): void {
    const score = this.record();
    if (this.emittedScore !== score) {
      this.emittedScore = score;
      this.callbacks.onScore(score);
    }
  }

  // ── Paddles and CPU ────────────────────────────────────────────────────────

  private axis(up: string[], down: string[]): number {
    const u = up.some((c) => this.held.has(c));
    const d = down.some((c) => this.held.has(c));
    return (d ? 1 : 0) - (u ? 1 : 0); // both together cancel
  }

  private movePaddles(dt: number): void {
    const clampY = (y: number) => Math.max(0, Math.min(H - PADDLE_H, y));
    if (this.mode === "pvp") {
      this.p1.y = clampY(this.p1.y + this.axis(UP_KEYS.p1, DOWN_KEYS.p1) * PADDLE_SPEED * dt);
      this.p2.y = clampY(this.p2.y + this.axis(UP_KEYS.p2, DOWN_KEYS.p2) * PADDLE_SPEED * dt);
    } else {
      this.p1.y = clampY(this.p1.y + this.axis(UP_KEYS.human, DOWN_KEYS.human) * PADDLE_SPEED * dt);
      this.moveCpu(dt, clampY);
    }
  }

  private resetCpu(): void {
    this.cpuWait = CPU[this.difficulty].reaction;
    this.cpuTargetY = null;
  }

  private moveCpu(dt: number, clampY: (y: number) => number): void {
    const cfg = CPU[this.difficulty];
    const toward = this.serveIn <= 0 && this.ball.vx > 0;
    let target = H / 2; // ball moving away (or waiting to serve): drift to the center
    if (toward) {
      if (this.cpuTargetY === null) {
        this.cpuWait -= dt;
        if (this.cpuWait <= 0) this.cpuTargetY = cpuTarget(this.ball, this.difficulty, this.cpuAim);
      }
      if (this.cpuTargetY === null) return; // still reacting: hold position
      target = this.cpuTargetY;
    } else {
      this.cpuTargetY = null;
    }
    const center = this.p2.y + PADDLE_H / 2;
    const diff = target - center;
    const step = cfg.speed * dt;
    const next = Math.abs(diff) <= step ? target : center + Math.sign(diff) * step;
    this.p2.y = clampY(next - PADDLE_H / 2);
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
    if (e.repeat) return;
    this.held.add(e.code);
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
    this.p1 = { y: PADDLE_START_Y, lives: START_LIVES, score: 0 };
    this.p2 = {
      y: PADDLE_START_Y,
      lives: this.mode === "pvp" ? START_LIVES : 0,
      score: 0,
    };
    this.hits = 0;
    this.humanGoals = 0;
    this.clock = 0;
    this.lastTime = null;
    this.held.clear();
    this.startServe(1); // the first serve goes toward Player 2 / the CPU
  }

  // ── Drawing ────────────────────────────────────────────────────────────────

  private draw(): void {
    if (this.destroyed) return;
    const ctx = this.ctx;
    const palette = SKINS[this.skin];
    const pvp = this.mode === "pvp";
    drawField(ctx, palette);
    drawScoreboard(
      ctx,
      palette,
      {
        score: this.p1.score,
        lives: this.p1.lives,
        // PvE: show the live score multiplier next to the tag.
        tag: pvp ? "P1" : `P1  X${Number(this.humanMultiplier().toFixed(2))}`,
      },
      { score: this.p2.score, lives: pvp ? this.p2.lives : null, tag: pvp ? "P2" : "CPU" },
    );
    drawPaddle(ctx, PADDLE_MARGIN, this.p1.y, palette.left, palette.glow);
    drawPaddle(ctx, RIGHT_X, this.p2.y, palette.right, palette.glow);
    // The ball blinks while it waits to serve.
    const visible = this.serveIn <= 0 || Math.floor(this.clock * 8) % 2 === 0;
    if (visible) drawBall(ctx, this.ball, palette.ball, palette.glow);
  }
}
