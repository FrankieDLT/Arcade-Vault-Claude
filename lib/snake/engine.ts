import {
  BONUS_CHANCE,
  BONUS_LIFETIME,
  BONUS_POINTS,
  COLS,
  FRUIT_NAMES,
  FRUIT_POINTS,
  H,
  INPUT_QUEUE,
  MAX_DT,
  ROWS,
  SHEET_SRC,
  SKINS,
  START_COL,
  START_LENGTH,
  START_ROW,
  W,
  type FruitName,
  type SnakeSkin,
} from "./constants";
import {
  drawBoard,
  drawBonus,
  drawFruit,
  drawSnake,
  SpriteSheet,
  type Bonus,
  type Cell,
  type Direction,
  type Fruit,
} from "./entities";
import { clampScore, DIRECTION_VECTORS, isOpposite, randomFreeCell, ticksPerSecond } from "./utils";

export type { SnakeSkin } from "./constants";

export interface SnakeCallbacks {
  onScore: (score: number) => void; // called when the score changes
  onLength: (length: number) => void; // called when the snake length changes
  onGameOver: (finalScore: number) => void; // called once per run
  onHaptic?: (name: "fruit" | "bonus") => void; // regular fruit eaten / golden fruit eaten
}

export interface SnakeOptions {
  skin?: SnakeSkin; // default "retro"
}

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
};

