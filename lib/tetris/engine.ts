import {
  BLOCK,
  BOARD_H,
  BOARD_W,
  COLS,
  GHOST_ALPHA,
  GRID_LINE_WIDTH,
  H,
  HARD_DROP_POINTS,
  HOLD_BOX,
  HOLD_LABEL_Y,
  KICKS,
  LABEL_FONT,
  LABEL_LETTER_SPACING,
  LINES_PER_LEVEL,
  LINE_SCORES,
  NEXT_BOX,
  NEXT_LABEL_Y,
  PIECE_TYPES,
  ROWS,
  SIDE_X,
  SLOW_FACTOR,
  SOFT_DROP_POINTS,
  getThemeColors,
  W,
  type Shape,
  type TetrisSkin,
  type TetrisTheme,
} from "./constants";
import { drawBlock, drawPreview, makePiece, type Piece } from "./entities";
import { clampScore, createBoard, intervalFor, rotateCW } from "./utils";

export type { TetrisSkin, TetrisTheme } from "./constants";

export interface TetrisCallbacks {
  onScore: (score: number) => void; // called when the score changes
  onLines: (lines: number) => void; // called when the cleared-lines total changes
  onLevel: (level: number) => void; // called when the level changes
  onGameOver: (finalScore: number) => void; // called once per run
  onHaptic?: (name: "clear" | "tetris") => void; // 1-3 lines cleared = "clear", 4 = "tetris"
}

export interface TetrisOptions {
  skin?: TetrisSkin; // default "retro"
  theme?: TetrisTheme; // default "dark"
}

const GAME_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Space",
  "KeyX",
  "KeyS",
  "KeyC",
]);

// Held-key repeats of these must not chain hard drops or hold swaps.
const NO_REPEAT_KEYS = new Set(["Space", "KeyS"]);

const randomPiece = (): Piece => makePiece(Math.floor(Math.random() * PIECE_TYPES) + 1);

export class TetrisEngine {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly callbacks: TetrisCallbacks;
  private skin: TetrisSkin;
  private theme: TetrisTheme;

  // Lifecycle
  private started = false;
  private paused = false;
  private finished = false; // onGameOver already fired for this run
  private destroyed = false;
  private listening = false;
  private rafId: number | null = null;
  private lastTime: number | null = null;

  // Input
  private slowHeld = false;

  // Game state (instance-owned, nothing shared between engines)
  private board: number[][] = createBoard();
  private current: Piece = randomPiece();
  private next: Piece = randomPiece();
  private hold: Piece | null = null;
  private score = 0;
  private lines = 0;
  private level = 1;
  private dropInterval = intervalFor(1);
  private dropAccum = 0;
  private toppedOut = false; // a spawned piece collided; the run ends after the current action

  // Last values sent to the callbacks, so they only fire on change.
  private emitted = { score: NaN, lines: NaN, level: NaN };

  constructor(canvas: HTMLCanvasElement, callbacks: TetrisCallbacks, options: TetrisOptions = {}) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("TetrisEngine: 2D canvas context is not available");
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.skin = options.skin ?? "retro";
    this.theme = options.theme ?? "dark";
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  setSkin(skin: TetrisSkin): void {
    this.skin = skin;
    if (!this.destroyed) this.draw();
  }

  setTheme(theme: TetrisTheme): void {
    this.theme = theme;
    if (!this.destroyed) this.draw();
  }

  start(): void {
    if (this.started || this.destroyed) return;
    this.started = true;
    this.paused = false;
    this.finished = false;
    this.initGame();
    this.attachListeners();
    this.emitChanges();
    this.draw();
    this.schedule();
  }

  pause(): void {
    if (!this.started || this.paused || this.finished || this.destroyed) return;
    this.paused = true;
    this.cancelFrame();
    this.slowHeld = false;
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
    this.slowHeld = false;
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
    const dt = this.lastTime === null ? 0 : ts - this.lastTime;
    this.lastTime = ts;
    this.update(dt);
    this.afterAction();
    if (this.finished) return;
    this.schedule();
  };

