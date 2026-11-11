// Marcy the Vampire Hunter engine: gothic castle platformer with a 12x12 dot-grid password.
// Framework-free: no react or next imports, no module-level game state.
import {
  CREDIT_COIN_BLINK,
  CREDIT_COIN_LIFETIME,
  CROUCH_H,
  DASH_COOLDOWN,
  DASH_H,
  DASH_SPEED,
  DASH_TIME,
  EXTRA_LIFE_EVERY,
  GLIDE_FALL,
  GRAVITY,
  GRID_COLS,
  GRID_SIZE,
  H,
  HERO_H,
  HERO_INFO,
  HERO_W,
  HURT_INVULN,
  JUMP_CUT_V,
  JUMP_V,
  MAX_DT,
  MAX_FALL,
  MAX_LEVEL,
  MAX_LEVEL_MAIN,
  MAX_LIVES,
  MAX_STEP,
  MIST_TIME,
  MP_REGEN,
  RELIC_INFO,
  RUN_SPEED,
  START_LIVES,
  TILE,
  W,
  ZONE_PALETTES,
  TURNED_PALETTES,
  type ZonePalette,
} from "./constants";
import {
  BOSSES,
  BOSS_PLAN_SCALE,
  COIN_PALETTE,
  COIN_ROWS,
  ENEMIES,
  ENEMY_PLAN_SCALE,
  FLAME_A,
  FLAME_B,
  FLAME_PALETTE,
  HERO_PALETTES,
  bossRows,
  buildSprite,
  drawSprite,
  enemyPalette,
  heroRows,
  planRows,
  type BossDef,
  type BossPattern,
  type EnemyDef,
  type HeroFrame,
  type SpritePalette,
  type SpriteRows,
} from "./entities";
import { SLOT_LABEL, itemName, mainTier, weaponElement, type Element } from "./items";
import {
  RELICS,
  SLOTS,
  decodePassword,
  emptyProgress,
  emptyTurned,
  encodePassword,
  filledLabels,
  parsePasswordText,
  passwordScore,
  type Hero,
  type PasswordGrid,
  type Progress,
  type Relic,
  type Slot,
} from "./password";
import {
  clampScore,
  computeStats,
  damage,
  hashString,
  makeRng,
  rectsOverlap,
  rollCreditDrop,
  xpToNext,
  type Rect,
  type Stats,
} from "./utils";
import { FLOOR_ROW, bossDoorNeeds, buildMainCastle, type Room, type World, type ZoneDef } from "./world";
import { HUB_ID, buildTurnedCastle } from "./world-turned";

export type VampireHunterSound =
  | "whip"
  | "slash"
  | "hit"
  | "enemyDie"
  | "bossHit"
  | "bossTick"
  | "bossDie"
  | "pickup"
  | "relic"
  | "levelUp"
  | "jump"
  | "dash"
  | "save"
  | "death"
  | "gameover"
  | "select"
  | "victory"
  | "turn"
  | "credit";

export interface VampireHunterCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
  onSound?: (name: VampireHunterSound) => void;
  onHaptic?: (name: "death" | "clear") => void;
  onMusic?: (track: "stage" | "boss") => void;
  /** Fired once per collected Credit Coin. */
  onCreditDrop?: () => void;
  /** False for guests: no roll, no coin. Read at every roll. */
  canDropCredit?: () => boolean;
}

type Screen =
  | "title"
  | "hero-select"
  | "password-entry"
  | "play"
  | "menu"
  | "altar"
  | "confirm-delete"
  | "victory"
  | "turn-scene"
  | "true-end";

type Tab = "MAP" | "EQUIP" | "STATUS" | "PASSWORD";
const TABS: Tab[] = ["MAP", "EQUIP", "STATUS", "PASSWORD"];

interface Body extends Rect {
  vx: number;
  vy: number;
}

interface HeroState extends Body {
  hp: number;
  mp: number;
  face: 1 | -1;
  onGround: boolean;
  crouch: boolean;
  invuln: number;
  hurtT: number;
  atkT: number;
  atkDir: "fwd" | "up";
  atkHit: Set<object>;
  combo: number;
  comboT: number;
  burstT: number;
  dashT: number;
  dashCool: number;
  mistT: number;
  jumps: number;
  coyote: number;
  jumpBuf: number;
  runT: number;
  dropT: number;
}

interface Enemy extends Body {
  def: EnemyDef;
  hp: number;
  maxHp: number;
  dir: 1 | -1;
  t: number;
  state: "idle" | "windup" | "charge" | "stun" | "leap";
  baseY: number;
  hitFlash: number;
  stun: number;
  scale: number;
  grounded: boolean;
  homeX: number;
}

type ShotKind = "bolt" | "orb" | "lob" | "rain" | "wave" | "slash" | "hero-slash" | "hero-wave";

interface Shot extends Body {
  kind: ShotKind;
  dmg: number;
  fromHero: boolean;
  life: number;
  homing: boolean;
  pierce: boolean;
  hit: Set<object>;
  gravity: number;
  element: Element;
  atkType: "whip" | "slash" | "crush";
  color: string;
}

type PickupKind = "hp" | "mp" | "xp" | "gear" | "life" | "relic" | "coin" | "crest";
interface Pickup extends Body {
  kind: PickupKind;
  life: number;
  value: number;
  relic?: Relic;
  slot?: Slot;
  tier?: number;
  bob: number;
  onGround: boolean;
  key?: string;
}

interface Hazard extends Rect {
  life: number;
  delay: number;
  dmg: number;
  color: string;
  slow: boolean;
}

interface Breakable extends Rect {
  key: string;
  alive: boolean;
}

interface Chest extends Rect {
  key: string;
  tier: number;
  open: boolean;
}

interface CrestSpot extends Rect {
  key: string;
  taken: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

interface Boss {
  def: BossDef;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  shown: number;
  face: 1 | -1;
  state: "intro" | "idle" | "tel" | "act" | "recover" | "dead";
  pat: BossPattern | null;
  lastPat: BossPattern | null;
  t: number;
  actT: number;
  phase: number;
  hitFlash: number;
  onGround: boolean;
  homeY: number;
  tickT: number;
  fireT: number;
  volley: number;
  flash: number;
}

interface FloatText {
  text: string;
  x: number;
  y: number;
  t: number;
  color: string;
}

interface PitSegment {
  c0: number;
  c1: number;
  t: number;
}

const GAME_KEYS = new Set([
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "KeyX", "KeyJ", "KeyC", "KeyK", "KeyZ",
  "ShiftLeft", "ShiftRight", "Enter", "KeyA", "KeyD", "KeyW", "KeyS",
]);

/** Enemy kinds that can spawn as a Medusa Head instead (33%). */
const MEDUSA_SWAP: Record<string, string> = { bat: "medusa", crimsonbat: "azuremedusa" };

const ONE_UP_CHANCE = 0.004;
const GEAR_CHANCE = 0.015;

export class VampireHunterEngine {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;
  private readonly sprites = new Map<string, HTMLCanvasElement>();
  private readonly layers = new Map<string, HTMLCanvasElement>();
  private readonly keys = new Set<string>();
  private pressed = new Set<string>();
  private readonly rng = makeRng(0x6d61726379);

  private readonly main: World;
  private readonly turned: World;

  private started = false;
  private paused = false;
  private over = false;
  private raf = 0;
  private lastTs = 0;
  private time = 0;

  // Progress and run state
  private progress: Progress = emptyProgress("marcy");
  private hasLoaded = false;
  private stats: Stats = computeStats(this.progress);
  private xp = 0;
  private score = 0;
  private lives = START_LIVES;
  private nextLife = EXTRA_LIFE_EVERY;
  private lastScore = -1;
  private lastLives = -1;
  private lastLevel = -1;
  private castle: "main" | "turned" = "main";

  // Screens
  private screen: Screen = "title";
  private prevScreen: Screen = "title";
  private titleCursor = 0;
  private heroCursor = 0;
  private tab: Tab = "MAP";
  private mapRow = 0;
  private mapShowTurned = false;
  private statusPage = 0;
  private equipCursor = 0;
  private pwCursor = 0;
  private confirmCursor = 0;
  private toast = "";
  private toastT = 0;
  private pwMode: "enter" | "show" = "enter";
  private pwGrid: PasswordGrid = new Array<boolean>(GRID_SIZE).fill(false);
  private pwRow = 0;
  private pwCol = 0;
  private pwMsg = "";
  private pwMsgT = 0;
  private pwNext: Screen = "title";
  private pwShowCursor = 0;
  private copyMsg = "";
  private copyMsgT = 0;
  private victoryCursor = 0;
  private turnT = 0;
  private pasteListening = false;

  // Play state
  private roomId = "z1-2";
  private respawn = { room: "z1-2", x: 8 * TILE };
  private visited = new Set<string>();
  private hero: HeroState = this.newHero(0, 0);
  private enemies: Enemy[] = [];
  private shots: Shot[] = [];
  private pickups: Pickup[] = [];
  private hazards: Hazard[] = [];
  private breakables: Breakable[] = [];
  private chests: Chest[] = [];
  private crests: CrestSpot[] = [];
  private particles: Particle[] = [];
  private floats: FloatText[] = [];
  private boss: Boss | null = null;
  private bossStarted = false;
  private bossEndT = 0;
  private gateClosed = false;
  private camX = 0;
  private lastSafe = { x: 0, y: 0 };
  private safeT = 0;
  private opened = new Set<string>();
  private brokenTiles = new Set<string>();
  private brokenBreakables = new Set<string>();
  private pits: PitSegment[] = [];
  private pitTimer = 0;
  private bossMusic = false;
  private shake = 0;
  private flashT = 0;
  private hudFlashT = 0;
  private lastHeroTier = 0;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly cb: VampireHunterCallbacks,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas not available");
    this.canvas = canvas;
    this.ctx = ctx;
    canvas.width = W;
    canvas.height = H;
    ctx.imageSmoothingEnabled = false;
    this.main = buildMainCastle((zone, n) => mainTier(zone, (n * 0.37 + zone * 0.21) % 1));
    this.turned = buildTurnedCastle();
  }

  // ---------------------------------------------------------------- public API

  start(): void {
    if (this.started || this.over) return;
    this.started = true;
    this.screen = "title";
    this.emitScore();
    this.emitLives();
    this.emitLevel();
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onBlur);
    this.canvas.addEventListener("pointerdown", this.onPointer);
    this.lastTs = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  pause(): void {
    if (!this.started || this.over || this.paused) return;
    this.paused = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.keys.clear();
    this.pressed.clear();
    this.draw();
  }

  resume(): void {
    if (!this.started || this.over || !this.paused) return;
    this.paused = false;
    this.lastTs = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  end(): void {
    this.finish();
  }

  destroy(): void {
    this.over = true;
    this.teardown();
  }

  // ---------------------------------------------------------------- lifecycle

  private teardown(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onBlur);
    this.canvas.removeEventListener("pointerdown", this.onPointer);
    this.stopPasteListener();
    this.keys.clear();
    this.pressed.clear();
  }

  private finish(): void {
    if (this.over || !this.started) return;
    this.over = true;
    this.teardown();
    this.cb.onGameOver(this.score);
  }