export class SnakeEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly callbacks: SnakeCallbacks;
  private readonly sheet = new SpriteSheet();
  private skin: SnakeSkin;

  // Lifecycle
  private started = false;
  private paused = false;
  private finished = false; // onGameOver already fired for this run
  private destroyed = false;
  private listening = false;
  private sheetDone = false; // sprite sheet loaded or failed: the loop may run
  private rafId: number | null = null;
  private lastTime: number | null = null;

  // Game state (instance-owned, nothing shared between engines)
  private snake: Cell[] = []; // head first
  private dir: Direction = "right"; // direction of the last tick
  private queue: Direction[] = []; // turns waiting for a tick
  private fruit: Fruit | null = null;
  private bonus: Bonus | null = null;
  private score = 0;
  private fruitsEaten = 0;
  private clock = 0; // seconds, advanced only in update
  private accumulator = 0; // seconds waiting to become ticks

  // Last values sent to the callbacks, so they only fire on change.
  private emitted = { score: NaN, length: NaN };

  constructor(canvas: HTMLCanvasElement, callbacks: SnakeCallbacks, options: SnakeOptions = {}) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("SnakeEngine: 2D canvas context is not available");
    this.canvas = canvas;
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.skin = options.skin ?? "retro";
    this.initGame();
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  setSkin(skin: SnakeSkin): void {
    if (!(skin in SKINS)) return;
    this.skin = skin;
    if (this.destroyed) return;
    this.sheet.applyFilter(SKINS[skin].fruitFilter);
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
    this.sheet.applyFilter(SKINS[this.skin].fruitFilter);
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
    this.clock += dt;

    if (this.bonus) {
      this.bonus.age += dt;
      if (this.bonus.age >= BONUS_LIFETIME) this.bonus = null;
    }

    // Fixed step: several ticks per frame are allowed.
    this.accumulator += dt;
    let step = 1 / ticksPerSecond(this.fruitsEaten);
    while (this.accumulator >= step && !this.finished) {
      this.accumulator -= step;
      this.tick();
      step = 1 / ticksPerSecond(this.fruitsEaten);
    }
  }

  // One snake move: turn, collide, eat, spawn.
  private tick(): void {
    const turn = this.queue.shift();
    if (turn) this.dir = turn;
    const v = DIRECTION_VECTORS[this.dir];
    const head = this.snake[0];
    const next: Cell = { col: head.col + v.col, row: head.row + v.row };

    if (next.col < 0 || next.col >= COLS || next.row < 0 || next.row >= ROWS) {
      this.finishRun();
      return;
    }

    const eatsFruit = this.fruit !== null && this.fruit.col === next.col && this.fruit.row === next.row;
    const eatsBonus = this.bonus !== null && this.bonus.col === next.col && this.bonus.row === next.row;
    const grows = eatsFruit || eatsBonus;

    // When the snake does not grow, the tail leaves its cell on this same tick: moving there is allowed.
    const solid = grows ? this.snake : this.snake.slice(0, -1);
    if (solid.some((c) => c.col === next.col && c.row === next.row)) {
      this.finishRun();
      return;
    }

    this.snake.unshift(next);
    if (!grows) this.snake.pop();

    if (eatsBonus) {
      this.addScore(BONUS_POINTS);
      this.fruitsEaten++;
      this.bonus = null;
      this.callbacks.onHaptic?.("bonus");
    }
    if (eatsFruit) {
      this.addScore(FRUIT_POINTS);
      this.fruitsEaten++;
      this.callbacks.onHaptic?.("fruit");
      if (!this.spawnFruit()) {
        this.finishRun(); // no free cell left: the board is full
        return;
      }
      if (!this.bonus && Math.random() < BONUS_CHANCE) this.spawnBonus();
    }
    if (this.snake.length >= COLS * ROWS) this.finishRun();
  }

  private addScore(points: number): void {
    this.score = clampScore(this.score + points);
  }

  // Puts the next fruit on a free cell with a sprite different from the last one.
  // If only the bonus cell is left, the bonus is dropped to make room. false = board full.
  private spawnFruit(): boolean {
    let cell = randomFreeCell(this.snake, this.bonus ? [this.bonus] : []);
    if (!cell && this.bonus) {
      this.bonus = null;
      cell = randomFreeCell(this.snake, []);
    }
    if (!cell) {
      this.fruit = null;
      return false;
    }
    this.fruit = { ...cell, sprite: this.pickSprite() };
    return true;
  }

  private spawnBonus(): void {
    const occupied = this.fruit ? [this.fruit] : [];
    const cell = randomFreeCell(this.snake, occupied);
    if (cell) this.bonus = { ...cell, age: 0 };
  }

  private pickSprite(): FruitName {
    const last = this.fruit?.sprite;
    const options = FRUIT_NAMES.filter((n) => n !== last);
    return options[Math.floor(Math.random() * options.length)];
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
    this.callbacks.onGameOver(clampScore(this.score));
  }

  private emitChanges(): void {
    const score = clampScore(this.score);
    if (this.emitted.score !== score) {
      this.emitted.score = score;
      this.callbacks.onScore(score);
    }
    if (this.emitted.length !== this.snake.length) {
      this.emitted.length = this.snake.length;
      this.callbacks.onLength(this.snake.length);
    }
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  private attachListeners(): void {
    if (this.listening) return;
    this.listening = true;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("blur", this.clearInput);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  private detachListeners(): void {
    if (!this.listening) return;
    this.listening = false;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("blur", this.clearInput);
    document.removeEventListener("visibilitychange", this.onVisibility);
  }

  // Only the game keys get preventDefault, and only while the engine runs and is not paused.
  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.paused || this.finished || !this.started) return;
    const dir = KEY_DIRECTIONS[e.code];
    if (!dir) return;
    e.preventDefault();
    if (e.repeat) return;
    // Compared with the last queued turn (or the current heading): no duplicates, no 180° turns.
    const last = this.queue.length > 0 ? this.queue[this.queue.length - 1] : this.dir;
    if (dir === last || isOpposite(dir, last)) return;
    if (this.queue.length >= INPUT_QUEUE) return;
    this.queue.push(dir);
  };

  private clearInput = (): void => {
    this.queue = [];
  };

  private onVisibility = (): void => {
    if (document.hidden) this.clearInput();
  };

  // ── Game state ─────────────────────────────────────────────────────────────

  private initGame(): void {
    this.snake = [];
    for (let i = 0; i < START_LENGTH; i++) this.snake.push({ col: START_COL - i, row: START_ROW });
    this.dir = "right";
    this.queue = [];
    this.fruit = null;
    this.bonus = null;
    this.score = 0;
    this.fruitsEaten = 0;
    this.clock = 0;
    this.accumulator = 0;
    this.lastTime = null;
    this.spawnFruit();
  }

  // ── Drawing ────────────────────────────────────────────────────────────────

  private draw(): void {
    if (this.destroyed) return;
    const ctx = this.ctx;
    const palette = SKINS[this.skin];
    ctx.clearRect(0, 0, W, H);
    drawBoard(ctx, palette);
    if (this.fruit) drawFruit(ctx, this.fruit, this.sheet, palette);
    if (this.bonus) drawBonus(ctx, this.bonus, this.clock, this.sheet, palette);
    drawSnake(ctx, this.snake, this.dir, palette);
  }
}