  // Gravity: at most one step per frame; the interval doubles while C is held.
  private update(dt: number): void {
    this.dropAccum += dt;
    const interval = this.slowHeld ? this.dropInterval * SLOW_FACTOR : this.dropInterval;
    if (this.dropAccum >= interval) {
      this.dropAccum = 0;
      if (!this.collide(this.current.shape, this.current.x, this.current.y + 1)) {
        this.current.y++;
      } else {
        this.lockPiece();
      }
    }
  }

  // Runs after every input or frame: sends changed values, redraws, ends the run on top-out.
  private afterAction(): void {
    this.emitChanges();
    if (this.toppedOut) {
      this.finishRun();
      return;
    }
    this.draw();
  }

  // Stops the engine for good (until destroy) and reports the final score once.
  private finishRun(): void {
    if (this.finished) return;
    this.finished = true;
    this.cancelFrame();
    this.detachListeners();
    this.slowHeld = false;
    this.draw();
    this.callbacks.onGameOver(this.score);
  }

  private emitChanges(): void {
    if (this.emitted.score !== this.score) {
      this.emitted.score = this.score;
      this.callbacks.onScore(this.score);
    }
    if (this.emitted.lines !== this.lines) {
      this.emitted.lines = this.lines;
      this.callbacks.onLines(this.lines);
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
  }

  private detachListeners(): void {
    if (!this.listening) return;
    this.listening = false;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.clearKeys);
    document.removeEventListener("visibilitychange", this.onVisibility);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.paused || this.finished || !this.started) return;
    if (!GAME_KEYS.has(e.code)) return;
    e.preventDefault();
    if (e.repeat && NO_REPEAT_KEYS.has(e.code)) return;
    switch (e.code) {
      case "ArrowLeft":
        this.move(-1);
        break;
      case "ArrowRight":
        this.move(1);
        break;
      case "ArrowUp":
      case "KeyX":
        this.tryRotate();
        break;
      case "ArrowDown":
        this.softDrop();
        break;
      case "Space":
        this.hardDrop();
        break;
      case "KeyS":
        this.holdPiece();
        break;
      case "KeyC":
        this.slowHeld = true;
        break;
    }
    this.afterAction();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === "KeyC") this.slowHeld = false;
  };

  private clearKeys = (): void => {
    this.slowHeld = false;
  };

  private onVisibility = (): void => {
    if (document.hidden) this.slowHeld = false;
  };

  // ── Game state ─────────────────────────────────────────────────────────────

  private initGame(): void {
    this.board = createBoard();
    this.current = randomPiece();
    this.next = randomPiece();
    this.hold = null;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.dropInterval = intervalFor(1);
    this.dropAccum = 0;
    this.toppedOut = false;
    this.slowHeld = false;
    this.lastTime = null;
    this.emitted = { score: NaN, lines: NaN, level: NaN };
  }

  private addScore(points: number): void {
    this.score = clampScore(this.score + points);
  }

  private collide(shape: Shape, ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && this.board[ny][nx]) return true;
      }
    }
    return false;
  }

  private move(dx: number): void {
    if (!this.collide(this.current.shape, this.current.x + dx, this.current.y)) {
      this.current.x += dx;
    }
  }

  // Clockwise; tries the wall kicks in order and ignores an impossible rotation.
  private tryRotate(): void {
    const rotated = rotateCW(this.current.shape);
    for (const kick of KICKS) {
      if (!this.collide(rotated, this.current.x + kick, this.current.y)) {
        this.current.shape = rotated;
        this.current.x += kick;
        return;
      }
    }
  }

  private softDrop(): void {
    if (!this.collide(this.current.shape, this.current.x, this.current.y + 1)) {
      this.current.y++;
      this.addScore(SOFT_DROP_POINTS);
    } else {
      this.lockPiece();
    }
  }

  private hardDrop(): void {
    const gy = this.ghostY();
    this.addScore((gy - this.current.y) * HARD_DROP_POINTS);
    this.current.y = gy;
    this.lockPiece();
  }

  private ghostY(): number {
    let gy = this.current.y;
    while (!this.collide(this.current.shape, this.current.x, gy + 1)) gy++;
    return gy;
  }

  private lockPiece(): void {
    this.merge();
    this.clearLines();
    this.spawn();
  }

  private merge(): void {
    const { shape, x, y } = this.current;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) this.board[y + r][x + c] = shape[r][c];
      }
    }
  }

  private clearLines(): void {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[r].every((v) => v !== 0)) {
        this.board.splice(r, 1);
        this.board.unshift(new Array<number>(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      this.lines += cleared;
      this.addScore((LINE_SCORES[cleared] ?? 0) * this.level); // level before the update
      this.level = 1 + Math.floor(this.lines / LINES_PER_LEVEL);
      this.dropInterval = intervalFor(this.level);
      this.callbacks.onHaptic?.(cleared >= 4 ? "tetris" : "clear");
    }
  }

  private spawn(): void {
    this.current = this.next;
    this.next = randomPiece();
    if (this.collide(this.current.shape, this.current.x, this.current.y)) {
      this.toppedOut = true;
    }
  }

  // Empty hold: stash the piece and spawn the next one. Held piece: swap it in, unless it collides.
  private holdPiece(): void {
    if (!this.hold) {
      this.hold = makePiece(this.current.type);
      this.spawn();
    } else {
      const swapped = makePiece(this.hold.type);
      if (this.collide(swapped.shape, swapped.x, swapped.y)) return;
      this.hold = makePiece(this.current.type);
      this.current = swapped;
    }
    this.dropAccum = 0;
  }

  // ── Drawing ────────────────────────────────────────────────────────────────

  private draw(): void {
    const { ctx, skin } = this;
    const colors = getThemeColors(skin, this.theme);
    const boardFill = colors.boardFill;
    const grid = colors.grid;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, W, H);

    // Board
    ctx.fillStyle = boardFill;
    ctx.fillRect(0, 0, BOARD_W, BOARD_H);
    ctx.strokeStyle = grid;
    ctx.lineWidth = GRID_LINE_WIDTH;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK, 0);
      ctx.lineTo(c * BLOCK, BOARD_H);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK);
      ctx.lineTo(BOARD_W, r * BLOCK);
      ctx.stroke();
    }
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, BOARD_W - 1, BOARD_H - 1);

    // Locked blocks
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        drawBlock(ctx, skin, c, r, this.board[r][c], BLOCK);
      }
    }

    // Ghost (under the current piece), then the current piece
    const { shape, x, y } = this.current;
    if (!this.toppedOut) {
      const gy = this.ghostY();
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (shape[r][c]) drawBlock(ctx, skin, x + c, gy + r, shape[r][c], BLOCK, GHOST_ALPHA);
        }
      }
    }
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        drawBlock(ctx, skin, x + c, y + r, shape[r][c], BLOCK);
      }
    }

    // Side column: NEXT and HOLD
    this.drawBox("NEXT", NEXT_LABEL_Y, NEXT_BOX, boardFill, this.next);
    this.drawBox("HOLD", HOLD_LABEL_Y, HOLD_BOX, boardFill, this.hold);
  }

  private drawBox(
    label: string,
    labelY: number,
    box: { x: number; y: number; w: number; h: number },
    fill: string,
    piece: Piece | null,
  ): void {
    const { ctx } = this;
    const colors = getThemeColors(this.skin, this.theme);
    ctx.fillStyle = fill;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1);

    ctx.save();
    ctx.fillStyle = colors.label;
    ctx.font = LABEL_FONT;
    ctx.textBaseline = "middle";
    if ("letterSpacing" in ctx) ctx.letterSpacing = LABEL_LETTER_SPACING;
    ctx.fillText(label, SIDE_X, labelY);
    ctx.restore();

    drawPreview(ctx, this.skin, piece, box.x, box.y);
  }
}