  private frame = (ts: number): void => {
    if (this.over || this.paused) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = this.lastTs === 0 ? 0 : Math.min(MAX_DT, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    this.update(dt);
    if (!this.over) this.draw();
  };

  private onBlur = (): void => {
    this.keys.clear();
    this.pressed.clear();
  };

  // ---------------------------------------------------------------- emit helpers

  private emitScore(): void {
    if (this.score !== this.lastScore) {
      this.lastScore = this.score;
      this.cb.onScore(this.score);
    }
  }

  private emitLives(): void {
    if (this.lives !== this.lastLives) {
      this.lastLives = this.lives;
      this.cb.onLives(this.lives);
    }
  }

  private emitLevel(): void {
    if (this.progress.level !== this.lastLevel) {
      this.lastLevel = this.progress.level;
      this.cb.onLevel(this.progress.level);
    }
  }

  private sound(name: VampireHunterSound): void {
    this.cb.onSound?.(name);
  }

  private addScore(points: number): void {
    this.score = clampScore(this.score + points);
    while (this.score >= this.nextLife) {
      this.nextLife += EXTRA_LIFE_EVERY;
      if (this.lives < MAX_LIVES) {
        this.lives++;
        this.emitLives();
        this.sound("pickup");
      }
    }
    this.emitScore();
  }

  private resetNextLife(): void {
    this.nextLife = (Math.floor(this.score / EXTRA_LIFE_EVERY) + 1) * EXTRA_LIFE_EVERY;
  }

  private setToast(text: string, snd: VampireHunterSound | null = "hit"): void {
    this.toast = text;
    this.toastT = 2;
    if (snd) this.sound(snd);
  }

  // ---------------------------------------------------------------- input

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.over || this.paused) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const code = e.code;
    if (GAME_KEYS.has(code)) e.preventDefault();
    if (e.repeat) {
      this.keys.add(code);
      return;
    }
    this.keys.add(code);
    this.pressed.add(code);
    this.menuKey(code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onPointer = (e: PointerEvent): void => {
    if (this.over || this.paused) return;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    if (x > W - 140 && y < 64 && (this.screen === "play" || this.screen === "menu")) {
      e.preventDefault();
      if (this.screen === "play") this.openMenu();
      else this.closeMenu();
    }
  };

  private held(codes: string[]): boolean {
    for (const c of codes) if (this.keys.has(c)) return true;
    return false;
  }

  private edge(codes: string[]): boolean {
    for (const c of codes) if (this.pressed.has(c)) return true;
    return false;
  }

  /** Menu input: runs on every non-repeat keydown, for the screens that are not play. */
  private menuKey(code: string): void {
    const up = code === "ArrowUp" || code === "KeyW";
    const down = code === "ArrowDown" || code === "KeyS";
    const left = code === "ArrowLeft" || code === "KeyA";
    const right = code === "ArrowRight" || code === "KeyD";
    const ok = code === "Space";
    const enter = code === "Enter";
    const back = code === "KeyX" || code === "KeyJ" || code === "Escape";
    const clear = code === "KeyC" || code === "KeyK";
    switch (this.screen) {
      case "title": return this.titleKey(up, down, ok || enter);
      case "hero-select": return this.heroKey(left, right, ok || enter, back);
      case "password-entry": return this.entryKey(up, down, left, right, ok, enter, back, clear);
      case "altar":
        if (back) { this.sound("select"); this.screen = this.pwNext; return; }
        return this.showKey(up, down, left, right, ok || enter);
      case "confirm-delete": return this.confirmKey(left, right, ok || enter, back);
      case "victory": return this.victoryKey(up, down, ok || enter);
      case "true-end":
        if (clear) this.copyPassword();
        else if (ok || enter) { this.sound("select"); this.finish(); }
        return;
      case "turn-scene": if (ok || enter) this.endTurnScene(); return;
      case "menu": return this.menuTabKey(up, down, left, right, ok, enter, back, clear);
      case "play": if (enter) this.openMenu(); return;
    }
  }

  // ---------------------------------------------------------------- title and select

  private titleItems(): string[] {
    return this.hasLoaded ? ["NEW GAME", "PASSWORD", "DELETE PROGRESS"] : ["NEW GAME", "PASSWORD"];
  }

  private titleKey(up: boolean, down: boolean, ok: boolean): void {
    const items = this.titleItems();
    if (up) { this.titleCursor = (this.titleCursor + items.length - 1) % items.length; this.sound("select"); }
    if (down) { this.titleCursor = (this.titleCursor + 1) % items.length; this.sound("select"); }
    if (!ok) return;
    this.sound("select");
    const item = items[this.titleCursor];
    if (item === "NEW GAME") { this.heroCursor = 0; this.screen = "hero-select"; }
    else if (item === "PASSWORD") this.openPasswordEntry();
    else this.openConfirmDelete("title");
  }

  private heroKey(left: boolean, right: boolean, ok: boolean, back: boolean): void {
    if (left || right) { this.heroCursor = this.heroCursor === 0 ? 1 : 0; this.sound("select"); }
    if (back) { this.screen = "title"; return; }
    if (!ok) return;
    this.sound("save");
    this.beginRun(emptyProgress(this.heroCursor === 0 ? "marcy" : "frankford"), true);
  }

  /** Starts (or restarts) play at the Gate Court altar with the given progress. */
  private beginRun(p: Progress, fresh: boolean): void {
    this.progress = p;
    this.castle = "main";
    this.xp = 0;
    this.stats = computeStats(p);
    if (fresh) {
      this.score = 0;
      this.resetNextLife();
    }
    this.lives = START_LIVES;
    this.opened.clear();
    this.brokenTiles.clear();
    this.brokenBreakables.clear();
    this.visited.clear();
    this.emitScore();
    this.emitLives();
    this.emitLevel();
    this.hero = this.newHero(0, 0);
    this.hero.hp = this.stats.maxHp;
    this.hero.mp = this.stats.maxMp;
    this.respawn = { room: "z1-2", x: 8 * TILE };
    this.setBossMusic(false);
    this.enterRoom("z1-2", this.respawn.x, null);
    this.screen = "play";
  }

  // ---------------------------------------------------------------- password

  private startPasteListener(): void {
    if (this.pasteListening) return;
    this.pasteListening = true;
    window.addEventListener("paste", this.onPaste);
  }

  private stopPasteListener(): void {
    if (!this.pasteListening) return;
    this.pasteListening = false;
    window.removeEventListener("paste", this.onPaste);
  }

  private onPaste = (e: ClipboardEvent): void => {
    if (this.over || this.paused || this.screen !== "password-entry") return;
    const text = e.clipboardData?.getData("text") ?? "";
    e.preventDefault();
    this.applyPasted(text);
  };

  private applyPasted(text: string): void {
    const grid = parsePasswordText(text);
    if (!grid) {
      this.pwMsg = "INVALID TEXT";
      this.pwMsgT = 2;
      this.sound("hit");
      return;
    }
    this.pwGrid = grid;
    this.pwMsg = "PASTED";
    this.pwMsgT = 1.5;
    this.sound("pickup");
  }

  private openPasswordEntry(): void {
    this.pwMode = "enter";
    this.pwGrid = new Array<boolean>(GRID_SIZE).fill(false);
    this.pwRow = 0;
    this.pwCol = 0;
    this.pwMsg = "";
    this.pwMsgT = 0;
    this.pwNext = "title";
    this.screen = "password-entry";
    this.startPasteListener();
  }

  private leavePasswordEntry(to: Screen): void {
    this.stopPasteListener();
    this.screen = to;
  }

  private pasteFromClipboard(): void {
    const nav = typeof navigator !== "undefined" ? navigator : null;
    if (!nav?.clipboard?.readText) {
      this.pwMsg = "PRESS CTRL+V";
      this.pwMsgT = 2.5;
      return;
    }
    nav.clipboard.readText().then(
      (text) => {
        if (this.screen === "password-entry" && !this.over) this.applyPasted(text);
      },
      () => {
        this.pwMsg = "PRESS CTRL+V";
        this.pwMsgT = 2.5;
      },
    );
  }

  private entryKey(up: boolean, down: boolean, left: boolean, right: boolean, ok: boolean, enter: boolean, back: boolean, clear: boolean): void {
    const rows = GRID_COLS + 1;
    if (up) { this.pwRow = (this.pwRow + rows - 1) % rows; this.sound("select"); }
    if (down) { this.pwRow = (this.pwRow + 1) % rows; this.sound("select"); }
    const cols = this.pwRow === GRID_COLS ? 4 : GRID_COLS;
    if (left) { this.pwCol = (this.pwCol + cols - 1) % cols; this.sound("select"); }
    if (right) { this.pwCol = (this.pwCol + 1) % cols; this.sound("select"); }
    if (this.pwCol >= cols) this.pwCol = cols - 1;
    if (clear) { this.pwGrid = new Array<boolean>(GRID_SIZE).fill(false); this.sound("select"); return; }
    if (back) { this.sound("select"); this.titleCursor = 1; this.leavePasswordEntry("title"); return; }
    if (enter) { this.validateEntry(); return; }
    if (!ok) return;
    if (this.pwRow < GRID_COLS) {
      const i = this.pwRow * GRID_COLS + this.pwCol;
      this.pwGrid[i] = !this.pwGrid[i];
      this.sound("select");
      return;
    }
    // Option row: PASTE, CLEAR, OK, BACK
    if (this.pwCol === 0) this.pasteFromClipboard();
    else if (this.pwCol === 1) { this.pwGrid = new Array<boolean>(GRID_SIZE).fill(false); this.sound("select"); }
    else if (this.pwCol === 2) this.validateEntry();
    else { this.sound("select"); this.titleCursor = 1; this.leavePasswordEntry("title"); }
  }

  private validateEntry(): void {
    const decoded = decodePassword(this.pwGrid);
    if (!decoded) {
      this.pwMsg = "WRONG PASSWORD";
      this.pwMsgT = 2.5;
      this.sound("hit");
      return;
    }
    this.stopPasteListener();
    this.hasLoaded = true;
    this.score = decoded.score;
    this.resetNextLife();
    this.sound("relic");
    this.beginRun(decoded, false);
    // A restored run starts with the stored XP at the start of its level.
    this.xp = 0;
  }

  /** Rebuilds `progress` from the live run and returns its grid. */
  private currentGrid(): PasswordGrid {
    this.progress.score = passwordScore(this.score);
    return encodePassword(this.progress);
  }

  private openAltarScreen(next: Screen): void {
    this.pwMode = "show";
    this.pwGrid = this.currentGrid();
    this.pwShowCursor = 0;
    this.pwNext = next;
    this.screen = "altar";
  }

  private showKey(up: boolean, down: boolean, left: boolean, right: boolean, ok: boolean): void {
    if (up || down || left || right) { this.pwShowCursor = this.pwShowCursor === 0 ? 1 : 0; this.sound("select"); }
    if (!ok) return;
    if (this.pwShowCursor === 1) { this.copyPassword(); return; }
    this.sound("select");
    this.screen = this.pwNext;
  }

  /** Copies the filled cell labels (e.g. "A2 A3 B10") to the clipboard. */
  private copyPassword(): void {
    const text = filledLabels(this.pwGrid).join(" ");
    const done = (ok: boolean) => {
      this.copyMsg = ok ? "COPIED" : "COPY FAILED";
      this.copyMsgT = 2;
      this.sound(ok ? "pickup" : "hit");
    };
    const fallback = () => {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        done(ok);
      } catch {
        done(false);
      }
    };
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => done(true), fallback);
    } else {
      fallback();
    }
  }

  private openConfirmDelete(from: Screen): void {
    this.prevScreen = from;
    this.confirmCursor = 0;
    this.screen = "confirm-delete";
  }

  private confirmKey(left: boolean, right: boolean, ok: boolean, back: boolean): void {
    if (left || right) { this.confirmCursor = this.confirmCursor === 0 ? 1 : 0; this.sound("select"); }
    if (back) { this.screen = this.prevScreen; return; }
    if (!ok) return;
    this.sound("select");
    if (this.confirmCursor === 1) {
      this.deleteProgress();
      this.screen = "title";
      this.titleCursor = 0;
      return;
    }
    this.screen = this.prevScreen;
  }

  /** Resets hero, relics, bosses, level, gear, crests, maps, Turned data and score; back to the title. */
  private deleteProgress(): void {
    this.progress = emptyProgress("marcy");
    this.progress.turned = emptyTurned();
    this.hasLoaded = false;
    this.castle = "main";
    this.xp = 0;
    this.score = 0;
    this.lives = START_LIVES;
    this.resetNextLife();
    this.setBossMusic(false);
    this.boss = null;
    this.stats = computeStats(this.progress);
    this.emitScore();
    this.emitLives();
    this.emitLevel();
  }

  // ---------------------------------------------------------------- menu (in canvas)

  private openMenu(): void {
    if (this.screen !== "play") return;
    this.keys.clear();
    this.screen = "menu";
    this.tab = "MAP";
    this.mapShowTurned = this.castle === "turned";
    const zs = this.zoneList(this.mapShowTurned ? "turned" : "main");
    const cur = this.currentZoneIndex();
    this.mapRow = Math.max(0, Math.min(zs.length - 1, cur));
    this.pwCursor = 0;
    this.pwGrid = this.currentGrid();
    this.sound("select");
  }

  private closeMenu(): void {
    this.screen = "play";
    this.keys.clear();
    this.sound("select");
  }

  private zoneList(castle: "main" | "turned"): ZoneDef[] {
    return castle === "main" ? this.main.zones : this.turned.zones;
  }

  private currentZoneIndex(): number {
    return this.rooms(this.roomId)?.zone ?? 0;
  }

  private menuTabKey(up: boolean, down: boolean, left: boolean, right: boolean, ok: boolean, enter: boolean, back: boolean, clear: boolean): void {
    if (enter || back) { this.closeMenu(); return; }
    const ti = TABS.indexOf(this.tab);
    const faust = this.progress.bosses[8];
    if (this.tab === "MAP") {
      const zs = this.zoneList(this.mapShowTurned ? "turned" : "main");
      if (left) { this.tab = TABS[(ti + TABS.length - 1) % TABS.length]; this.sound("select"); this.pwGrid = this.currentGrid(); return; }
      if (right) { this.tab = TABS[(ti + 1) % TABS.length]; this.sound("select"); this.pwGrid = this.currentGrid(); return; }
      if (up) { this.mapRow = this.mapRow - 1 < -1 ? zs.length - 1 : this.mapRow - 1; this.sound("select"); return; }
      if (down) { this.mapRow = this.mapRow + 1 >= zs.length ? -1 : this.mapRow + 1; this.sound("select"); return; }
      if (clear && faust) { this.mapShowTurned = !this.mapShowTurned; this.mapRow = 0; this.sound("select"); return; }
      if (ok) {
        if (this.mapRow === -1) {
          if (faust) { this.mapShowTurned = !this.mapShowTurned; this.mapRow = 0; this.sound("select"); }
          return;
        }
        this.warpTo(this.mapShowTurned ? "turned" : "main", this.mapRow);
      }
      return;
    }
    if (left) { this.tab = TABS[(ti + TABS.length - 1) % TABS.length]; this.sound("select"); this.pwGrid = this.currentGrid(); return; }
    if (right) { this.tab = TABS[(ti + 1) % TABS.length]; this.sound("select"); this.pwGrid = this.currentGrid(); return; }
    if (this.tab === "EQUIP") {
      if (up) { this.equipCursor = (this.equipCursor + SLOTS.length - 1) % SLOTS.length; this.sound("select"); }
      if (down) { this.equipCursor = (this.equipCursor + 1) % SLOTS.length; this.sound("select"); }
    } else if (this.tab === "STATUS") {
      if (up || down) { this.statusPage = this.statusPage === 0 ? 1 : 0; this.sound("select"); }
    } else if (this.tab === "PASSWORD") {
      if (up || down) { this.pwCursor = this.pwCursor === 0 ? 1 : 0; this.sound("select"); }
      if (ok) {
        if (this.pwCursor === 0) this.copyPassword();
        else this.openConfirmDelete("menu");
      }
    }
  }

  /** Warps to the altar of a zone whose map bit is set. */
  private warpTo(castle: "main" | "turned", zoneIdx: number): void {
    const zs = this.zoneList(castle);
    const zd = zs[zoneIdx];
    if (!zd) return;
    const mapped = castle === "main" ? this.progress.mapped[zoneIdx] : zoneIdx === 8 ? this.progress.turned.bosses.slice(0, 8).every(Boolean) : this.progress.turned.mapped[zoneIdx];
    if (!mapped || !zd.altarRoom) { this.setToast("MAP NOT REVEALED"); return; }
    if (castle === "turned" && !this.progress.bosses[8]) return;
    this.castle = castle;
    const room = this.rooms(zd.altarRoom);
    this.respawn = { room: zd.altarRoom, x: (room.altarCol ?? 8) * TILE };
    this.screen = "play";
    this.keys.clear();
    this.setBossMusic(false);
    this.enterRoom(zd.altarRoom, this.respawn.x, null);
    this.sound("save");
  }

  // ---------------------------------------------------------------- world access

  private rooms(id: string): Room {
    return this.main.rooms[id] ?? this.turned.rooms[id];
  }

  private zoneOf(room: Room): ZoneDef {
    return (room.castle === "main" ? this.main.zones : this.turned.zones)[room.zone] ?? this.main.zones[0];
  }

  private palette(room: Room): ZonePalette {
    if (room.castle === "main") return ZONE_PALETTES[room.zone];
    return room.id === HUB_ID ? TURNED_PALETTES[0] : TURNED_PALETTES[Math.min(8, room.zone)];
  }

  private get room(): Room {
    return this.rooms(this.roomId);
  }

  private newHero(x: number, y: number): HeroState {
    return {
      x, y, w: HERO_W, h: HERO_H, vx: 0, vy: 0, hp: 1, mp: 0, face: 1, onGround: false, crouch: false,
      invuln: 0, hurtT: 0, atkT: 0, atkDir: "fwd", atkHit: new Set(), combo: 0, comboT: 0, burstT: 0,
      dashT: 0, dashCool: 0, mistT: 0, jumps: 0, coyote: 0, jumpBuf: 0, runT: 0, dropT: 0,
    };
  }

  /** Condition of a boss door `K` for the current room. */
  private bossDoorOpen(room: Room): boolean {
    const needs = bossDoorNeeds(room.castle, room.zone);
    const list = room.castle === "main" ? this.progress.bosses : this.progress.turned.bosses;
    return needs.every((i) => list[i]);
  }

  private bossDefeated(room: Room): boolean {
    if (!room.boss) return true;
    const def = BOSSES[room.boss];
    const list = def.turned ? this.progress.turned.bosses : this.progress.bosses;
    return list[def.index];
  }

  /** Is a gate `X` tile closed at column `c` of the current room? */
  private gateXClosed(room: Room, c: number): boolean {
    if (!room.boss) return false;
    if (this.bossDefeated(room)) return false;
    if (c === 0) return this.bossStarted;
    return true;
  }

  private tileChar(room: Room, c: number, r: number): string {
    if (r < 0 || r >= room.tiles.length) return " ";
    if (c < 0 || c >= room.cols) return "#";
    if (r === FLOOR_ROW && this.pits.length > 0) {
      for (const p of this.pits) if (p.t > 0 && p.t <= 2.2 && c >= p.c0 && c <= p.c1) return "^";
    }
    return room.tiles[r][c];
  }

  private solidTile(room: Room, c: number, r: number): boolean {
    const ch = this.tileChar(room, c, r);
    switch (ch) {
      case "#": return true;
      case "H": return !this.progress.relics.lantern;
      case "G": return this.hero.mistT <= 0;
      case "S": return !this.brokenTiles.has(`${room.id}:${c}:${r}`);
      case "K": return !this.bossDoorOpen(room);
      case "X": return this.gateXClosed(room, c);
      default: return false;
    }
  }

  private collides(e: Rect): boolean {
    const room = this.room;
    const c0 = Math.floor(e.x / TILE);
    const c1 = Math.floor((e.x + e.w - 0.01) / TILE);
    const r0 = Math.floor(e.y / TILE);
    const r1 = Math.floor((e.y + e.h - 0.01) / TILE);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (this.solidTile(room, c, r)) return true;
    return false;
  }

  private moveX(e: Body, dx: number): boolean {
    let hit = false;
    let left = Math.abs(dx);
    const s = Math.sign(dx);
    while (left > 0) {
      const step = Math.min(MAX_STEP, left);
      e.x += s * step;
      if (this.collides(e)) {
        e.x -= s * step;
        hit = true;
        break;
      }
      left -= step;
    }
    return hit;
  }

  /** Moves vertically. Returns "down" when landing, "up" when hitting a ceiling. One-way tiles only stop a falling body. */
  private moveY(e: Body, dy: number, passOneWay = false): "down" | "up" | null {
    let left = Math.abs(dy);
    const s = Math.sign(dy);
    const room = this.room;
    while (left > 0) {
      const step = Math.min(MAX_STEP, left);
      const prevBottom = e.y + e.h;
      e.y += s * step;
      if (this.collides(e)) {
        e.y -= s * step;
        return s > 0 ? "down" : "up";
      }
      if (s > 0 && !passOneWay) {
        const c0 = Math.floor(e.x / TILE);
        const c1 = Math.floor((e.x + e.w - 0.01) / TILE);
        const r = Math.floor((e.y + e.h - 0.01) / TILE);
        for (let c = c0; c <= c1; c++) {
          if (this.tileChar(room, c, r) === "=" && prevBottom <= r * TILE + 1 && e.y + e.h > r * TILE) {
            e.y = r * TILE - e.h;
            return "down";
          }
        }
      }
      left -= step;
    }
    return null;
  }

  // ---------------------------------------------------------------- music

  private setBossMusic(on: boolean): void {
    if (this.bossMusic === on) return;
    this.bossMusic = on;
    this.cb.onMusic?.(on ? "boss" : "stage");
  }

  // ---------------------------------------------------------------- rooms

  /** Loads a room and places the hero. `y` null puts the feet on the floor under `x`. */
  private enterRoom(id: string, x: number, y: number | null): void {
    const room = this.rooms(id);
    this.roomId = id;
    this.visited.add(id);
    this.enemies = [];
    this.shots = [];
    this.pickups = [];
    this.hazards = [];
    this.particles = [];
    this.boss = null;
    this.bossStarted = false;
    this.bossEndT = 0;
    this.pits = [];
    this.pitTimer = 0;
    this.breakables = [];
    this.chests = [];
    this.crests = [];
    const h = this.hero;
    h.vx = 0;
    h.vy = 0;
    h.crouch = false;
    h.dashT = 0;
    h.atkT = 0;
    h.burstT = 0;
    h.h = HERO_H;
    h.x = x;
    h.y = y === null ? FLOOR_ROW * TILE - HERO_H : Math.min(y, FLOOR_ROW * TILE - HERO_H);
    // Move up until free of solid tiles.
    for (let i = 0; i < 12 && this.collides(h); i++) h.y -= TILE / 2;
    h.onGround = false;

    const zd = this.zoneOf(room);
    const zoneKey = `${room.castle}:${room.zone}`;
    if (id !== HUB_ID && !this.visitedZones.has(zoneKey)) {
      this.visitedZones.add(zoneKey);
      if (this.visitedZones.size > 1 || room.castle === "turned") this.addScore(room.castle === "turned" ? 500 : 300);
    }
    const medusas: Record<string, number> = {};
    for (const s of room.spawns) {
      const px = s.col * TILE;
      const py = s.row * TILE;
      if (s.t === "enemy" && s.id && ENEMIES[s.id]) {
        // A bat becomes a Medusa Head and a Crimson Bat an Azure Medusa Head 33% of the time,
        // with at most 3 of each Medusa kind per room.
        let kind = s.id;
        const swap = Object.hasOwn(MEDUSA_SWAP, kind) ? MEDUSA_SWAP[kind] : undefined;
        if (swap && (medusas[swap] ?? 0) < 3 && this.rng() < 0.33) {
          kind = swap;
          medusas[swap] = (medusas[swap] ?? 0) + 1;
        }
        this.spawnEnemy(ENEMIES[kind], s.col, s.row);
      }
      else if (s.t === "breakable" && s.key && !this.brokenBreakables.has(s.key)) {
        this.breakables.push({ x: px + 12, y: py + 6, w: 24, h: 42, key: s.key, alive: true });
      } else if (s.t === "chest" && s.key) {
        this.chests.push({ x: px, y: py + 10, w: 48, h: 38, key: s.key, tier: s.tier ?? 1, open: this.opened.has(s.key) });
      } else if (s.t === "crest" && s.key && !this.crestTaken(s.key)) {
        this.crests.push({ x: px + 6, y: py + 6, w: 36, h: 36, key: s.key, taken: false });
      } else if (s.t === "boss" && s.id && !this.bossDefeated(room)) {
        this.boss = this.makeBoss(BOSSES[s.id], px, room);
      }
    }
    this.camX = this.clampCam(h.x + h.w / 2 - W / 2, room);
    this.lastSafe = { x: h.x, y: h.y };
    this.safeT = 0;
    void zd;
  }

  private visitedZones = new Set<string>();

  private crestTaken(key: string): boolean {
    const m = /^crest:(main|turned):(\d+)$/.exec(key);
    if (!m) return false;
    const i = parseInt(m[2], 10);
    return m[1] === "main" ? this.progress.crests[i] : this.progress.turned.crests[i];
  }

  private clampCam(x: number, room: Room): number {
    return Math.max(0, Math.min(room.cols * TILE - W, x));
  }

  // ---------------------------------------------------------------- update

  private update(dt: number): void {
    if (this.toastT > 0) this.toastT -= dt;
    if (this.pwMsgT > 0) this.pwMsgT -= dt;
    if (this.copyMsgT > 0) this.copyMsgT -= dt;
    if (this.screen === "turn-scene") {
      this.turnT += dt;
      if (this.edge(["Space", "Enter"])) this.endTurnScene();
      else if (this.turnT >= 3) this.endTurnScene();
    } else if (this.screen === "play") {
      this.time += dt;
      this.updatePlay(dt);
    }
    this.pressed.clear();
  }

  private updatePlay(dt: number): void {
    const room = this.room;
    this.updateHero(dt);
    this.updateAttack(dt);
    this.updateBoss(dt);
    this.updateEnemies(dt);
    this.updateShots(dt);
    this.updateHazards(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updatePits(dt);
    this.checkTriggers(room);
    this.camX += (this.clampCam(this.hero.x + this.hero.w / 2 - W / 2 + this.hero.face * 40, room) - this.camX) * Math.min(1, dt * 8);
    if (this.shake > 0) this.shake -= dt;
    if (this.flashT > 0) this.flashT -= dt;
  }

  private locked(): boolean {
    return this.boss?.state === "intro" || this.hero.hurtT > 0 || this.bossEndT > 0;
  }

  // ---------------------------------------------------------------- hero

  private setHeroHeight(nh: number): boolean {
    const h = this.hero;
    if (nh === h.h) return true;
    const oldY = h.y;
    const oldH = h.h;
    h.y = oldY + oldH - nh;
    h.h = nh;
    if (nh > oldH && this.collides(h)) {
      h.y = oldY;
      h.h = oldH;
      return false;
    }
    return true;
  }

  private updateHero(dt: number): void {
    const h = this.hero;
    const rel = this.progress.relics;
    const info = HERO_INFO[this.progress.hero];
    h.invuln = Math.max(0, h.invuln - dt);
    h.hurtT = Math.max(0, h.hurtT - dt);
    h.comboT = Math.max(0, h.comboT - dt);
    h.dashCool = Math.max(0, h.dashCool - dt);
    h.coyote = Math.max(0, h.coyote - dt);
    h.jumpBuf = Math.max(0, h.jumpBuf - dt);
    h.dropT = Math.max(0, h.dropT - dt);
    h.mp = Math.min(this.stats.maxMp, h.mp + MP_REGEN * (1 + this.stats.int / 60) * dt);
    h.runT += dt;
    if (h.mistT > 0) h.mistT = Math.max(0, h.mistT - dt);
    if (h.dashT > 0) h.dashT = Math.max(0, h.dashT - dt);

    const locked = this.locked();
    const left = !locked && this.held(["ArrowLeft", "KeyA"]);
    const right = !locked && this.held(["ArrowRight", "KeyD"]);
    const up = this.held(["ArrowUp", "KeyW"]);
    const down = !locked && this.held(["ArrowDown", "KeyS"]);
    const jumpHeld = !locked && this.held(["Space"]);

    // Dash and mist.
    if (!locked && this.edge(["KeyZ", "ShiftLeft", "ShiftRight"]) && rel.dash && h.dashCool <= 0 && h.atkT <= 0 && h.mistT <= 0) {
      if (down && rel.mist && h.onGround) {
        h.mistT = MIST_TIME;
        h.dashCool = DASH_COOLDOWN;
        this.sound("dash");
      } else {
        h.dashT = DASH_TIME;
        h.dashCool = DASH_COOLDOWN;
        this.sound("dash");
      }
    }
    if (h.mistT <= 0 && this.collides(h)) h.mistT = 0.1;

    // Height: dash is low, crouch is low, otherwise standing (stays low under a low ceiling).
    const wantCrouch = (down && h.onGround && h.dashT <= 0 && h.mistT <= 0) || false;
    let desired = h.dashT > 0 ? DASH_H : wantCrouch ? CROUCH_H : HERO_H;
    if (!this.setHeroHeight(desired)) {
      desired = Math.min(h.h, CROUCH_H);
      this.setHeroHeight(desired);
    }
    h.crouch = h.h <= CROUCH_H && h.dashT <= 0;

    // Horizontal.
    if (h.dashT > 0) {
      h.vx = h.face * DASH_SPEED;
      h.vy = 0;
    } else if (h.hurtT > 0) {
      // knockback keeps vx
    } else if (h.crouch || locked) {
      h.vx = 0;
    } else {
      const sp = (h.mistT > 0 ? RUN_SPEED * 0.75 : RUN_SPEED) * (this.slowT > 0 ? 0.45 : 1);
      h.vx = ((right ? 1 : 0) - (left ? 1 : 0)) * sp;
      if (right && !left) h.face = 1;
      if (left && !right) h.face = -1;
    }

    // Jump, double jump, glide.
    if (!locked && this.edge(["Space"])) {
      if (down && h.onGround && this.onOneWay()) {
        h.dropT = 0.25;
        h.onGround = false;
        h.coyote = 0;
        h.jumpBuf = 0;
      } else {
        h.jumpBuf = 0.12;
      }
    }
    if (h.jumpBuf > 0 && h.mistT <= 0 && h.dashT <= 0) {
      if (h.onGround || h.coyote > 0) {
        h.vy = JUMP_V;
        h.onGround = false;
        h.coyote = 0;
        h.jumpBuf = 0;
        h.jumps = 1;
        this.sound("jump");
      } else if (rel.leap && h.jumps < 2 && h.jumps >= 1) {
        h.vy = JUMP_V * 0.92;
        h.jumps = 2;
        h.jumpBuf = 0;
        this.sound("jump");
        this.burst(h.x + h.w / 2, h.y + h.h, "#cfd8ff", 6);
      }
    }
    if (!jumpHeld && h.vy < JUMP_CUT_V && h.dashT <= 0) h.vy = JUMP_CUT_V;
    if (h.dashT <= 0) {
      h.vy = Math.min(MAX_FALL, h.vy + GRAVITY * dt);
      if (rel.glide && jumpHeld && h.vy > GLIDE_FALL && !h.onGround) h.vy = GLIDE_FALL;
    }

    // Move.
    const wasGround = h.onGround;
    const hitX = this.moveX(h, h.vx * dt);
    if (hitX && h.hurtT <= 0) h.vx = h.dashT > 0 ? 0 : h.vx;
    const res = this.moveY(h, h.vy * dt, h.dropT > 0);
    if (res === "down") {
      h.onGround = true;
      h.vy = 0;
      h.jumps = 0;
      h.coyote = 0.09;
    } else {
      if (res === "up") h.vy = 0;
      h.onGround = false;
      if (wasGround && h.vy >= 0) h.coyote = Math.max(h.coyote, 0.09);
    }
    if (h.hurtT > 0) h.vx *= 0.9;

    // Attack, special art, interact.
    if (!locked) {
      if (this.edge(["KeyX", "KeyJ"]) && h.atkT <= 0 && h.burstT <= 0 && h.dashT <= 0 && h.mistT <= 0) this.startAttack(up);
      if (this.edge(["KeyC", "KeyK"]) && h.atkT <= 0 && h.burstT <= 0 && h.dashT <= 0 && h.mistT <= 0) this.startSpecial(info.specialMp);
      if (this.edge(["ArrowUp", "KeyW"]) && !this.held(["KeyX", "KeyJ"]) && h.onGround && h.dashT <= 0) this.interact();
    }

    // Hazards: spikes and the abyss.
    if (h.y > H + 40 || this.touchesSpikes()) this.spikeHit();
    this.safeT += dt;
    if (h.onGround && this.safeT > 0.2 && h.invuln <= 0 && this.pits.length === 0) {
      const lc = Math.floor((h.x + 4) / TILE);
      const rc = Math.floor((h.x + h.w - 4) / TILE);
      const r = Math.floor((h.y + h.h + 2) / TILE);
      const room = this.room;
      const ok = (c: number) => ["#", "="].includes(this.tileChar(room, c, r));
      if (ok(lc) && ok(rc) && lc > 1 && rc < room.cols - 2) {
        this.lastSafe = { x: h.x, y: h.y };
        this.safeT = 0;
      }
    }

    // Room edges.
    const room = this.room;
    // Out-of-bounds counts as wall, so a room change fires when the hero touches the open edge.
    if (h.x <= 8 && room.left && this.edgeOpen(room, 0)) {
      this.enterRoom(room.left, this.rooms(room.left).cols * TILE - TILE * 1.3 - HERO_W, h.y);
    } else if (h.x + h.w >= room.cols * TILE - 8 && room.right && this.edgeOpen(room, room.cols - 1)) {
      this.enterRoom(room.right, TILE * 1.3, h.y);
    }
  }

  /** True when no tile of the edge column is solid at the hero's rows. */
  private edgeOpen(room: Room, col: number): boolean {
    const h = this.hero;
    const r0 = Math.floor(h.y / TILE);
    const r1 = Math.floor((h.y + h.h - 0.01) / TILE);
    for (let r = r0; r <= r1; r++) if (this.solidTile(room, col, r)) return false;
    return true;
  }

  private onOneWay(): boolean {
    const h = this.hero;
    const r = Math.floor((h.y + h.h + 2) / TILE);
    const c = Math.floor((h.x + h.w / 2) / TILE);
    return this.tileChar(this.room, c, r) === "=";
  }

  private touchesSpikes(): boolean {
    const h = this.hero;
    const room = this.room;
    const c0 = Math.floor((h.x + 6) / TILE);
    const c1 = Math.floor((h.x + h.w - 6) / TILE);
    const r0 = Math.floor((h.y + 6) / TILE);
    const r1 = Math.floor((h.y + h.h - 2) / TILE);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (this.tileChar(room, c, r) === "^") return true;
    return false;
  }

  private spikeHit(): void {
    const h = this.hero;
    if (h.invuln > 0 && h.y <= H + 40) return;
    this.hurtDirect(Math.ceil(this.stats.maxHp * 0.1));
    if (this.screen !== "play") return;
    h.x = this.lastSafe.x;
    h.y = this.lastSafe.y;
    h.vx = 0;
    h.vy = 0;
    h.invuln = HURT_INVULN;
  }

  private startAttack(up: boolean): void {
    const h = this.hero;
    const p = this.progress.hero;
    if (p === "frankford") {
      h.combo = h.comboT > 0 ? Math.min(3, h.combo + 1) : 1;
      h.comboT = 0.55;
      this.atkTotal = h.combo === 3 ? 0.28 : HERO_INFO.frankford.attackTime;
    } else {
      h.combo = 1;
      this.atkTotal = HERO_INFO.marcy.attackTime;
    }
    h.atkT = this.atkTotal;
    h.atkDir = up && !h.crouch ? "up" : "fwd";
    h.atkHit = new Set();
    this.sound(p === "marcy" ? "whip" : "slash");
  }

  private atkTotal = 0.3;

  private heroAtkType(): "whip" | "slash" | "crush" {
    if (this.progress.hero === "marcy") return "whip";
    return this.hero.combo === 3 ? "crush" : "slash";
  }

  private attackBox(burst = false): Rect {
    const h = this.hero;
    const info = HERO_INFO[this.progress.hero];
    const reach = (burst ? info.reach * 1.6 : info.reach) + (this.progress.hero === "frankford" && h.combo === 3 ? 18 : 0);
    if (h.atkDir === "up" && !burst) {
      return { x: h.x - 10, y: h.y - reach * 0.8, w: h.w + 20, h: reach * 0.8 + 14 };
    }
    const hh = this.progress.hero === "marcy" ? (burst ? 56 : 26) : 46;
    const y = h.crouch ? h.y + h.h * 0.2 : h.y + h.h * 0.18;
    const x = h.face > 0 ? h.x + h.w - 4 : h.x - reach + 4;
    return { x, y, w: reach, h: hh };
  }

  private updateAttack(dt: number): void {
    const h = this.hero;
    const tier = this.progress.equipment.weapon;
    if (h.atkT > 0) {
      const elapsed = this.atkTotal - h.atkT;
      const w0 = this.progress.hero === "marcy" ? 0.08 : 0.04;
      const w1 = this.progress.hero === "marcy" ? 0.24 : 0.15;
      if (elapsed >= w0 && elapsed <= w1) {
        this.hitWith(this.attackBox(), this.combo3Mult(), this.heroAtkType(), weaponElement(tier), h.atkHit);
      }
      h.atkT = Math.max(0, h.atkT - dt);
    }
    if (h.burstT > 0) {
      h.burstT = Math.max(0, h.burstT - dt);
      const phase = Math.floor((0.45 - h.burstT) / 0.15);
      if (phase !== this.burstPhase) {
        this.burstPhase = phase;
        h.atkHit = new Set();
      }
      h.atkDir = "fwd";
      this.hitWith(this.attackBox(true), 0.75, "whip", weaponElement(tier), h.atkHit);
    }
  }

  private burstPhase = -1;

  private combo3Mult(): number {
    return this.progress.hero === "frankford" && this.hero.combo === 3 ? 1.6 : 1;
  }

  private startSpecial(cost: number): void {
    const h = this.hero;
    if (h.mp < cost) {
      this.floatText("NO MP", h.x + h.w / 2, h.y - 8, "#7aa8ff");
      return;
    }
    h.mp -= cost;
    if (this.progress.hero === "marcy") {
      h.burstT = 0.45;
      this.burstPhase = -1;
      h.atkHit = new Set();
      this.sound("whip");
    } else {
      this.shots.push({
        x: h.face > 0 ? h.x + h.w : h.x - 40, y: h.y + 4, w: 40, h: 52, vx: h.face * 430, vy: 0, kind: "hero-wave",
        dmg: this.stats.atk * 1.4, fromHero: true, life: 0.9, homing: false, pierce: true, hit: new Set(), gravity: 0,
        element: weaponElement(this.progress.equipment.weapon), atkType: "slash", color: "#b8d8ff",
      });
      this.sound("slash");
    }
  }

  /** Applies a hero attack box to enemies, the boss, breakables and sigil walls. */
  private hitWith(box: Rect, mult: number, type: "whip" | "slash" | "crush", element: Element, hitSet: Set<object>): void {
    for (const e of this.enemies.slice()) {
      if (hitSet.has(e) || !rectsOverlap(box, e)) continue;
      hitSet.add(e);
      this.damageEnemy(e, mult, type, element);
    }
    const b = this.boss;
    if (b && b.state !== "dead" && b.state !== "intro" && !hitSet.has(b) && rectsOverlap(box, { x: b.x, y: b.y, w: b.w, h: b.h })) {
      hitSet.add(b);
      this.damageBoss(b, mult, type, element);
    }
    for (const br of this.breakables) {
      if (br.alive && !hitSet.has(br) && rectsOverlap(box, br)) {
        hitSet.add(br);
        this.breakBreakable(br);
      }
    }
    if (this.progress.relics.sigil) {
      const room = this.room;
      const c0 = Math.floor(box.x / TILE);
      const c1 = Math.floor((box.x + box.w) / TILE);
      const r0 = Math.floor(box.y / TILE);
      const r1 = Math.floor((box.y + box.h) / TILE);
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          if (this.tileChar(room, c, r) === "S" && !this.brokenTiles.has(`${room.id}:${c}:${r}`)) {
            // Break the whole column of this sigil wall.
            for (let rr = 0; rr < room.tiles.length; rr++) if (room.tiles[rr][c] === "S") this.brokenTiles.add(`${room.id}:${c}:${rr}`);
            this.burst(c * TILE + 24, r * TILE + 24, "#b88ae0", 14);
            this.sound("hit");
            this.shake = 0.2;
          }
        }
      }
    }
  }

  private critRoll(): boolean {
    return this.rng() < Math.min(0.25, this.stats.lck * 0.004);
  }

  /** Damage the hero deals: attack times the move multiplier, with a small LCK crit. */
  private heroDamage(mult: number, defense: number): { dmg: number; crit: boolean } {
    const crit = this.critRoll();
    const base = this.stats.atk * mult * (crit ? 1.5 : 1);
    return { dmg: damage(base, defense), crit };
  }

  // ---------------------------------------------------------------- hero damage and death

  private hurtHero(amount: number, from?: { x: number }): void {
    const h = this.hero;
    if (this.over || h.invuln > 0 || h.mistT > 0 || this.screen !== "play") return;
    const dmg = Math.max(1, Math.round((amount * 100) / (100 + this.stats.def)));
    h.hp -= dmg;
    h.invuln = HURT_INVULN;
    h.hurtT = 0.22;
    const dir = from ? (from.x < h.x + h.w / 2 ? 1 : -1) : -h.face;
    h.vx = dir * 200;
    h.vy = -280;
    h.onGround = false;
    h.atkT = 0;
    h.burstT = 0;
    this.shake = 0.18;
    this.hudFlashT = 0.3;
    this.floatText(String(dmg), h.x + h.w / 2, h.y - 6, "#ff6a7a");
    this.sound("hit");
    if (h.hp <= 0) this.killHero();
  }

  private hurtDirect(n: number): void {
    if (this.over) return;
    const h = this.hero;
    h.hp -= n;
    h.invuln = HURT_INVULN;
    this.floatText(String(n), h.x + h.w / 2, h.y - 6, "#ff6a7a");
    this.sound("hit");
    this.shake = 0.18;
    if (h.hp <= 0) this.killHero();
  }

  private killHero(): void {
    if (this.over || this.screen !== "play") return;
    this.lives--;
    this.emitLives();
    this.cb.onHaptic?.("death");
    this.sound("death");
    if (this.lives <= 0) {
      this.sound("gameover");
      this.finish();
      return;
    }
    this.respawnHero();
  }

  private respawnHero(): void {
    const h = this.hero;
    h.hp = this.stats.maxHp;
    h.mp = this.stats.maxMp;
    h.invuln = 1.5;
    h.hurtT = 0;
    h.mistT = 0;
    const room = this.room;
    const inBossFight = !!room.boss && this.bossStarted && !this.bossDefeated(room);
    this.setBossMusic(false);
    if (inBossFight) {
      // Boss room: back to the room door, boss at full HP, gate open again.
      this.enterRoom(room.id, 2 * TILE, null);
    } else {
      this.enterRoom(this.respawn.room, this.respawn.x, null);
    }
    this.hero.invuln = 1.5;
  }

  // ---------------------------------------------------------------- interaction

  private interact(): void {
    const h = this.hero;
    const room = this.room;
    const cx = h.x + h.w / 2;
    // Altar
    if (room.altarCol !== null && Math.abs(cx - (room.altarCol * TILE + TILE / 2)) < 56) {
      h.hp = this.stats.maxHp;
      h.mp = this.stats.maxMp;
      this.respawn = { room: room.id, x: room.altarCol * TILE };
      const z = room.zone;
      if (room.castle === "main") this.progress.mapped[z] = true;
      else if (z < 8) this.progress.turned.mapped[z] = true;
      this.sound("save");
      this.openAltarScreen("play");
      return;
    }
    // Door
    const door = room.doors.find((d) => Math.abs(cx - (d.col * TILE + TILE / 2)) < 44);
    if (door) {
      if (door.needsTurned && !door.needsTurned.every((i) => this.progress.turned.bosses[i])) {
        this.setToast("SEALED UNTIL THE TURNED BOSSES FALL");
        return;
      }
      this.sound("select");
      this.enterRoom(door.to, door.toCol * TILE + (TILE - HERO_W) / 2, null);
      return;
    }
    // Chest
    for (const ch of this.chests) {
      if (!ch.open && Math.abs(cx - (ch.x + ch.w / 2)) < 60) {
        this.openChest(ch);
        return;
      }
    }
  }

  private openChest(ch: Chest): void {
    ch.open = true;
    this.opened.add(ch.key);
    const slot = SLOTS[hashString(ch.key) % SLOTS.length];
    this.addScore(100);
    this.sound("pickup");
    this.equipTier(slot, ch.tier, true);
    this.rollCoin(ch.x + ch.w / 2, ch.y);
  }

  /** Equips a tier if it is better than what is worn (strict upgrade). Returns true when equipped. */
  private equipTier(slot: Slot, tier: number, fromChest: boolean): boolean {
    const cur = this.progress.equipment[slot];
    const cap = this.progress.bosses[8] ? 15 : 10;
    const t = Math.min(cap, tier);
    if (t <= cur) {
      if (fromChest) {
        this.hero.hp = Math.min(this.stats.maxHp, this.hero.hp + this.stats.maxHp * 0.3);
        this.hero.mp = Math.min(this.stats.maxMp, this.hero.mp + this.stats.maxMp * 0.3);
        this.setToast("EMPTY CHEST: HP AND MP RESTORED", null);
      }
      return false;
    }
    this.progress.equipment[slot] = t;
    const prevMax = this.stats.maxHp;
    this.stats = computeStats(this.progress);
    this.hero.hp += Math.max(0, this.stats.maxHp - prevMax);
    this.setToast(`${SLOT_LABEL[slot]}: ${itemName(slot, t, this.progress.hero)}`, null);
    return true;
  }

  // ---------------------------------------------------------------- triggers

  private checkTriggers(room: Room): void {
    const h = this.hero;
    // Crests
    for (const c of this.crests) {
      if (c.taken || !rectsOverlap(h, c)) continue;
      c.taken = true;
      const m = /^crest:(main|turned):(\d+)$/.exec(c.key);
      if (m) {
        const i = parseInt(m[2], 10);
        if (m[1] === "main") this.progress.crests[i] = true;
        else this.progress.turned.crests[i] = true;
      }
      this.stats = computeStats(this.progress);
      h.hp = this.stats.maxHp;
      h.mp = this.stats.maxMp;
      this.addScore(100);
      this.sound("relic");
      this.setToast("VITALITY CREST: MAX HP UP", null);
      this.burst(c.x + 18, c.y + 18, "#ff6a8a", 16);
    }
    // Boss trigger
    if (this.boss && !this.bossStarted && h.x > 3 * TILE && h.x + h.w < room.cols * TILE - TILE) this.activateBoss();
    void room;
  }

  // ---------------------------------------------------------------- effects

  private burst(x: number, y: number, color: string, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2;
      const s = 60 + this.rng() * 160;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: 0.5, max: 0.5, color, size: 3 + Math.floor(this.rng() * 3) });
    }
  }

  private floatText(text: string, x: number, y: number, color: string): void {
    this.floats.push({ text, x, y, t: 0.9, color });
    if (this.floats.length > 24) this.floats.shift();
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 500 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floats) {
      f.t -= dt;
      f.y -= 30 * dt;
    }
    this.floats = this.floats.filter((f) => f.t > 0);
  }

  // ---------------------------------------------------------------- turn scene

  private startTurnScene(): void {
    this.turnT = 0;
    this.screen = "turn-scene";
    this.sound("turn");
  }

  private endTurnScene(): void {
    // Start at the altar of Turned zone 1 (T1).
    this.castle = "turned";
    const zd = this.turned.zones[0];
    const room = this.rooms(zd.altarRoom);
    this.respawn = { room: zd.altarRoom, x: (room.altarCol ?? 8) * TILE };
    this.progress.turned.mapped[0] = true;
    this.hero.hp = this.stats.maxHp;
    this.hero.mp = this.stats.maxMp;
    this.setBossMusic(false);
    this.enterRoom(zd.altarRoom, this.respawn.x, null);
    this.screen = "play";
    this.keys.clear();
  }

  private victoryKey(up: boolean, down: boolean, ok: boolean): void {
    const n = 3;
    if (up) { this.victoryCursor = (this.victoryCursor + n - 1) % n; this.sound("select"); }
    if (down) { this.victoryCursor = (this.victoryCursor + 1) % n; this.sound("select"); }
    if (!ok) return;
    if (this.victoryCursor === 1) { this.copyPassword(); return; }
    this.sound("select");
    if (this.victoryCursor === 0) this.startTurnScene();
    else this.finish();
  }

  // ---------------------------------------------------------------- enemies

  private spawnEnemy(def: EnemyDef, col: number, row: number, scale = 1, offsetX = 0): Enemy {
    const rows = planRows(def.plan, 0);
    const sc = ENEMY_PLAN_SCALE * scale;
    const w = rows[0].length * sc;
    const hgt = rows.length * sc;
    const x = col * TILE + (TILE - w) / 2 + offsetX;
    let y = (row + 1) * TILE - hgt;
    if (def.ai === "flyer") y = Math.max(TILE * 1.2, (row - 3) * TILE);
    const e: Enemy = {
      def, x, y, w, h: hgt, vx: 0, vy: 0, hp: def.hp, maxHp: def.hp, dir: this.rng() < 0.5 ? 1 : -1,
      t: this.rng() * 2, state: "idle", baseY: y, hitFlash: 0, stun: 0, scale, grounded: false, homeX: x,
    };
    this.enemies.push(e);
    return e;
  }

  private groundPx(x: number, y: number): boolean {
    const c = Math.floor(x / TILE);
    const r = Math.floor(y / TILE);
    const ch = this.tileChar(this.room, c, r);
    return ch === "#" || ch === "=" || ch === "S" || ch === "H" || ch === "G" || ch === "K";
  }

  private updateEnemies(dt: number): void {
    const h = this.hero;
    const hx = h.x + h.w / 2;
    const hy = h.y + h.h / 2;
    for (const e of this.enemies.slice()) {
      const def = e.def;
      if (Math.abs(e.x + e.w / 2 - (this.camX + W / 2)) > W * 0.95) continue;
      e.t += dt;
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      const ex = e.x + e.w / 2;
      const dx = hx - ex;
      const dy = hy - (e.y + e.h / 2);
      if (e.stun > 0) {
        e.stun -= dt;
        if (def.ai !== "flyer") {
          e.vy = Math.min(MAX_FALL, e.vy + GRAVITY * dt);
          this.moveY(e, e.vy * dt);
        }
        this.moveX(e, e.vx * dt);
        e.vx *= 0.88;
        continue;
      }
      switch (def.ai) {
        case "walker":
        case "crawler": {
          e.vy = Math.min(MAX_FALL, e.vy + GRAVITY * dt);
          const res = this.moveY(e, e.vy * dt);
          e.grounded = res === "down";
          if (res === "down") e.vy = 0;
          const chase = Math.abs(dx) < 220 && Math.abs(dy) < 90;
          if (chase && def.ai === "crawler") e.dir = dx >= 0 ? 1 : -1;
          e.vx = e.dir * def.speed * (chase ? 1.25 : 1);
          const hitW = this.moveX(e, e.vx * dt);
          const ahead = e.x + (e.dir > 0 ? e.w + 4 : -4);
          if (hitW || (e.grounded && !this.groundPx(ahead, e.y + e.h + 6))) e.dir = e.dir === 1 ? -1 : 1;
          if (def.shot !== "none" && e.t > 2.6 && Math.abs(dx) < 420 && Math.abs(dy) < 160) { e.t = 0; this.fireEnemy(e, def.shot); }
          break;
        }
        case "jumper": {
          e.vy = Math.min(MAX_FALL, e.vy + GRAVITY * dt);
          const res = this.moveY(e, e.vy * dt);
          if (res === "down") {
            e.vy = 0;
            if (e.state === "leap") {
              e.state = "idle";
              e.t = 0;
              e.vx = 0;
              if (def.shot !== "none") this.fireEnemy(e, def.shot);
            }
          }
          e.dir = dx >= 0 ? 1 : -1;
          if (e.state === "idle" && e.t > 1.3 && Math.abs(dx) < 420 && res === "down") {
            e.state = "leap";
            e.vy = -640;
            e.vx = e.dir * def.speed * 3;
          }
          if (this.moveX(e, e.vx * dt)) e.vx = 0;
          break;
        }
        case "charger": {
          e.vy = Math.min(MAX_FALL, e.vy + GRAVITY * dt);
          const res = this.moveY(e, e.vy * dt);
          e.grounded = res === "down";
          if (res === "down") e.vy = 0;
          if (e.state === "idle") {
            e.vx = e.dir * def.speed * 0.5;
            const hitW = this.moveX(e, e.vx * dt);
            const ahead = e.x + (e.dir > 0 ? e.w + 4 : -4);
            if (hitW || (e.grounded && !this.groundPx(ahead, e.y + e.h + 6))) e.dir = e.dir === 1 ? -1 : 1;
            if (Math.abs(dx) < 300 && Math.abs(dy) < 100 && e.t > 1) { e.state = "windup"; e.t = 0; e.dir = dx >= 0 ? 1 : -1; }
          } else if (e.state === "windup") {
            if (e.t > 0.45) { e.state = "charge"; e.t = 0; }
          } else if (e.state === "charge") {
            e.vx = e.dir * def.speed * 3.4;
            const hitW = this.moveX(e, e.vx * dt);
            if (hitW || e.t > 0.8) { e.state = "stun"; e.t = 0; e.vx = 0; if (hitW) this.shake = 0.12; }
          } else if (e.state === "stun") {
            if (e.t > 0.7) { e.state = "idle"; e.t = 0; }
          }
          break;
        }
        case "flyer": {
          if (def.wave) {
            // Medusa Head: straight flight with a big vertical sine wave.
            e.vx = e.dir * def.speed;
            const hitW = this.moveX(e, e.vx * dt);
            if (hitW) e.dir = e.dir === 1 ? -1 : 1;
            else if (Math.abs(e.x - e.homeX) > 300) e.dir = e.x > e.homeX ? -1 : 1;
            const oldY = e.y;
            e.y = Math.max(TILE * 1.1, Math.min(FLOOR_ROW * TILE - e.h - 10, e.baseY + Math.sin(e.t * 3) * 70));
            if (this.collides(e)) e.y = oldY;
            break;
          }
          if (def.dive && e.state === "leap") {
            const tx = hx - ex;
            const ty = hy - (e.y + e.h / 2);
            const len = Math.hypot(tx, ty) || 1;
            this.moveX(e, (tx / len) * def.speed * 3.6 * dt);
            e.y += (ty / len) * def.speed * 3.6 * dt;
            if (e.t > 0.8) { e.state = "idle"; e.t = 0; e.baseY = Math.max(TILE * 1.4, e.y - TILE * 2); }
          } else {
            if (def.dive && e.t > 3 && Math.abs(dx) < 380) { e.state = "leap"; e.t = 0; }
            const near = Math.abs(dx) < 420;
            const chaseVx = def.homing || near ? Math.sign(dx) * def.speed : e.dir * def.speed * 0.7;
            e.vx += (chaseVx - e.vx) * Math.min(1, dt * 3);
            if (def.homing && near) e.baseY += (hy - 40 - e.baseY) * Math.min(1, dt * 0.9);
            if (!near && Math.abs(e.x - e.homeX) > 170) e.dir = e.x > e.homeX ? -1 : 1;
            const hit = this.moveX(e, e.vx * dt);
            if (hit) { e.vx = -e.vx; e.dir = e.dir === 1 ? -1 : 1; }
            const oldY = e.y;
            e.y = Math.max(TILE * 1.1, e.baseY + Math.sin(e.t * 2.4) * 18);
            if (this.collides(e)) e.y = oldY;
            if ((def.shot === "lob" || def.shot === "zone") && e.t > 3 && near) { e.t = 0; this.fireEnemy(e, def.shot); }
          }
          break;
        }
        case "shooter": {
          e.dir = dx >= 0 ? 1 : -1;
          e.vy = Math.min(MAX_FALL, e.vy + GRAVITY * dt);
          if (this.moveY(e, e.vy * dt) === "down") e.vy = 0;
          if (e.t > 2.4 && Math.abs(dx) < 520 && Math.abs(dy) < 280) {
            e.t = 0;
            this.fireEnemy(e, def.shot === "none" ? "bolt" : def.shot);
          }
          break;
        }
      }
      if (rectsOverlap(h, e)) this.hurtHero(def.dmg, e);
    }
  }

  private makeShot(x: number, y: number, vx: number, vy: number, kind: ShotKind, dmg: number, color: string, extra: Partial<Shot> = {}): Shot {
    const size: Record<ShotKind, [number, number]> = {
      bolt: [14, 14], orb: [22, 22], lob: [18, 18], rain: [12, 28], wave: [40, 30], slash: [110, 80], "hero-slash": [60, 40], "hero-wave": [40, 52],
    };
    const [w, hgt] = size[kind];
    const s: Shot = {
      x: x - w / 2, y: y - hgt / 2, w, h: hgt, vx, vy, kind, dmg, fromHero: false, life: 4, homing: false, pierce: false,
      hit: new Set(), gravity: 0, element: "none", atkType: "slash", color, ...extra,
    };
    this.shots.push(s);
    return s;
  }

  private fireEnemy(e: Enemy, kind: EnemyDef["shot"]): void {
    const h = this.hero;
    const sx = e.x + e.w / 2;
    const sy = e.y + e.h * 0.35;
    const tx = h.x + h.w / 2;
    const ty = h.y + h.h / 2;
    const dmg = e.def.dmg * 0.8;
    const color = e.def.a;
    const ang = Math.atan2(ty - sy, tx - sx);
    const aim = (a: number, speed: number) => this.makeShot(sx, sy, Math.cos(a) * speed, Math.sin(a) * speed, "bolt", dmg, color, { life: 3 });
    switch (kind) {
      case "bolt": aim(ang, 250); break;
      case "spread3": for (const o of [-0.3, 0, 0.3]) aim(ang + o, 240); break;
      case "spread5": for (const o of [-0.55, -0.27, 0, 0.27, 0.55]) aim(ang + o, 230); break;
      case "lob": {
        const t = 0.95;
        this.makeShot(sx, sy, (tx - sx) / t, (ty - sy) / t - 0.5 * 900 * t, "lob", dmg, color, { gravity: 900, life: 3 });
        break;
      }
      case "homing": this.makeShot(sx, sy, Math.cos(ang) * 120, Math.sin(ang) * 120, "orb", dmg, color, { homing: true, life: 4.5 }); break;
      case "zone": {
        const gy = this.floorUnder(tx, h.y + h.h);
        this.hazards.push({ x: tx - 34, y: gy - 44, w: 68, h: 44, life: 1.5, delay: 0.75, dmg: e.def.dmg, color: e.def.b === "#3a6a2a" ? "#5aa23a" : e.def.a, slow: e.def.id === "rootgrabber" });
        break;
      }
      default: break;
    }
  }

  /** Top of the first solid tile at or below `y` under pixel column `x`. */
  private floorUnder(x: number, y: number): number {
    const c = Math.floor(x / TILE);
    for (let r = Math.max(0, Math.floor(y / TILE)); r < FLOOR_ROW + 1; r++) {
      const ch = this.tileChar(this.room, c, r);
      if (ch === "#" || ch === "=") return r * TILE;
    }
    return FLOOR_ROW * TILE;
  }

  private damageEnemy(e: Enemy, mult: number, type: "whip" | "slash" | "crush", element: Element): void {
    void type;
    void element;
    const { dmg, crit } = this.heroDamage(mult, 0);
    e.hp -= dmg;
    e.hitFlash = 0.12;
    e.stun = 0.12;
    e.vx = this.hero.face * 150;
    this.floatText(crit ? `${dmg}!` : String(dmg), e.x + e.w / 2, e.y, crit ? "#ffd36a" : "#ffffff");
    this.sound("hit");
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy): void {
    this.enemies = this.enemies.filter((o) => o !== e);
    const def = e.def;
    this.addScore(def.xp * 10);
    this.gainXp(def.xp);
    this.sound("enemyDie");
    this.burst(e.x + e.w / 2, e.y + e.h / 2, def.a, 10);
    if (def.split) {
      for (const off of [-24, 24]) {
        const kid = this.spawnEnemy({ ...def, id: "marrowling", name: "Marrowling", hp: Math.round(def.hp * 0.3), dmg: Math.round(def.dmg * 0.7), xp: Math.round(def.xp * 0.3), split: false }, Math.floor((e.x + e.w / 2) / TILE), Math.floor((e.y + e.h - 1) / TILE), 0.6, off);
        kid.stun = 0.2;
      }
    }
    this.dropFrom(e.x + e.w / 2, e.y + e.h / 2);
  }

  private breakBreakable(b: Breakable): void {
    b.alive = false;
    this.brokenBreakables.add(b.key);
    this.breakables = this.breakables.filter((o) => o !== b);
    const room = this.room;
    this.sound("hit");
    this.burst(b.x + b.w / 2, b.y + b.h / 2, this.palette(room).glow, 8);
    const r = this.rng();
    const x = b.x + b.w / 2 - 11;
    const y = b.y;
    if (r < 0.4) this.spawnPickup("hp", x, y);
    else if (r < 0.7) this.spawnPickup("mp", x, y);
    else if (r < 0.9) this.spawnPickup("xp", x, y, { value: 6 + room.zone * 3 });
    this.rollCoin(b.x + b.w / 2, b.y);
  }

  private dropFrom(x: number, y: number): void {
    const room = this.room;
    const r = this.rng();
    if (r < 0.14) this.spawnPickup("hp", x - 11, y);
    else if (r < 0.24) this.spawnPickup("mp", x - 11, y);
    if (this.rng() < GEAR_CHANCE + this.stats.lck * 0.0004) {
      const slot = SLOTS[Math.floor(this.rng() * SLOTS.length)];
      const tier = room.castle === "main" ? mainTier(room.zone + 1, this.rng()) : Math.min(15, 11 + Math.floor(this.rng() * Math.min(5, room.zone / 2 + 1.5)));
      this.spawnPickup("gear", x - 11, y, { slot, tier });
    }
    if (this.rng() < ONE_UP_CHANCE) this.spawnPickup("life", x - 11, y);
    this.rollCoin(x, y);
  }

  /** One Credit Coin roll per drop opportunity (SPEC 23). Only for signed-in players. */
  private rollCoin(x: number, y: number): void {
    if (this.cb.canDropCredit?.() !== true) return;
    if (rollCreditDrop()) this.spawnPickup("coin", x - 12, y);
  }

  private gainXp(n: number): void {
    this.xp += n;
    const cap = this.progress.bosses[8] ? MAX_LEVEL : MAX_LEVEL_MAIN;
    while (this.progress.level < cap && this.xp >= xpToNext(this.progress.level)) {
      this.xp -= xpToNext(this.progress.level);
      this.progress.level++;
      this.stats = computeStats(this.progress);
      this.hero.hp = this.stats.maxHp;
      this.hero.mp = this.stats.maxMp;
      this.sound("levelUp");
      this.floatText("LEVEL UP", this.hero.x + this.hero.w / 2, this.hero.y - 20, "#ffe27a");
      this.emitLevel();
    }
    if (this.progress.level >= cap) this.xp = Math.min(this.xp, xpToNext(cap) - 1);
  }

  // ---------------------------------------------------------------- boss

  private makeBoss(def: BossDef, px: number, room: Room): Boss {
    const rows = bossRows(def.plan);
    const w = rows[0].length * BOSS_PLAN_SCALE;
    const hgt = rows.length * BOSS_PLAN_SCALE;
    const floater = def.plan === "floater";
    const homeY = floater ? TILE * 3.1 : FLOOR_ROW * TILE - hgt;
    void room;
    return {
      def, x: px - w / 2, y: homeY, w, h: hgt, vx: 0, vy: 0, hp: def.hp, maxHp: def.hp, shown: 0, face: -1,
      state: "idle", pat: null, lastPat: null, t: 0, actT: 0, phase: 1, hitFlash: 0, onGround: !floater, homeY,
      tickT: 0, fireT: 0, volley: 0, flash: 0,
    };
  }

  private activateBoss(): void {
    const b = this.boss;
    if (!b) return;
    this.bossStarted = true;
    b.state = "intro";
    b.t = 0;
    b.shown = 0;
    b.tickT = 0;
    const room = this.room;
    if (room.castle === "main") this.progress.mapped[room.zone] = true;
    else if (room.zone < 8) this.progress.turned.mapped[room.zone] = true;
    this.setBossMusic(true);
    this.enemies = [];
    this.shots = [];
    this.hero.invuln = Math.max(this.hero.invuln, 1.6);
  }

  private patternList(b: Boss): BossPattern[] {
    return b.phase >= 2 && b.def.patterns2 ? [...b.def.patterns, ...b.def.patterns2] : b.def.patterns;
  }

  private updateBoss(dt: number): void {
    const b = this.boss;
    if (!b) return;
    if (b.state === "dead") {
      this.bossEndT -= dt;
      if (this.rng() < 0.5) this.burst(b.x + this.rng() * b.w, b.y + this.rng() * b.h, b.def.a, 3);
      if (this.bossEndT <= 0) this.afterBoss(b);
      return;
    }
    if (!this.bossStarted) return;
    const h = this.hero;
    b.hitFlash = Math.max(0, b.hitFlash - dt);
    b.flash = Math.max(0, b.flash - dt);
    const bcx = b.x + b.w / 2;
    const dx = h.x + h.w / 2 - bcx;
    const floater = b.def.plan === "floater";
    const sp = b.def.speed * (1 + 0.12 * (b.phase - 1));

    if (b.state === "intro") {
      b.t += dt;
      b.tickT -= dt;
      if (b.shown < b.maxHp) {
        b.shown = Math.min(b.maxHp, b.shown + (b.maxHp * dt) / 1.3);
        if (b.tickT <= 0) { b.tickT = 0.1; this.sound("bossTick"); }
      }
      if (b.t >= 1.5) { b.state = "idle"; b.t = 0.5; b.shown = b.maxHp; }
      return;
    }

    // Gravity for ground bosses.
    if (!floater) {
      b.vy = Math.min(MAX_FALL, b.vy + GRAVITY * dt);
      const res = this.moveY(b, b.vy * dt);
      if (res === "down") { b.vy = 0; b.onGround = true; } else b.onGround = false;
    } else if (b.state !== "act" || b.pat !== "dive") {
      const ty = b.homeY + Math.sin(this.time * 1.8) * 14;
      b.y += (ty - b.y) * Math.min(1, dt * 3);
    }

    switch (b.state) {
      case "idle": {
        if (b.state === "idle") b.face = dx >= 0 ? 1 : -1;
        b.t -= dt;
        if (b.t <= 0) {
          const list = this.patternList(b).filter((p) => p !== b.lastPat);
          const pool = list.length > 0 ? list : this.patternList(b);
          b.pat = pool[Math.floor(this.rng() * pool.length)];
          b.lastPat = b.pat;
          b.state = "tel";
          b.t = b.pat === "charge" ? 0.6 : 0.45;
          b.flash = b.t;
        }
        break;
      }
      case "tel": {
        b.t -= dt;
        b.vx = 0;
        if (b.t <= 0) this.beginAct(b, dx, floater);
        break;
      }
      case "act": this.runAct(b, dt, dx, sp, floater); break;
      case "recover": {
        b.t -= dt;
        b.vx = 0;
        if (b.t <= 0) { b.state = "idle"; b.t = Math.max(0.25, 0.7 - b.phase * 0.12); }
        break;
      }
    }
    this.moveBossX(b, dt);
    if (rectsOverlap(h, { x: b.x + 6, y: b.y + 6, w: b.w - 12, h: b.h - 8 })) this.hurtHero(b.def.dmg * 0.6, { x: bcx });
  }

  private moveBossX(b: Boss, dt: number): void {
    if (b.vx === 0) return;
    const hit = this.moveX(b, b.vx * dt);
    if (hit) {
      if (b.pat === "charge" && b.state === "act") { b.actT = 0; this.shake = 0.25; this.sound("hit"); }
      b.vx = 0;
    }
  }

  private beginAct(b: Boss, dx: number, floater: boolean): void {
    const room = this.room;
    const pat = b.pat ?? "slash-walk";
    b.state = "act";
    b.fireT = 0;
    b.volley = 0;
    b.face = dx >= 0 ? 1 : -1;
    switch (pat) {
      case "slash-walk": b.actT = 1.5; break;
      case "charge": b.actT = 1.1; b.vx = b.face * b.def.speed * 3.2; break;
      case "slam": b.actT = 3; b.vy = -820; b.vx = Math.max(-280, Math.min(280, dx)) / 0.85; b.onGround = false; break;
      case "bolt-spread": b.actT = 1.1; break;
      case "hover-bolts": b.actT = 2.4; break;
      case "dive":
        if (floater) { b.actT = 0.9; b.vx = 0; this.diveTarget = { x: this.hero.x + this.hero.w / 2, y: this.hero.y + this.hero.h / 2 }; }
        else { b.pat = "slam"; b.actT = 3; b.vy = -820; b.vx = Math.max(-280, Math.min(280, dx)) / 0.85; b.onGround = false; }
        break;
      case "rain": b.actT = 2.4; break;
      case "homing": {
        b.actT = 0.6;
        const bx = b.x + b.w / 2;
        const by = b.y + b.h * 0.35;
        for (const off of [-0.5, 0.5]) {
          const a = Math.atan2(this.hero.y - by, this.hero.x - bx) + off;
          this.makeShot(bx, by, Math.cos(a) * 130, Math.sin(a) * 130, "orb", b.def.dmg * 0.7, b.def.a, { homing: true, life: 5 });
        }
        break;
      }
      case "summon": {
        b.actT = 0.7;
        const zd = this.zoneOf(room);
        if (this.enemies.length < 3) {
          for (const off of [3, room.cols - 4]) {
            const id = zd.enemies[Math.floor(this.rng() * zd.enemies.length)];
            if (ENEMIES[id]) this.spawnEnemy(ENEMIES[id], off, FLOOR_ROW - 1);
          }
        }
        break;
      }
    }
  }

  private diveTarget = { x: 0, y: 0 };

  private runAct(b: Boss, dt: number, dx: number, sp: number, floater: boolean): void {
    const room = this.room;
    const h = this.hero;
    b.actT -= dt;
    b.fireT -= dt;
    const bx = b.x + b.w / 2;
    const by = b.y + b.h * 0.4;
    const aimAng = Math.atan2(h.y + h.h / 2 - by, h.x + h.w / 2 - bx);
    const many = b.phase >= 2 || b.def.turned;
    switch (b.pat) {
      case "slash-walk": {
        b.face = dx >= 0 ? 1 : -1;
        b.vx = Math.abs(dx) > 90 ? b.face * sp : 0;
        if (Math.abs(dx) < 130 && b.fireT <= 0) {
          b.fireT = 0.65;
          this.makeShot(bx + b.face * (b.w / 2 + 30), b.y + b.h * 0.55, 0, 0, "slash", b.def.dmg, b.def.a, { life: 0.18, pierce: true });
          this.sound("slash");
        }
        break;
      }
      case "charge": break;
      case "slam": {
        if (b.onGround && b.vy === 0 && b.actT < 2.75) {
          b.actT = 0;
          b.vx = 0;
          this.shake = 0.3;
          this.sound("hit");
          for (const d of [-1, 1]) this.makeShot(b.x + b.w / 2, b.y + b.h - 18, d * 300, 0, "wave", b.def.dmg * 0.8, b.def.a, { life: 1.7, pierce: true });
        }
        break;
      }
      case "bolt-spread": {
        if (b.fireT <= 0 && b.volley < 2) {
          b.fireT = 0.5;
          b.volley++;
          const offs = many ? [-0.5, -0.25, 0, 0.25, 0.5] : [-0.28, 0, 0.28];
          for (const o of offs) this.makeShot(bx, by, Math.cos(aimAng + o) * 260, Math.sin(aimAng + o) * 260, "bolt", b.def.dmg * 0.7, b.def.a, { life: 3 });
        }
        break;
      }
      case "hover-bolts": {
        b.vx = Math.abs(dx) > 120 ? Math.sign(dx) * sp * 0.7 : 0;
        if (b.fireT <= 0) {
          b.fireT = many ? 0.45 : 0.6;
          this.makeShot(bx, by, Math.cos(aimAng) * 270, Math.sin(aimAng) * 270, "bolt", b.def.dmg * 0.7, b.def.a, { life: 3 });
        }
        break;
      }
      case "dive": {
        if (floater) {
          const tx = this.diveTarget.x - bx;
          const ty = this.diveTarget.y - (b.y + b.h / 2);
          const len = Math.hypot(tx, ty) || 1;
          const s = 430 * dt;
          if (len > 12) {
            this.moveX(b, (tx / len) * s);
            b.y += (ty / len) * s;
          }
        }
        break;
      }
      case "rain": {
        if (b.fireT <= 0) {
          b.fireT = 0.2;
          const x = this.rng() < 0.35 ? h.x + h.w / 2 : TILE * 2 + this.rng() * (room.cols * TILE - TILE * 4);
          this.makeShot(x, TILE + 10, 0, 340, "rain", b.def.dmg * 0.6, b.def.a, { life: 3 });
        }
        break;
      }
      default: break;
    }
    if (b.actT <= 0) {
      b.state = "recover";
      b.t = 0.45;
      b.vx = 0;
      if (floater) b.pat = null;
    }
  }

  private damageBoss(b: Boss, mult: number, type: "whip" | "slash" | "crush", element: Element, direct?: number): void {
    const def = b.def;
    const weak = def.weak === type || (element !== "none" && def.weak === element);
    const defense = (def.index + 1) * 2 + (def.turned ? 20 : 0);
    const { dmg: base, crit } = direct !== undefined ? { dmg: direct, crit: false } : this.heroDamage(mult, defense);
    const dmg = Math.max(1, Math.round(base * (weak ? 1.5 : 1)));
    b.hp -= dmg;
    b.hitFlash = 0.1;
    this.floatText(weak ? `${dmg} WEAK` : crit ? `${dmg}!` : String(dmg), b.x + b.w / 2, b.y - 6, weak ? "#7affb0" : crit ? "#ffd36a" : "#ffffff");
    this.sound("bossHit");
    // Phases
    if (def.phases >= 2) {
      const ratio = b.hp / b.maxHp;
      const want = def.phases === 2 ? (ratio <= 0.5 ? 2 : 1) : ratio <= 0.34 ? 3 : ratio <= 0.67 ? 2 : 1;
      if (want > b.phase && b.hp > 0) {
        b.phase = want;
        b.state = "recover";
        b.t = 1.1;
        b.flash = 1.1;
        b.vx = 0;
        this.flashT = 0.4;
        this.shake = 0.35;
        this.floatText(`PHASE ${want}`, b.x + b.w / 2, b.y - 28, "#ff8ab8");
        this.sound("bossDie");
        if (def.id === "hollow-king" && want === 3) { this.collapseOn = true; this.pitTimer = 1.2; }
      }
    }
    if (b.hp <= 0) this.bossDown(b);
  }

  private collapseOn = false;

  private bossDown(b: Boss): void {
    b.state = "dead";
    b.hp = 0;
    this.bossEndT = 2.4;
    this.collapseOn = false;
    this.pits = [];
    this.shots = [];
    this.enemies = [];
    this.hero.invuln = 5;
    const def = b.def;
    this.sound("bossDie");
    this.cb.onHaptic?.("clear");
    this.setBossMusic(false);
    this.addScore(def.score);
    this.gainXp(def.xp);
    if (def.turned) this.progress.turned.bosses[def.index] = true;
    else this.progress.bosses[def.index] = true;
    const room = this.room;
    const cx = b.x + b.w / 2 - 14;
    // Relic of the zone (main zones 2 to 7).
    if (!def.turned && def.index < 6) {
      const relic = RELICS[def.index];
      if (!this.progress.relics[relic]) this.spawnPickup("relic", cx, b.y + b.h / 2, { relic });
    }
    // Fixed gear reward.
    const slot = SLOTS[(def.index + (def.turned ? 2 : 0)) % SLOTS.length];
    const tier = def.turned ? Math.min(15, 11 + Math.floor((def.index * 5) / 8)) : Math.min(10, def.index + 2);
    this.spawnPickup("gear", cx + 40, b.y + b.h / 2, { slot, tier });
    this.rollCoin(b.x + b.w / 2, b.y + b.h / 2);
    void room;
  }

  /** After the boss death animation: password screen, or the victory screens. */
  private afterBoss(b: Boss): void {
    this.bossEndT = 0;
    this.boss = null;
    const def = b.def;
    if (def.id === "count-faust") {
      this.pwGrid = this.currentGrid();
      this.victoryCursor = 0;
      this.sound("victory");
      this.screen = "victory";
    } else if (def.id === "hollow-king") {
      this.pwGrid = this.currentGrid();
      this.sound("victory");
      this.screen = "true-end";
    } else {
      this.sound("save");
      this.openAltarScreen("play");
    }
  }

  private updatePits(dt: number): void {
    if (this.collapseOn && this.boss && this.boss.state !== "dead") {
      this.pitTimer -= dt;
      if (this.pitTimer <= 0) {
        this.pitTimer = 3.4;
        const room = this.room;
        for (let i = 0; i < 2; i++) {
          const c0 = 3 + Math.floor(this.rng() * (room.cols - 9));
          this.pits.push({ c0, c1: c0 + 2, t: 3.2 });
        }
      }
    }
    for (const p of this.pits) p.t -= dt;
    this.pits = this.pits.filter((p) => p.t > 0);
  }

  // ---------------------------------------------------------------- shots and hazards

  private updateShots(dt: number): void {
    const h = this.hero;
    for (const s of this.shots.slice()) {
      s.life -= dt;
      if (s.homing) {
        const tx = h.x + h.w / 2 - (s.x + s.w / 2);
        const ty = h.y + h.h / 2 - (s.y + s.h / 2);
        const len = Math.hypot(tx, ty) || 1;
        const sp = Math.hypot(s.vx, s.vy) || 120;
        s.vx += (tx / len) * sp * 2 * dt;
        s.vy += (ty / len) * sp * 2 * dt;
        const nl = Math.hypot(s.vx, s.vy) || 1;
        s.vx = (s.vx / nl) * sp;
        s.vy = (s.vy / nl) * sp;
      }
      s.vy += s.gravity * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const cx = s.x + s.w / 2;
      const cy = s.y + s.h / 2;
      let dead = s.life <= 0;
      if (!dead && s.kind !== "wave" && s.kind !== "slash" && this.solidTile(this.room, Math.floor(cx / TILE), Math.floor(cy / TILE))) dead = true;
      if (!dead && (s.kind === "wave")) {
        // Shockwaves ride the floor.
        if (cy > FLOOR_ROW * TILE + 10) dead = true;
      }
      if (!dead && s.fromHero) {
        for (const e of this.enemies.slice()) {
          if (s.hit.has(e) || !rectsOverlap(s, e)) continue;
          s.hit.add(e);
          this.damageEnemy(e, s.dmg / this.stats.atk, s.atkType, s.element);
          if (!s.pierce) dead = true;
        }
        const b = this.boss;
        if (b && b.state !== "dead" && b.state !== "intro" && !s.hit.has(b) && rectsOverlap(s, { x: b.x, y: b.y, w: b.w, h: b.h })) {
          s.hit.add(b);
          this.damageBoss(b, s.dmg / this.stats.atk, s.atkType, s.element);
          if (!s.pierce) dead = true;
        }
        for (const br of this.breakables) {
          if (br.alive && !s.hit.has(br) && rectsOverlap(s, br)) {
            s.hit.add(br);
            this.breakBreakable(br);
          }
        }
      } else if (!dead && rectsOverlap(s, h)) {
        if (!s.hit.has(h)) {
          this.hurtHero(s.dmg, s);
          if (s.pierce) s.hit.add(h);
        }
        if (!s.pierce) dead = true;
      }
      if (dead) this.shots = this.shots.filter((o) => o !== s);
    }
  }

  private updateHazards(dt: number): void {
    const h = this.hero;
    this.slowT = Math.max(0, this.slowT - dt);
    for (const z of this.hazards) {
      if (z.delay > 0) { z.delay -= dt; continue; }
      z.life -= dt;
      if (rectsOverlap(h, z)) {
        if (z.slow) this.slowT = 0.15;
        this.hurtHero(z.dmg * 0.7);
      }
    }
    this.hazards = this.hazards.filter((z) => z.life > 0);
  }

  private slowT = 0;

  // ---------------------------------------------------------------- pickups

  private spawnPickup(kind: PickupKind, x: number, y: number, extra: Partial<Pickup> = {}): void {
    const size = kind === "coin" ? 24 : kind === "relic" ? 28 : 22;
    this.pickups.push({
      x, y, w: size, h: size, vx: 0, vy: -220, kind, life: kind === "coin" ? CREDIT_COIN_LIFETIME : kind === "relic" ? 9999 : 16,
      value: 0, bob: this.rng() * 6, onGround: false, ...extra,
    });
  }

  private updatePickups(dt: number): void {
    const h = this.hero;
    for (const p of this.pickups.slice()) {
      p.life -= dt;
      p.bob += dt * 4;
      if (!p.onGround) {
        p.vy = Math.min(MAX_FALL, p.vy + GRAVITY * 0.6 * dt);
        const res = this.moveY(p, p.vy * dt);
        if (res === "down") { p.onGround = true; p.vy = 0; }
      }
      if (p.life <= 0) {
        this.pickups = this.pickups.filter((o) => o !== p);
        continue;
      }
      if (rectsOverlap(h, p)) {
        this.collect(p);
        this.pickups = this.pickups.filter((o) => o !== p);
      }
    }
  }

  private collect(p: Pickup): void {
    const h = this.hero;
    switch (p.kind) {
      case "hp": h.hp = Math.min(this.stats.maxHp, h.hp + this.stats.maxHp * 0.12 + 8); this.sound("pickup"); break;
      case "mp": h.mp = Math.min(this.stats.maxMp, h.mp + this.stats.maxMp * 0.3 + 4); this.sound("pickup"); break;
      case "xp": this.gainXp(p.value); this.sound("pickup"); break;
      case "life":
        if (this.lives < MAX_LIVES) { this.lives++; this.emitLives(); }
        this.sound("pickup");
        this.setToast("1-UP", null);
        break;
      case "gear":
        if (p.slot && p.tier) {
          this.sound("pickup");
          if (!this.equipTier(p.slot, p.tier, false)) this.addScore(50);
        }
        break;
      case "relic":
        if (p.relic) {
          this.progress.relics[p.relic] = true;
          this.addScore(500);
          this.sound("relic");
          const info = RELIC_INFO[p.relic];
          this.setToast(`RELIC: ${info.name}. ${info.text}`, null);
        }
        break;
      case "coin":
        this.sound("credit");
        this.cb.onCreditDrop?.();
        break;
      default: break;
    }
  }

  // ---------------------------------------------------------------- drawing helpers

  private sprite(key: string, rows: SpriteRows, palette: SpritePalette): HTMLCanvasElement {
    let s = this.sprites.get(key);
    if (!s) {
      s = buildSprite(rows, palette);
      this.sprites.set(key, s);
    }
    return s;
  }

  private text(s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = "left"): void {
    const c = this.ctx;
    c.font = `bold ${size}px ui-monospace, Menlo, Consolas, monospace`;
    c.textAlign = align;
    c.textBaseline = "top";
    c.fillStyle = color;
    c.fillText(s, Math.round(x), Math.round(y));
  }

  private shadowText(s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = "left"): void {
    this.text(s, x + 2, y + 2, size, "#000", align);
    this.text(s, x, y, size, color, align);
  }

  private draw(): void {
    const c = this.ctx;
    c.imageSmoothingEnabled = false;
    c.fillStyle = "#07040c";
    c.fillRect(0, 0, W, H);
    switch (this.screen) {
      case "title": this.drawTitle(); break;
      case "hero-select": this.drawHeroSelect(); break;
      case "password-entry": this.drawPasswordScreen(); break;
      case "altar": this.drawPasswordScreen(); break;
      case "confirm-delete": this.drawConfirm(); break;
      case "victory": this.drawVictory(false); break;
      case "true-end": this.drawVictory(true); break;
      case "turn-scene": this.drawTurnScene(); break;
      case "play":
        this.drawScene();
        this.drawHud();
        break;
      case "menu":
        this.drawScene();
        this.drawHud();
        this.drawMenu();
        break;
    }
  }

  private backdrop(): void {
    const c = this.ctx;
    c.fillStyle = "#0b0612";
    c.fillRect(0, 0, W, H);
    c.fillStyle = "#150a22";
    c.fillRect(0, 0, W, 110);
    // Moon and castle silhouette.
    c.fillStyle = "rgba(233,224,208,0.14)";
    c.beginPath(); c.arc(560, 150, 70, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#e9e0d0";
    c.beginPath(); c.arc(560, 150, 48, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#150a22";
    const bx = 440;
    c.fillRect(bx, 330, 260, 246);
    c.fillRect(bx + 20, 270, 40, 80);
    c.fillRect(bx + 100, 230, 50, 120);
    c.fillRect(bx + 190, 280, 46, 70);
    c.beginPath(); c.moveTo(bx + 100, 230); c.lineTo(bx + 125, 180); c.lineTo(bx + 150, 230); c.fill();
    c.fillStyle = "#f5b13a";
    for (const [wx, wy] of [[bx + 36, 296], [bx + 118, 260], [bx + 206, 306], [bx + 70, 400], [bx + 170, 410]]) c.fillRect(wx, wy, 8, 14);
    c.fillStyle = "#1c0f2c";
    c.fillRect(0, 500, W, 76);
  }

  private drawTitle(): void {
    this.backdrop();
    const c = this.ctx;
    this.shadowText("MARCY", 48, 70, 54, "#ff3b6e");
    this.shadowText("THE VAMPIRE HUNTER", 48, 134, 28, "#e9e0d0");
    this.text("A castle. A whip or a sword. A password.", 50, 182, 13, "#a89cc0");
    const items = this.titleItems();
    for (let i = 0; i < items.length; i++) {
      const sel = i === this.titleCursor;
      this.text((sel ? "> " : "  ") + items[i], 60, 270 + i * 40, 22, sel ? "#ffe27a" : "#c9bfe0");
    }
    this.text("ARROWS + SPACE", 60, 470, 12, "#7a6a98");
    c.fillStyle = "rgba(0,0,0,0)";
  }

  private heroPreview(hero: Hero, x: number, y: number, scale: number): void {
    const sp = this.sprite(`h:${hero}:idle`, heroRows(hero, "idle"), HERO_PALETTES[hero]);
    drawSprite(this.ctx, sp, x, y, scale);
  }

  private drawHeroSelect(): void {
    this.backdrop();
    const c = this.ctx;
    this.shadowText("CHOOSE YOUR HUNTER", W / 2, 34, 26, "#e9e0d0", "center");
    const heroes: Hero[] = ["marcy", "frankford"];
    const lean = ["LCK and INT up", "STR and DEF up"];
    for (let i = 0; i < 2; i++) {
      const hero = heroes[i];
      const info = HERO_INFO[hero];
      const x = 50 + i * 350;
      const sel = this.heroCursor === i;
      c.fillStyle = sel ? "rgba(255,59,110,0.18)" : "rgba(20,10,34,0.85)";
      c.fillRect(x, 100, 320, 380);
      c.strokeStyle = sel ? "#ffe27a" : "#3a2a58";
      c.lineWidth = 3;
      c.strokeRect(x + 1.5, 101.5, 317, 377);
      this.heroPreview(hero, x + 40, 130, 8);
      this.text(info.name, x + 140, 140, 15, "#ffffff");
      this.text(info.weapon, x + 140, 170, 16, "#ff8ab8");
      this.text(`Reach ${info.reach}px`, x + 140, 200, 12, "#c9bfe0");
      this.text(i === 0 ? "Hits up, slower" : "Fast 3-hit combo", x + 140, 220, 12, "#c9bfe0");
      this.text(lean[i], x + 140, 240, 12, "#c9bfe0");
      this.text(`SPECIAL: ${info.special}`, x + 20, 320, 13, "#ffe27a");
      this.text(`Costs ${info.specialMp} MP`, x + 20, 342, 12, "#7aa8ff");
      this.text(i === 0 ? "Whip burst, 3 hits" : "Arcing wave shot", x + 20, 362, 12, "#c9bfe0");
    }
    this.text("LEFT / RIGHT, SPACE TO START, X BACK", W / 2, 510, 12, "#7a6a98", "center");
  }

  private drawConfirm(): void {
    this.backdrop();
    this.c0(0.6);
    this.shadowText("DELETE PROGRESS?", W / 2, 190, 30, "#ff8ab8", "center");
    this.text("Hero, relics, bosses, level, gear and score are cleared.", W / 2, 240, 13, "#c9bfe0", "center");
    const opts = ["NO", "YES"];
    for (let i = 0; i < 2; i++) {
      const sel = this.confirmCursor === i;
      this.text((sel ? "> " : "  ") + opts[i], W / 2 - 80 + i * 130, 300, 24, sel ? "#ffe27a" : "#c9bfe0");
    }
  }

  private c0(a: number): void {
    this.ctx.fillStyle = `rgba(0,0,0,${a})`;
    this.ctx.fillRect(0, 0, W, H);
  }

  private drawPwGrid(x: number, y: number, cell: number, cursor: boolean): void {
    const c = this.ctx;
    const letters = "ABCDEFGHIJKL";
    for (let i = 0; i < GRID_COLS; i++) {
      this.text(String(i + 1), x + 26 + i * cell + cell / 2, y - 16, 10, "#7a6a98", "center");
      this.text(letters[i], x + 8, y + i * cell + cell / 2 - 6, 11, "#7a6a98", "center");
    }
    for (let r = 0; r < GRID_COLS; r++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const cx = x + 20 + col * cell;
        const cy = y + r * cell;
        const on = this.pwGrid[r * GRID_COLS + col];
        c.fillStyle = on ? "#0a1430" : "#1c1230";
        c.fillRect(cx + 1, cy + 1, cell - 2, cell - 2);
        if (on) {
          // Blue flame, two frames; the engine clock is frozen on these screens, so use real time.
          const f = Math.floor(performance.now() / 260 + (r + col) * 0.5) % 2;
          const sp = this.sprite(`flame:${f}`, f === 0 ? FLAME_A : FLAME_B, FLAME_PALETTE);
          c.drawImage(sp, cx + 2, cy + 2, cell - 4, cell - 4);
        } else {
          c.strokeStyle = "#3a2a58";
          c.lineWidth = 1;
          c.strokeRect(cx + 1.5, cy + 1.5, cell - 3, cell - 3);
        }
        if (cursor && this.pwRow === r && this.pwCol === col) {
          c.strokeStyle = "#ff3b6e";
          c.lineWidth = 3;
          c.strokeRect(cx, cy, cell, cell);
        }
      }
    }
  }

  private labelLines(width: number): string[] {
    const labels = filledLabels(this.pwGrid);
    const lines: string[] = [];
    let cur = "";
    for (const l of labels) {
      if ((cur + " " + l).trim().length > width) {
        lines.push(cur);
        cur = l;
      } else cur = (cur + " " + l).trim();
    }
    if (cur) lines.push(cur);
    return lines;
  }

  private drawPasswordScreen(): void {
    this.backdrop();
    this.c0(0.7);
    const show = this.screen === "altar";
    this.shadowText(show ? "SAVE ALTAR: YOUR PASSWORD" : "ENTER PASSWORD", W / 2, 20, 22, "#ffe27a", "center");
    const cell = 29;
    this.drawPwGrid(26, 78, cell, !show);
    const rx = 420;
    if (show) {
      this.text("Write these cells down, or press COPY.", rx, 80, 12, "#c9bfe0");
      const lines = this.labelLines(34);
      this.text(`${filledLabels(this.pwGrid).length} FILLED CELLS`, rx, 106, 12, "#7aa8ff");
      lines.slice(0, 12).forEach((l, i) => this.text(l, rx, 130 + i * 18, 13, "#ffffff"));
      const opts = ["CONTINUE", "COPY"];
      opts.forEach((o, i) => this.text((this.pwShowCursor === i ? "> " : "  ") + o, rx, 400 + i * 34, 20, this.pwShowCursor === i ? "#ffe27a" : "#c9bfe0"));
      if (this.copyMsgT > 0) this.text(this.copyMsg, rx, 480, 16, this.copyMsg === "COPIED" ? "#7affb0" : "#ff6a7a");
    } else {
      this.text("Arrows move. SPACE toggles a dot.", rx, 80, 12, "#c9bfe0");
      this.text("C clears. ENTER checks. X goes back.", rx, 100, 12, "#c9bfe0");
      this.text("Paste a copied list with PASTE or Ctrl+V.", rx, 120, 12, "#c9bfe0");
      const filled = filledLabels(this.pwGrid);
      this.text(`${filled.length} FILLED CELLS`, rx, 160, 12, "#7aa8ff");
      this.labelLines(34).slice(0, 11).forEach((l, i) => this.text(l, rx, 184 + i * 18, 13, "#ffffff"));
      const opts = ["PASTE", "CLEAR", "OK", "BACK"];
      opts.forEach((o, i) => {
        const sel = this.pwRow === GRID_COLS && this.pwCol === i;
        this.text((sel ? "> " : "  ") + o, 26 + i * 130, 458, 18, sel ? "#ffe27a" : "#c9bfe0");
      });
      if (this.pwMsgT > 0) this.text(this.pwMsg, rx, 410, 20, this.pwMsg === "PASTED" ? "#7affb0" : "#ff6a7a");
    }
  }

  private drawVictory(trueEnd: boolean): void {
    this.backdrop();
    this.c0(0.55);
    this.shadowText(trueEnd ? "THE HOLLOW KING IS NO MORE" : "COUNT FAUST HAS FALLEN", W / 2, 24, trueEnd ? 24 : 26, "#ffe27a", "center");
    this.text(trueEnd ? "The castle is quiet at last. This is your final password." : "The castle trembles. This is your password.", W / 2, 62, 12, "#c9bfe0", "center");
    this.drawPwGrid(26, 100, 27, false);
    const rx = 410;
    const filled = filledLabels(this.pwGrid);
    this.text(`${filled.length} FILLED CELLS`, rx, 100, 12, "#7aa8ff");
    this.labelLines(36).slice(0, 9).forEach((l, i) => this.text(l, rx, 124 + i * 18, 12, "#ffffff"));
    if (trueEnd) {
      this.text("C: COPY PASSWORD", rx, 330, 14, "#c9bfe0");
      this.text("SPACE: END THE RUN", rx, 370, 20, "#ffe27a");
    } else {
      const opts = ["ENTER THE TURNED CASTLE", "COPY", "END RUN"];
      opts.forEach((o, i) => this.text((this.victoryCursor === i ? "> " : "  ") + o, rx - 10, 330 + i * 34, 17, this.victoryCursor === i ? "#ffe27a" : "#c9bfe0"));
    }
    if (this.copyMsgT > 0) this.text(this.copyMsg, rx, 450, 16, this.copyMsg === "COPIED" ? "#7affb0" : "#ff6a7a");
  }

  private drawTurnScene(): void {
    const c = this.ctx;
    const p = Math.min(1, this.turnT / 3);
    const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    c.fillStyle = "#07040c";
    c.fillRect(0, 0, W, H);
    c.save();
    c.translate(W / 2, H / 2);
    c.rotate(ease * Math.PI);
    c.fillStyle = "#150a22";
    c.fillRect(-170, -60, 340, 180);
    c.fillRect(-170, -120, 50, 70);
    c.fillRect(-40, -170, 70, 120);
    c.fillRect(110, -100, 60, 50);
    c.beginPath(); c.moveTo(-40, -170); c.lineTo(-5, -230); c.lineTo(30, -170); c.fill();
    c.fillStyle = "#f5b13a";
    for (const [wx, wy] of [[-150, -100], [-12, -140], [128, -80], [-100, 0], [60, 20]]) c.fillRect(wx, wy, 10, 18);
    c.fillStyle = "#e9e0d0";
    c.beginPath(); c.arc(100, -190, 26, 0, Math.PI * 2); c.fill();
    c.restore();
    const a = Math.min(1, this.turnT / 0.8);
    this.text("THE CASTLE TURNS", W / 2, 70, 28, `rgba(255,226,122,${a})`, "center");
    this.text("SPACE: SKIP", W / 2, H - 34, 12, "#7a6a98", "center");
  }

  // ---------------------------------------------------------------- scene

  private layerFor(room: Room): HTMLCanvasElement {
    let layer = this.layers.get(room.id);
    if (layer) return layer;
    if (this.layers.size >= 6) {
      const first = this.layers.keys().next().value;
      if (first !== undefined) this.layers.delete(first);
    }
    layer = document.createElement("canvas");
    layer.width = room.cols * TILE;
    layer.height = H;
    const g = layer.getContext("2d");
    if (!g) return layer;
    const pal = this.palette(room);
    const rnd = makeRng(hashString(room.id + "d"));
    g.fillStyle = pal.bg;
    g.fillRect(0, 0, layer.width, H);
    // Back wall joints.
    g.fillStyle = pal.bg2;
    for (let y = TILE; y < H - TILE; y += 32) g.fillRect(0, y, layer.width, 2);
    for (let y = TILE, row = 0; y < H - TILE; y += 32, row++) {
      for (let x = (row % 2) * 24; x < layer.width; x += 48) g.fillRect(x, y, 2, 32);
    }
    // Decor (drawn flipped in the Turned Castle; collision is never flipped).
    g.save();
    if (room.castle === "turned") {
      g.translate(0, H);
      g.scale(1, -1);
    }
    const n = Math.floor(room.cols / 6);
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * (layer.width / n);
      const kind = Math.floor(rnd() * 3);
      if (kind === 0) {
        // Stained-glass window.
        g.fillStyle = pal.brickLt;
        g.fillRect(x - 26, 96, 52, 150);
        g.beginPath(); g.arc(x, 96, 26, Math.PI, 0); g.fill();
        g.globalAlpha = 0.5;
        g.fillStyle = pal.accent;
        g.fillRect(x - 20, 100, 40, 140);
        g.beginPath(); g.arc(x, 100, 20, Math.PI, 0); g.fill();
        g.globalAlpha = 1;
        g.fillStyle = pal.brickLt;
        g.fillRect(x - 2, 80, 4, 160);
        g.fillRect(x - 20, 160, 40, 4);
      } else if (kind === 1) {
        // Pillar.
        g.fillStyle = pal.brickLt;
        g.globalAlpha = 0.45;
        g.fillRect(x - 14, TILE, 28, H - TILE * 2);
        g.fillRect(x - 20, TILE, 40, 12);
        g.fillRect(x - 20, H - TILE * 2 - 12, 40, 12);
        g.globalAlpha = 1;
      } else {
        // Chandelier on a chain.
        g.fillStyle = pal.brickLt;
        g.fillRect(x - 1, TILE, 3, 70);
        g.fillRect(x - 24, TILE + 70, 48, 5);
        g.fillStyle = pal.glow;
        for (const dx of [-20, -7, 7, 20]) g.fillRect(x + dx - 2, TILE + 58, 4, 12);
      }
    }
    g.restore();
    // Tiles.
    for (let r = 0; r < room.tiles.length; r++) {
      for (let cI = 0; cI < room.cols; cI++) {
        const ch = room.tiles[r][cI];
        const x = cI * TILE;
        const y = r * TILE;
        if (ch === "#") {
          g.fillStyle = pal.brick;
          g.fillRect(x, y, TILE, TILE);
          g.fillStyle = pal.brickLt;
          if (r === 0 || room.tiles[r - 1][cI] !== "#") g.fillRect(x, y, TILE, 4);
          g.fillStyle = "rgba(0,0,0,0.28)";
          g.fillRect(x, y + TILE - 3, TILE, 3);
          g.fillRect(x + ((r + cI) % 2 ? 24 : 12), y + 8, 2, 16);
          g.fillRect(x + 4, y + 28, 2, 14);
        } else if (ch === "=") {
          g.fillStyle = pal.brickLt;
          g.fillRect(x, y, TILE, 12);
          g.fillStyle = pal.brick;
          g.fillRect(x, y + 12, TILE, 5);
          g.fillStyle = "rgba(0,0,0,0.3)";
          g.fillRect(x, y + 17, TILE, 2);
        } else if (ch === "^") {
          g.fillStyle = pal.accent;
          for (let k = 0; k < 3; k++) {
            g.beginPath();
            g.moveTo(x + k * 16, y + TILE);
            g.lineTo(x + k * 16 + 8, y + 18);
            g.lineTo(x + k * 16 + 16, y + TILE);
            g.fill();
          }
        }
      }
    }
    this.layers.set(room.id, layer);
    return layer;
  }

  private drawScene(): void {
    const c = this.ctx;
    const room = this.room;
    const pal = this.palette(room);
    const camX = Math.round(this.camX);
    const layer = this.layerFor(room);
    c.drawImage(layer, camX, 0, W, H, 0, 0, W, H);
    c.save();
    const sx = this.shake > 0 ? (this.rng() - 0.5) * 8 : 0;
    const sy = this.shake > 0 ? (this.rng() - 0.5) * 8 : 0;
    c.translate(-camX + sx, sy);
    const c0 = Math.max(0, Math.floor(camX / TILE));
    const c1 = Math.min(room.cols - 1, Math.floor((camX + W) / TILE));
    // Dynamic tiles.
    for (let r = 0; r < room.tiles.length; r++) {
      for (let col = c0; col <= c1; col++) {
        const ch = this.tileChar(room, col, r);
        const x = col * TILE;
        const y = r * TILE;
        if (ch === "H") {
          c.fillStyle = pal.brick;
          c.fillRect(x, y, TILE, TILE);
          if (this.progress.relics.lantern) {
            c.fillStyle = pal.glow;
            c.fillRect(x + 14, y + 6, 20, TILE - 6);
            c.fillStyle = pal.bg;
            c.fillRect(x + 18, y + 10, 12, TILE - 10);
          }
        } else if (ch === "G") {
          c.fillStyle = this.hero.mistT > 0 ? "rgba(120,120,140,0.25)" : "#2a2a34";
          for (let k = 0; k < 4; k++) c.fillRect(x + 4 + k * 12, y, 4, TILE);
          c.fillRect(x, y + 20, TILE, 4);
        } else if (ch === "S") {
          if (!this.brokenTiles.has(`${room.id}:${col}:${r}`)) {
            c.fillStyle = "#4a3a68";
            c.fillRect(x, y, TILE, TILE);
            c.fillStyle = "#b88ae0";
            c.fillRect(x + 20, y + 8, 8, 32);
            c.fillRect(x + 8, y + 20, 32, 8);
          }
        } else if (ch === "K") {
          if (!this.bossDoorOpen(room)) {
            c.fillStyle = "#6a1c34";
            c.fillRect(x, y, TILE, TILE);
            c.fillStyle = "#ff3b5c";
            c.fillRect(x + 4, y + 4, TILE - 8, 3);
            c.fillRect(x + 20, y + 18, 8, 14);
          }
        } else if (ch === "X") {
          const closed = this.gateXClosed(room, col);
          c.fillStyle = closed ? "#2a2a34" : "rgba(255,255,255,0.06)";
          for (let k = 0; k < 4; k++) c.fillRect(x + 4 + k * 12, y, 4, TILE);
        }
      }
    }
    // Doors.
    for (const d of room.doors) {
      const x = d.col * TILE;
      c.fillStyle = "#0a0610";
      c.fillRect(x + 4, FLOOR_ROW * TILE - 84, 40, 84);
      c.beginPath(); c.arc(x + 24, FLOOR_ROW * TILE - 84, 20, Math.PI, 0); c.fill();
      c.strokeStyle = pal.accent;
      c.lineWidth = 3;
      c.strokeRect(x + 5.5, FLOOR_ROW * TILE - 83, 37, 82);
      c.fillStyle = pal.glow;
      c.fillRect(x + 34, FLOOR_ROW * TILE - 40, 4, 6);
    }
    // Altar.
    if (room.altarCol !== null) this.drawAltar(room.altarCol * TILE, pal);
    // Chests, crests, breakables.
    for (const ch of this.chests) this.drawChest(ch);
    for (const cr of this.crests) {
      if (cr.taken) continue;
      const bob = Math.sin(this.time * 4) * 3;
      c.fillStyle = "#ff3b5c";
      c.fillRect(cr.x + 8, cr.y + 6 + bob, 20, 20);
      c.fillRect(cr.x + 4, cr.y + 10 + bob, 28, 12);
      c.fillStyle = "#ffd0d8";
      c.fillRect(cr.x + 10, cr.y + 8 + bob, 6, 6);
    }
    for (const b of this.breakables) {
      c.fillStyle = "#6a5648";
      c.fillRect(b.x + 4, b.y + 22, 16, 20);
      c.fillStyle = "#e9e0d0";
      c.fillRect(b.x + 8, b.y + 8, 8, 16);
      c.fillStyle = pal.glow;
      c.fillRect(b.x + 9, b.y - 2 + Math.sin(this.time * 12 + b.x) * 2, 6, 10);
    }
    this.drawEntities();
    c.restore();
    // Hazard telegraph overlay for collapsing floor.
    if (this.pits.length > 0) {
      c.save();
      c.translate(-camX, 0);
      for (const p of this.pits) {
        const warn = p.t > 2.2;
        if (warn && Math.floor(p.t * 10) % 2 === 0) continue;
        c.fillStyle = warn ? "rgba(255,59,92,0.5)" : "rgba(0,0,0,0.0)";
        c.fillRect(p.c0 * TILE, FLOOR_ROW * TILE, (p.c1 - p.c0 + 1) * TILE, TILE);
      }
      c.restore();
    }
    // Dark rooms: plain alpha, lantern lights them.
    if (room.dark && !this.progress.relics.lantern) {
      const hx = this.hero.x + this.hero.w / 2 - camX;
      const hy = this.hero.y + this.hero.h / 2;
      c.fillStyle = "rgba(0,0,0,0.9)";
      c.beginPath();
      c.rect(0, 0, W, H);
      c.arc(hx, hy, 120, 0, Math.PI * 2);
      c.fill("evenodd");
      c.fillStyle = "rgba(0,0,0,0.4)";
      c.beginPath();
      c.arc(hx, hy, 170, 0, Math.PI * 2);
      c.arc(hx, hy, 120, 0, Math.PI * 2, true);
      c.fill("evenodd");
    }
    if (this.flashT > 0) {
      c.fillStyle = `rgba(255,255,255,${Math.min(0.6, this.flashT * 1.6)})`;
      c.fillRect(0, 0, W, H);
    }
  }

  private drawAltar(x: number, pal: ZonePalette): void {
    const c = this.ctx;
    const y = FLOOR_ROW * TILE;
    c.fillStyle = pal.brickLt;
    c.fillRect(x + 4, y - 30, 40, 30);
    c.fillStyle = pal.brick;
    c.fillRect(x + 10, y - 44, 28, 14);
    const f = Math.sin(this.time * 9) * 3;
    c.fillStyle = pal.glow;
    c.fillRect(x + 18, y - 64 + f, 12, 20 - f);
    c.fillStyle = "#fff6d8";
    c.fillRect(x + 21, y - 58 + f, 6, 10);
    const h = this.hero;
    if (Math.abs(h.x + h.w / 2 - (x + 24)) < 56 && this.screen === "play") this.text("UP: SAVE", x + 24, y - 90, 12, "#ffe27a", "center");
  }

  private drawChest(ch: Chest): void {
    const c = this.ctx;
    c.fillStyle = ch.open ? "#4a3626" : "#7a5638";
    c.fillRect(ch.x + 4, ch.y + 14, ch.w - 8, ch.h - 14);
    c.fillStyle = "#c9a45c";
    c.fillRect(ch.x + 4, ch.y + 22, ch.w - 8, 5);
    if (ch.open) {
      c.fillStyle = "#5a4430";
      c.fillRect(ch.x + 4, ch.y - 2, ch.w - 8, 8);
    } else {
      c.fillStyle = "#8a6444";
      c.fillRect(ch.x + 6, ch.y + 4, ch.w - 12, 12);
      c.fillStyle = "#ffe27a";
      c.fillRect(ch.x + ch.w / 2 - 3, ch.y + 18, 6, 8);
      const h = this.hero;
      if (Math.abs(h.x + h.w / 2 - (ch.x + ch.w / 2)) < 60 && this.screen === "play") this.text("UP: OPEN", ch.x + ch.w / 2, ch.y - 22, 12, "#ffe27a", "center");
    }
  }

  private heroFrame(): HeroFrame {
    const h = this.hero;
    if (h.crouch) return "crouch";
    if (!h.onGround) return "air";
    if (Math.abs(h.vx) > 20) return Math.floor(h.runT * 9) % 2 === 0 ? "runA" : "runB";
    return "idle";
  }

  private drawEntities(): void {
    const c = this.ctx;
    // Hazard zones
    for (const z of this.hazards) {
      c.fillStyle = z.delay > 0 ? "rgba(255,255,255,0.18)" : z.color;
      c.globalAlpha = z.delay > 0 ? 1 : 0.8;
      c.fillRect(z.x, z.y, z.w, z.h);
      c.globalAlpha = 1;
    }
    // Pickups
    for (const p of this.pickups) this.drawPickup(p);
    // Enemies
    for (const e of this.enemies) this.drawEnemy(e);
    // Boss
    if (this.boss) this.drawBoss(this.boss);
    // Hero
    this.drawHero();
    // Shots
    for (const s of this.shots) this.drawShot(s);
    // Particles
    for (const p of this.particles) {
      c.globalAlpha = Math.max(0, p.life / p.max);
      c.fillStyle = p.color;
      c.fillRect(p.x, p.y, p.size, p.size);
    }
    c.globalAlpha = 1;
    for (const f of this.floats) {
      c.globalAlpha = Math.min(1, f.t * 2);
      this.shadowText(f.text, f.x, f.y, 14, f.color, "center");
    }
    c.globalAlpha = 1;
  }

  private drawPickup(p: Pickup): void {
    const c = this.ctx;
    const bob = p.onGround ? Math.sin(p.bob) * 3 : 0;
    const x = p.x;
    const y = p.y + bob;
    switch (p.kind) {
      case "coin": {
        if (p.life < CREDIT_COIN_BLINK && Math.floor(p.life * 8) % 2 === 0) return;
        const sp = this.sprite("coin", COIN_ROWS, COIN_PALETTE);
        drawSprite(c, sp, x, y, 3);
        break;
      }
      case "hp":
        c.fillStyle = "#ff3b5c";
        c.fillRect(x + 2, y + 4, 8, 8); c.fillRect(x + 12, y + 4, 8, 8); c.fillRect(x + 2, y + 8, 18, 6); c.fillRect(x + 6, y + 14, 10, 4); c.fillRect(x + 9, y + 18, 4, 3);
        break;
      case "mp":
        c.fillStyle = "#5a8aff";
        c.beginPath(); c.moveTo(x + 11, y); c.lineTo(x + 21, y + 11); c.lineTo(x + 11, y + 22); c.lineTo(x + 1, y + 11); c.fill();
        break;
      case "xp":
        c.fillStyle = "#52f06a";
        c.beginPath(); c.moveTo(x + 11, y + 2); c.lineTo(x + 20, y + 11); c.lineTo(x + 11, y + 20); c.lineTo(x + 2, y + 11); c.fill();
        break;
      case "gear":
        c.fillStyle = "#c9a45c";
        c.fillRect(x, y + 2, 22, 18);
        c.fillStyle = "#3a2a18";
        c.fillRect(x + 3, y + 5, 16, 12);
        c.fillStyle = "#ffe27a";
        c.fillRect(x + 9, y + 8, 4, 6);
        break;
      case "life":
        c.fillStyle = "#ffffff";
        c.fillRect(x + 2, y + 4, 8, 8); c.fillRect(x + 12, y + 4, 8, 8); c.fillRect(x + 2, y + 8, 18, 6); c.fillRect(x + 6, y + 14, 10, 4);
        this.text("1UP", x + 11, y - 12, 10, "#ffffff", "center");
        break;
      case "relic": {
        const glow = 0.5 + Math.sin(this.time * 5) * 0.3;
        c.globalAlpha = glow;
        c.fillStyle = "#ffe27a";
        c.beginPath(); c.arc(x + 14, y + 14, 22, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 1;
        c.fillStyle = "#b88ae0";
        c.beginPath(); c.moveTo(x + 14, y); c.lineTo(x + 28, y + 14); c.lineTo(x + 14, y + 28); c.lineTo(x, y + 14); c.fill();
        c.fillStyle = "#fff";
        c.fillRect(x + 12, y + 8, 4, 12);
        break;
      }
      default: break;
    }
  }

  private drawEnemy(e: Enemy): void {
    const def = e.def;
    const frame = (Math.floor(e.t * 5) % 2) as 0 | 1;
    const rows = planRows(def.plan, def.plan === "walker" || def.plan === "flyer" || def.plan === "crawler" || def.plan === "shooter" || def.plan === "medusa" ? frame : 0);
    const flash = e.hitFlash > 0;
    const key = `e:${def.id}:${def.plan}:${frame}:${flash ? "w" : "n"}`;
    const pal = flash ? enemyPalette("#ffffff", "#ffffff", "#ffffff") : enemyPalette(def.a, def.b, def.k);
    const sp = this.sprite(key, rows, pal);
    const sc = ENEMY_PLAN_SCALE * e.scale;
    drawSprite(this.ctx, sp, e.x, e.y + e.h - sp.height * sc, sc, e.dir < 0);
    if (e.state === "windup") this.text("!", e.x + e.w / 2, e.y - 22, 20, "#ff3b5c", "center");
    if (e.hp < e.maxHp) {
      const c = this.ctx;
      c.fillStyle = "#000";
      c.fillRect(e.x, e.y - 8, e.w, 4);
      c.fillStyle = "#ff3b5c";
      c.fillRect(e.x, e.y - 8, (e.w * e.hp) / e.maxHp, 4);
    }
  }

  private drawBoss(b: Boss): void {
    const def = b.def;
    const c = this.ctx;
    const flashing = b.hitFlash > 0 || (b.flash > 0 && Math.floor(b.flash * 10) % 2 === 0);
    const key = `b:${def.id}:${flashing ? "w" : "n"}`;
    const pal = flashing ? enemyPalette("#ffffff", "#ffffff", "#ffffff") : enemyPalette(def.a, def.b, def.k);
    const sp = this.sprite(key, bossRows(def.plan), pal);
    if (b.state === "dead") c.globalAlpha = Math.max(0, this.bossEndT / 2.4);
    drawSprite(c, sp, b.x, b.y, BOSS_PLAN_SCALE, b.face < 0);
    c.globalAlpha = 1;
  }

  private drawHero(): void {
    const c = this.ctx;
    const h = this.hero;
    const hero = this.progress.hero;
    if (h.invuln > 0 && h.hurtT <= 0 && h.mistT <= 0 && Math.floor(h.invuln * 14) % 2 === 0) return;
    const frame = this.heroFrame();
    const sp = this.sprite(`h:${hero}:${frame}`, heroRows(hero, frame), HERO_PALETTES[hero]);
    const sy = h.y + h.h - sp.height * 3;
    if (h.dashT > 0) {
      for (let i = 1; i <= 2; i++) {
        c.globalAlpha = 0.25 / i;
        drawSprite(c, sp, h.x - h.face * i * 22, sy, 3, h.face < 0);
      }
      c.globalAlpha = 1;
    }
    if (h.mistT > 0) {
      c.globalAlpha = 0.45;
      c.fillStyle = "#cfd8ff";
      for (let i = 0; i < 5; i++) {
        c.beginPath();
        c.arc(h.x + h.w / 2 + Math.sin(this.time * 6 + i) * 14, h.y + h.h / 2 + Math.cos(this.time * 5 + i * 2) * 12, 16, 0, Math.PI * 2);
        c.fill();
      }
    }
    drawSprite(c, sp, h.x, sy, 3, h.face < 0);
    c.globalAlpha = 1;
    this.drawWeapon();
  }

  private drawWeapon(): void {
    const c = this.ctx;
    const h = this.hero;
    const hero = this.progress.hero;
    const el = weaponElement(this.progress.equipment.weapon);
    const col = el === "fire" ? "#ff9a3a" : el === "holy" ? "#ffe27a" : hero === "marcy" ? "#d6dde8" : "#dfe8ff";
    const info = HERO_INFO[hero];
    const hx = h.face > 0 ? h.x + h.w - 2 : h.x + 2;
    const hy = h.y + h.h * 0.34;
    if (h.burstT > 0) {
      const p = (0.45 - h.burstT) / 0.45;
      c.strokeStyle = col;
      c.lineWidth = 4;
      for (let i = 0; i < 3; i++) {
        const ext = info.reach * 1.6 * (0.55 + 0.15 * i) * Math.min(1, p * 3);
        c.beginPath();
        c.moveTo(hx, hy);
        c.quadraticCurveTo(hx + h.face * ext * 0.5, hy - 24 + i * 22, hx + h.face * ext, hy - 10 + i * 18);
        c.stroke();
      }
      return;
    }
    if (h.atkT <= 0) return;
    const p = 1 - h.atkT / this.atkTotal;
    // Attacking upward: the arm rises from the shoulder to above the head; the weapon starts at the hand.
    let ux = h.x + h.w / 2;
    let uy = h.y + 12;
    if (h.atkDir === "up") {
      const rise = Math.min(1, p * 3);
      const sx = h.x + h.w / 2 + h.face * 6;
      const sy = h.y + 20;
      ux = sx;
      uy = sy + (h.y - 8 - sy) * rise;
      c.strokeStyle = HERO_PALETTES[hero].c;
      c.lineWidth = 8;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(sx, sy);
      c.lineTo(ux, uy);
      c.stroke();
      c.lineCap = "butt";
      c.fillStyle = HERO_PALETTES[hero].s;
      c.fillRect(ux - 4, uy - 4, 8, 8);
    }
    if (hero === "marcy") {
      const ext = info.reach * Math.sin(Math.min(1, p * 1.6) * Math.PI * 0.5);
      c.strokeStyle = col;
      c.lineWidth = 4;
      c.beginPath();
      if (h.atkDir === "up") {
        c.moveTo(ux, uy);
        c.quadraticCurveTo(ux + 20, uy - ext * 0.5, ux, uy - ext * 0.8);
      } else {
        c.moveTo(hx, hy);
        c.quadraticCurveTo(hx + h.face * ext * 0.5, hy - 28, hx + h.face * ext, hy - 4);
      }
      c.stroke();
      c.fillStyle = "#fff";
      c.fillRect(h.atkDir === "up" ? ux - 2 : hx + h.face * ext - 3, h.atkDir === "up" ? uy - ext * 0.8 - 2 : hy - 7, 6, 6);
    } else {
      const len = 62 + (h.combo === 3 ? 18 : 0);
      const a0 = h.atkDir === "up" ? -2.4 : -1.2 + (h.combo === 2 ? 0.5 : 0);
      const a1 = h.atkDir === "up" ? -0.7 : 0.9;
      const a = a0 + (a1 - a0) * Math.min(1, p * 1.4);
      c.strokeStyle = col;
      c.lineWidth = 5;
      c.beginPath();
      const px = h.atkDir === "up" ? ux : hx;
      const py = h.atkDir === "up" ? uy : hy;
      c.moveTo(px, py);
      c.lineTo(px + Math.cos(a) * len * h.face, py + Math.sin(a) * len);
      c.stroke();
      c.globalAlpha = 0.35;
      c.lineWidth = 12;
      c.beginPath();
      c.arc(px, py, len - 6, a0 * (h.face > 0 ? 1 : -1) + (h.face < 0 ? Math.PI : 0), a * (h.face > 0 ? 1 : -1) + (h.face < 0 ? Math.PI : 0), h.face < 0);
      c.stroke();
      c.globalAlpha = 1;
    }
  }

  private drawShot(s: Shot): void {
    const c = this.ctx;
    c.fillStyle = s.color;
    switch (s.kind) {
      case "hero-wave":
        c.strokeStyle = s.color;
        c.lineWidth = 6;
        c.beginPath();
        c.arc(s.x + (s.vx > 0 ? 8 : s.w - 8), s.y + s.h / 2, 24, s.vx > 0 ? -1.2 : Math.PI - 1.2, s.vx > 0 ? 1.2 : Math.PI + 1.2);
        c.stroke();
        break;
      case "slash":
        c.globalAlpha = 0.5;
        c.fillRect(s.x, s.y, s.w, s.h);
        c.globalAlpha = 1;
        break;
      case "wave":
        c.fillRect(s.x, s.y + 10, s.w, s.h - 10);
        break;
      case "orb":
        c.beginPath(); c.arc(s.x + s.w / 2, s.y + s.h / 2, s.w / 2, 0, Math.PI * 2); c.fill();
        c.fillStyle = "#fff";
        c.fillRect(s.x + s.w / 2 - 3, s.y + s.h / 2 - 3, 6, 6);
        break;
      case "rain":
        c.fillRect(s.x + 3, s.y, 6, s.h);
        break;
      default:
        c.beginPath(); c.arc(s.x + s.w / 2, s.y + s.h / 2, s.w / 2, 0, Math.PI * 2); c.fill();
        c.fillStyle = "#fff";
        c.fillRect(s.x + s.w / 2 - 2, s.y + s.h / 2 - 2, 4, 4);
        break;
    }
  }

  // ---------------------------------------------------------------- HUD and menu

  private bar(x: number, y: number, w: number, h: number, ratio: number, color: string, back = "#1c1230"): void {
    const c = this.ctx;
    c.fillStyle = "#000";
    c.fillRect(x - 2, y - 2, w + 4, h + 4);
    c.fillStyle = back;
    c.fillRect(x, y, w, h);
    c.fillStyle = color;
    c.fillRect(x, y, Math.max(0, Math.min(1, ratio)) * w, h);
  }

  private drawHud(): void {
    const h = this.hero;
    const room = this.room;
    const flash = this.hudFlashT > 0;
    if (flash) this.hudFlashT -= 0.016;
    this.bar(14, 12, 220, 12, h.hp / this.stats.maxHp, flash ? "#ffb0b8" : "#ff3b5c");
    this.text(`HP ${Math.max(0, Math.ceil(h.hp))}/${this.stats.maxHp}`, 18, 12, 10, "#fff");
    this.bar(14, 30, 160, 8, h.mp / this.stats.maxMp, "#5a8aff");
    this.text(`MP ${Math.floor(h.mp)}`, 180, 29, 10, "#9ab8ff");
    this.bar(14, 44, 160, 4, this.xp / xpToNext(this.progress.level), "#52f06a");
    const wt = this.progress.equipment.weapon;
    const wn = wt > 0 ? itemName("weapon", wt, this.progress.hero) : this.progress.hero === "marcy" ? "OLD WHIP" : "OLD SWORD";
    this.text(wn, 14, 54, 11, "#e9e0d0");
    this.shadowText(room.name.toUpperCase(), W / 2, 10, 12, "#c9bfe0", "center");
    // MENU tag
    const c = this.ctx;
    c.fillStyle = "rgba(20,10,34,0.85)";
    c.fillRect(W - 84, 8, 76, 24);
    c.strokeStyle = "#ffe27a";
    c.lineWidth = 2;
    c.strokeRect(W - 83, 9, 74, 22);
    this.text("MENU", W - 46, 13, 13, "#ffe27a", "center");
    // Boss bar
    const b = this.boss;
    if (b && this.bossStarted && b.state !== "dead") {
      const w = 520;
      const x = (W - w) / 2;
      this.shadowText(b.def.name, W / 2, H - 52, 13, "#ffb0c8", "center");
      this.bar(x, H - 32, w, 14, (b.state === "intro" ? b.shown : b.hp) / b.maxHp, "#c8203c");
    }
    if (this.toastT > 0) this.shadowText(this.toast, W / 2, H - 84, 14, "#ffe27a", "center");
  }

  private drawMenu(): void {
    const c = this.ctx;
    c.fillStyle = "rgba(7,4,12,0.9)";
    c.fillRect(24, 44, W - 48, H - 78);
    c.strokeStyle = "#3a2a58";
    c.lineWidth = 3;
    c.strokeRect(25.5, 45.5, W - 51, H - 81);
    TABS.forEach((t, i) => {
      const sel = t === this.tab;
      this.text(t, 70 + i * 160, 56, 16, sel ? "#ffe27a" : "#7a6a98");
      if (sel) { c.fillStyle = "#ffe27a"; c.fillRect(70 + i * 160, 78, 100, 3); }
    });
    this.text("LEFT / RIGHT: TAB   ENTER OR X: CLOSE", W / 2, H - 56, 11, "#7a6a98", "center");
    switch (this.tab) {
      case "MAP": this.drawMapTab(); break;
      case "EQUIP": this.drawEquipTab(); break;
      case "STATUS": this.drawStatusTab(); break;
      case "PASSWORD": this.drawPasswordTab(); break;
    }
  }

  private drawMapTab(): void {
    const c = this.ctx;
    const turned = this.mapShowTurned;
    const world = turned ? this.turned : this.main;
    const faust = this.progress.bosses[8];
    this.text((this.mapRow === -1 ? "> " : "  ") + (turned ? "TURNED" : "MAIN") + (faust ? "  (SPACE: SWITCH)" : ""), 48, 92, 13, this.mapRow === -1 ? "#ffe27a" : "#c9bfe0");
    const cell = 16;
    const rowH = 12;
    const x0 = 240;
    const y0 = 118;
    const zones = world.zones;
    zones.forEach((zd, zi) => {
      const mapped = turned ? (zi < 8 ? this.progress.turned.mapped[zi] : this.progress.turned.bosses.slice(0, 8).every(Boolean)) : this.progress.mapped[zi];
      const baseY = turned ? 2 + zi * 2 : zi * 2;
      const sel = this.mapRow === zi;
      if (sel) { c.fillStyle = "rgba(255,226,122,0.12)"; c.fillRect(44, y0 + baseY * rowH - 2, W - 90, rowH * 2); }
      this.text(zd.name.toUpperCase().slice(0, 22), 50, y0 + baseY * rowH, 10, sel ? "#ffe27a" : mapped ? "#c9bfe0" : "#5a4a78");
      for (const rid of zd.rooms) {
        const r = world.rooms[rid];
        if (!this.visited.has(rid) && !mapped) continue;
        const rx = x0 + r.mapX * cell;
        const ry = y0 + r.mapY * rowH;
        const cur = rid === this.roomId;
        c.fillStyle = cur && Math.floor(this.time * 3 + performance.now() / 300) % 2 === 0 ? "#ffffff" : r.boss ? "#c8203c" : r.altarCol !== null ? "#7aa8ff" : r.side ? "#5a4a78" : "#4a3a68";
        c.fillRect(rx, ry, (r.cols / 16) * cell - 2, rowH - 3);
        if (r.altarCol !== null) { c.fillStyle = "#fff"; c.fillRect(rx + 4, ry + 3, 4, 4); }
      }
    });
    if (turned) {
      const hub = this.turned.rooms[HUB_ID];
      if (hub && (this.visited.has(HUB_ID) || this.progress.bosses[8])) {
        c.fillStyle = this.roomId === HUB_ID ? "#ffffff" : "#4a3a68";
        c.fillRect(x0, y0, (hub.cols / 16) * cell - 2, rowH - 3);
        this.text("NAVE", 50, y0, 10, "#c9bfe0");
      }
    }
    if (this.mapRow >= 0) {
      const mapped = turned ? (this.mapRow < 8 ? this.progress.turned.mapped[this.mapRow] : this.progress.turned.bosses.slice(0, 8).every(Boolean)) : this.progress.mapped[this.mapRow];
      this.text(mapped ? "SPACE: WARP TO ALTAR" : "MAP NOT REVEALED", W / 2, H - 76, 12, mapped ? "#7affb0" : "#ff8a9a", "center");
    }
    this.text("UP / DOWN: ZONE", W - 60, 92, 11, "#7a6a98", "right");
  }

  private drawEquipTab(): void {
    const p = this.progress;
    this.text(`${HERO_INFO[p.hero].name}`, 56, 100, 16, "#ffffff");
    SLOTS.forEach((s, i) => {
      const sel = this.equipCursor === i;
      const tier = p.equipment[s];
      const y = 150 + i * 52;
      this.text((sel ? "> " : "  ") + SLOT_LABEL[s], 56, y, 16, sel ? "#ffe27a" : "#c9bfe0");
      this.text(itemName(s, tier, p.hero), 220, y, 16, tier > 0 ? "#ffffff" : "#5a4a78");
      this.text(`TIER ${tier}`, 560, y, 14, "#7aa8ff");
      const el = s === "weapon" ? weaponElement(tier) : "none";
      if (el !== "none") this.text(el.toUpperCase(), 650, y, 12, el === "fire" ? "#ff9a3a" : "#ffe27a");
    });
    this.text("Better gear equips itself when found. Higher tier is a strict upgrade.", 56, 440, 12, "#7a6a98");
  }

  private drawStatusTab(): void {
    const p = this.progress;
    const s = this.stats;
    if (this.statusPage === 0) {
      const rows: [string, string][] = [
        ["LEVEL", String(p.level)],
        ["XP", `${this.xp}/${xpToNext(p.level)}`],
        ["HP", `${Math.ceil(this.hero.hp)}/${s.maxHp}`],
        ["MP", `${Math.floor(this.hero.mp)}/${s.maxMp}`],
        ["STR", String(s.str)],
        ["DEF", String(s.def)],
        ["INT", String(s.int)],
        ["LCK", String(s.lck)],
        ["SCORE", String(this.score)],
      ];
      rows.forEach(([k, v], i) => {
        this.text(k, 80, 110 + i * 34, 17, "#c9bfe0");
        this.text(v, 260, 110 + i * 34, 17, "#ffffff");
      });
      this.text("UP / DOWN: RELICS", 80, 440, 11, "#7a6a98");
    } else {
      this.text("RELICS", 80, 100, 16, "#ffe27a");
      RELICS.forEach((r, i) => {
        const has = p.relics[r];
        this.text(`${RELIC_INFO[r].name}`, 80, 136 + i * 32, 15, has ? "#ffffff" : "#5a4a78");
        this.text(has ? RELIC_INFO[r].text : "NOT FOUND", 220, 138 + i * 32, 12, has ? "#a89cc0" : "#5a4a78");
      });
      const mb = p.bosses.slice(0, 9).filter(Boolean).length;
      const crest = p.crests.filter(Boolean).length + p.turned.crests.filter(Boolean).length;
      this.text(`BOSSES DEFEATED: ${mb}${p.bosses[8] ? ` + TURNED ${p.turned.bosses.filter(Boolean).length}` : ""}`, 80, 350, 14, "#c9bfe0");
      this.text(`VITALITY CRESTS: ${crest}`, 80, 380, 14, "#c9bfe0");
      this.text("UP / DOWN: STATS", 80, 440, 11, "#7a6a98");
    }
  }

  private drawPasswordTab(): void {
    this.drawPwGrid(46, 118, 26, false);
    const rx = 400;
    this.text(`${filledLabels(this.pwGrid).length} FILLED CELLS`, rx, 100, 12, "#7aa8ff");
    this.labelLines(34).slice(0, 8).forEach((l, i) => this.text(l, rx, 124 + i * 18, 12, "#ffffff"));
    const opts = ["COPY", "DELETE PROGRESS"];
    opts.forEach((o, i) => this.text((this.pwCursor === i ? "> " : "  ") + o, rx, 330 + i * 34, 18, this.pwCursor === i ? "#ffe27a" : "#c9bfe0"));
    if (this.copyMsgT > 0) this.text(this.copyMsg, rx, 410, 16, this.copyMsg === "COPIED" ? "#7affb0" : "#ff6a7a");
  }
}
