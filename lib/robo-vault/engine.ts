// Robo Vault engine: run-and-gun platformer with a dot-grid password. Framework-free:
// no react or next imports, no module-level game state.
import {
  BOSS_HP,
  BOSS_HP_REMATCH,
  CROUCH_H,
  DAMAGE,
  DAMAGE_REDUCTION_PER_MASTER,
  DEFAULT_SKIN,
  SKINS,
  type RoboVaultSkinId,
  EXTRA_LIFE_EVERY,
  GRAVITY,
  H,
  HERO_H,
  HERO_HP,
  HERO_W,
  JUMP_CUT_V,
  JUMP_V,
  MASTERS,
  MAX_DT,
  MAX_FALL,
  MAX_LIVES,
  MAX_STEP,
  PALETTES,
  RUN_SPEED,
  SAM_HP,
  SCORES,
  START_LIVES,
  TILE,
  W,
  WEAPONS,
  WEAPON_ENERGY,
  WEAPON_ORDER,
  type MasterId,
  type Palette,
  type StageId,
  type WeaponId,
} from "./constants";
import {
  ENEMY_SIZE,
  FLYER_A,
  FLYER_B,
  HERO_PALETTE,
  HOPPER_DOWN,
  HOPPER_UP,
  MASTER_PALETTES,
  MASTER_SIZE,
  SAM_MECH,
  SAM_MECH_SIZE,
  SAM_PALETTE,
  SAM_SAUCER,
  SAM_SAUCER_SIZE,
  TURRET,
  WALKER_A,
  WALKER_B,
  buildSprite,
  drawSprite,
  enemyPalette,
  heroRows,
  masterRows,
  type EnemyKind,
  type HeroFrame,
  type HeroLegs,
  type SpritePalette,
  type SpriteRows,
} from "./entities";
import { buildLevel, type LevelDef } from "./levels";
import {
  decodePassword,
  emptyProgress,
  encodePassword,
  filledLabels,
  parsePasswordText,
  passwordScore,
  type PasswordGrid,
  type Progress,
} from "./password";
import {
  clampScore,
  isHazardChar,
  isSolidChar,
  isWeakness,
  levelOf,
  makeRng,
  rectsOverlap,
  tileAt,
  weaponDamage,
  type Rect,
} from "./utils";

export type RoboVaultSound =
  | "shoot"
  | "jump"
  | "hit"
  | "enemyDie"
  | "bossHit"
  | "bossDie"
  | "pickup"
  | "weapon"
  | "death"
  | "gameover"
  | "select"
  | "victory"
  | "bossTick";

export interface RoboVaultCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: (finalScore: number) => void;
  onSound?: (name: RoboVaultSound) => void;
  onHaptic?: (name: "death" | "clear") => void;
  /** A boss was defeated: a Master id, `rematch:<Master id>` in the castle rematch room, or `sam` (final phase). */
  onBossDefeated?: (boss: string) => void;
  /** Which looping track the platform should play: the boss track during boss fights. */
  onMusic?: (track: "stage" | "boss") => void;
}

type Screen =
  | "title"
  | "password"
  | "select"
  | "stage"
  | "castle"
  | "victory"
  | "confirm-delete";
type Phase = "ready" | "play" | "dying" | "win";
type EShotKind = "ice" | "fire" | "bubble" | "blade" | "round";
type BossId = MasterId | "sam";

interface Body extends Rect {
  vx: number;
  vy: number;
}
interface Hero extends Body {
  crouching: boolean;
  onGround: boolean;
  facing: 1 | -1;
  hp: number;
  invuln: number;
  hurtT: number;
  shootCd: number;
  coyote: number;
  standing: Plat | null;
}
interface Enemy extends Body {
  kind: EnemyKind;
  hp: number;
  dir: 1 | -1;
  t: number;
  fireT: number;
  flash: number;
  baseY: number;
  onGround: boolean;
}
interface Plat extends Rect {
  cx: number;
  range: number;
  phase: number;
}
interface Shot extends Body {
  weapon: WeaponId;
  ay: number;
  age: number;
  life: number;
  baseY: number;
  baseX: number;
  up: boolean;
  pierce: boolean;
}
interface EShot extends Body {
  ay: number;
  dmg: number;
  life: number;
  kind: EShotKind;
}
interface Pickup extends Body {
  kind: "hp" | "we" | "life";
  life: number;
  fixed: boolean;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  max: number;
  color: string;
  size: number;
}
interface Boss extends Body {
  id: BossId;
  samPhase: 1 | 2;
  hp: number;
  maxHp: number;
  dir: 1 | -1;
  state: "idle" | "jump" | "dash" | "shoot" | "hover" | "swoop";
  t: number;
  onGround: boolean;
  flash: number;
  active: boolean;
  introT: number;
  /** Length of the current intro and how many health segments the fill animation has shown. */
  introTotal: number;
  shown: number;
  dead: boolean;
  deadT: number;
  actIdx: number;
  shotsLeft: number;
  shotTimer: number;
  hoverT: number;
  swoop: { sx: number; sy: number; tx: number; ty: number } | null;
}
interface Spawn {
  ch: string;
  col: number;
  row: number;
}
interface LoadedLevel {
  def: LevelDef;
  grid: string[][];
  w: number;
  spawns: Spawn[];
  layer: HTMLCanvasElement;
  far: { x: number; w: number; h: number }[];
  pal: Palette;
  roomX: number;
}
interface GroundAI {
  speed: number;
  jumpV: number;
  dash: number;
  rest: number;
  actions: ("dash" | "shoot" | "jump" | "walk")[];
  burst: number;
  burstGap: number;
}

const GROUND_AI: Record<string, GroundAI> = {
  frostbyte: { speed: 140, jumpV: -700, dash: 330, rest: 0.7, actions: ["dash", "shoot", "jump", "shoot"], burst: 1, burstGap: 0 },
  embercore: { speed: 120, jumpV: -860, dash: 0, rest: 0.6, actions: ["jump", "shoot", "jump", "walk"], burst: 2, burstGap: 0.28 },
  tidebreaker: { speed: 130, jumpV: -760, dash: 0, rest: 0.8, actions: ["walk", "shoot", "jump", "shoot"], burst: 1, burstGap: 0 },
  sam: { speed: 120, jumpV: -820, dash: 0, rest: 0.55, actions: ["walk", "shoot", "jump", "shoot"], burst: 3, burstGap: 0.2 },
};

const ESHOT_COLOR: Record<EShotKind, string> = {
  ice: "#bfefff",
  fire: "#ff8a2a",
  bubble: "#6fc0ff",
  blade: "#c8ffb0",
  round: "#ff5ab0",
};

const GAME_KEYS = new Set([
  "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "Enter",
  "KeyA", "KeyD", "KeyW", "KeyS", "KeyX", "KeyJ", "KeyQ", "KeyE",
]);
const LEFT_KEYS = ["ArrowLeft", "KeyA"];
const RIGHT_KEYS = ["ArrowRight", "KeyD"];
const JUMP_KEYS = ["Space"];
/** Held with shoot: fire straight up (up is not jump). */
const UP_KEYS = ["ArrowUp", "KeyW"];
/** Held on the ground: crouch. With shoot the shot flies low, at small enemies. */
const DOWN_KEYS = ["ArrowDown", "KeyS"];
const SHOOT_KEYS = ["KeyX", "KeyJ"];
const FONT = '"Courier New", monospace';

const HERO_SHOT_CD = 0.18;
const READY_TIME = 1.1;
const DEATH_TIME = 1.4;
const CONTACT_DMG = 3;
const BOSS_CONTACT_DMG = 4;
const SPAWN_CHARS = "ScwhtfmouBE";

export class RoboVaultEngine {
  /** Drawing target of the scene: the visible canvas, or `buf` while a filter skin is on. */
  private ctx: CanvasRenderingContext2D;
  private readonly screenCtx: CanvasRenderingContext2D;
  private buf: HTMLCanvasElement | null = null;
  private bufCtx: CanvasRenderingContext2D | null = null;
  private skinFilter = "none";
  private readonly rng = makeRng(0x5a17c0de);
  private readonly sprites = new Map<string, HTMLCanvasElement>();
  private readonly keys = new Set<string>();

  private started = false;
  private paused = false;
  private over = false;
  private raf = 0;
  private lastTs = 0;
  private time = 0;

  // Progress and run state
  private progress: Progress = emptyProgress();
  private score = 0;
  private lives = START_LIVES;
  private nextLife = EXTRA_LIFE_EVERY;
  private lastScore = -1;
  private lastLives = -1;
  private lastLevel = -1;

  // Menus
  private screen: Screen = "title";
  private prevScreen: Screen = "title";
  private titleCursor = 0;
  private selCursor = 0;
  private toast = "";
  private toastT = 0;
  private confirmCursor = 0;
  private pwMode: "enter" | "show" = "enter";
  private pwGrid: PasswordGrid = new Array<boolean>(25).fill(false);
  private pwRow = 0;
  private pwCol = 0;
  private pwMsgT = 0;
  private pwMsg = "";
  private pasteListening = false;
  private pwTitle = "";
  private pwNext: Screen = "select";
  /** Password screen (show mode) and victory screen: 0 = CONTINUE / FINISH, 1 = COPY. */
  private pwShowCursor = 0;
  private copyMsg = "";
  private copyMsgT = 0;

  // Play state
  private stageId: StageId = "frostbyte";
  private lv: LoadedLevel | null = null;
  private phase: Phase = "ready";
  private phaseT = 0;
  private hero: Hero = this.newHero(0, 0);
  private enemies: Enemy[] = [];
  private plats: Plat[] = [];
  private shots: Shot[] = [];
  private eshots: EShot[] = [];
  private pickups: Pickup[] = [];
  private particles: Particle[] = [];
  private boss: Boss | null = null;
  private camX = 0;
  private checkpoint: { x: number; y: number } | null = null;
  private bossMusic = false;
  private gateClosed = false;
  private bossTriggered = false;
  private weapon: WeaponId = "buster";
  private energy: Record<WeaponId, number> = this.fullEnergy();
  private jumpBuf = 0;
  private rematchIdx = 0;
  private winText = "";
  private winColor = "#fff";

  private readonly canvas: HTMLCanvasElement;

  constructor(
    canvas: HTMLCanvasElement,
    private readonly cb: RoboVaultCallbacks,
    options: { skin?: RoboVaultSkinId } = {},
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas not available");
    this.canvas = canvas;
    this.ctx = ctx;
    this.screenCtx = ctx;
    this.setSkin(options.skin ?? DEFAULT_SKIN);
    canvas.width = W;
    canvas.height = H;
    ctx.imageSmoothingEnabled = false;
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
    this.lastTs = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  pause(): void {
    if (!this.started || this.over || this.paused) return;
    this.paused = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.keys.clear();
    this.jumpBuf = 0;
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

  /**
   * Applies a skin at once (also paused or after game over). The filter runs in the
   * 2D context when the scene is copied to the visible canvas: a CSS filter on the
   * element forces a full filtered layer every frame, which is slow without GPU raster.
   */
  setSkin(skin: RoboVaultSkinId): void {
    const filter = (SKINS[skin] ?? SKINS[DEFAULT_SKIN]).filter;
    this.skinFilter = filter;
    if (filter !== "none" && !this.buf) {
      const buf = document.createElement("canvas");
      buf.width = W;
      buf.height = H;
      const bctx = buf.getContext("2d");
      if (bctx) {
        bctx.imageSmoothingEnabled = false;
        this.buf = buf;
        this.bufCtx = bctx;
      }
    }
    if (this.started) this.draw();
  }

  destroy(): void {
    this.over = true;
    this.teardown();
  }

  // ---------------------------------------------------------------- lifecycle

  private teardown(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.stopPasteListener();
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onBlur);
    this.keys.clear();
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
    this.time += dt;
    this.update(dt);
    if (!this.over) this.draw();
  };

  private onBlur = (): void => {
    this.keys.clear();
    this.jumpBuf = 0;
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
    const level = levelOf(this.progress);
    if (level !== this.lastLevel) {
      this.lastLevel = level;
      this.cb.onLevel(level);
    }
  }
  private sound(name: RoboVaultSound): void {
    this.cb.onSound?.(name);
  }

  private addScore(points: number): void {
    this.score = clampScore(this.score + Math.round(points));
    while (this.score >= this.nextLife) {
      if (this.lives < MAX_LIVES) {
        this.lives += 1;
        this.sound("pickup");
      }
      this.nextLife += EXTRA_LIFE_EVERY;
    }
    this.emitScore();
    this.emitLives();
  }

  private resetNextLife(): void {
    this.nextLife = (Math.floor(this.score / EXTRA_LIFE_EVERY) + 1) * EXTRA_LIFE_EVERY;
  }

  // ---------------------------------------------------------------- input

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.over || this.paused) return;
    const code = e.code;
    if (GAME_KEYS.has(code)) e.preventDefault();
    this.keys.add(code);
    if (this.screen === "stage" || this.screen === "castle") {
      if (e.repeat) return;
      if (JUMP_KEYS.includes(code)) this.jumpBuf = 0.12;
      if (code === "KeyQ") this.cycleWeapon(-1);
      if (code === "KeyE") this.cycleWeapon(1);
      return;
    }
    this.menuKey(code, e.repeat);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private held(codes: string[]): boolean {
    return codes.some((c) => this.keys.has(c));
  }

  private menuKey(code: string, repeat: boolean): void {
    const up = code === "ArrowUp" || code === "KeyW";
    const down = code === "ArrowDown" || code === "KeyS";
    const left = code === "ArrowLeft" || code === "KeyA";
    const right = code === "ArrowRight" || code === "KeyD";
    const ok = !repeat && (code === "Space" || code === "Enter");
    const back = !repeat && (code === "KeyX" || code === "KeyJ");
    switch (this.screen) {
      case "title": this.titleKey(up, down, ok); break;
      case "select": this.selectKey(up, down, left, right, ok, back); break;
      case "password": this.passwordKey(up, down, left, right, ok, back); break;
      case "confirm-delete": this.confirmKey(left, right, ok, back); break;
      case "victory":
        if (up || down || left || right) { this.pwShowCursor = this.pwShowCursor === 0 ? 1 : 0; this.sound("select"); }
        if (ok) { if (this.pwShowCursor === 1) this.copyPassword(); else this.finish(); }
        break;
      default: break;
    }
  }

  private titleItems(): string[] {
    const items = [this.hasProgress() ? "CONTINUE" : "NEW GAME", "PASSWORD"];
    if (this.hasProgress()) items.push("DELETE PROGRESS");
    return items;
  }

  private hasProgress(): boolean {
    const p = this.progress;
    return p.masters.some(Boolean) || p.castleRooms > 0 || p.cleared || this.score > 0;
  }

  private titleKey(up: boolean, down: boolean, ok: boolean): void {
    const n = this.titleItems().length;
    if (up) { this.titleCursor = (this.titleCursor + n - 1) % n; this.sound("select"); }
    if (down) { this.titleCursor = (this.titleCursor + 1) % n; this.sound("select"); }
    if (!ok) return;
    this.sound("select");
    if (this.titleCursor === 0) {
      this.screen = "select";
    } else if (this.titleCursor === 1) {
      this.openPasswordEntry();
    } else {
      this.openConfirmDelete("title");
    }
  }

  private selectKey(up: boolean, down: boolean, left: boolean, right: boolean, ok: boolean, back: boolean): void {
    const c = this.selCursor;
    if (left && c % 3 > 0) { this.selCursor = c - 1; this.sound("select"); }
    if (right && c % 3 < 2) { this.selCursor = c + 1; this.sound("select"); }
    if (up && c >= 3) { this.selCursor = c - 3; this.sound("select"); }
    if (down && c < 3) { this.selCursor = c + 3; this.sound("select"); }
    if (back) { this.sound("select"); this.titleCursor = 0; this.screen = "title"; return; }
    if (!ok) return;
    if (c < 4) {
      if (this.progress.masters[c]) { this.setToast("ALREADY DEFEATED"); return; }
      this.sound("select");
      this.startStage(MASTERS[c].id);
    } else if (c === 4) {
      const p = this.progress;
      if (!p.masters.every(Boolean)) { this.setToast("DEFEAT ALL 4 MASTERS FIRST"); return; }
      if (p.cleared) { this.setToast("SAM IS DEFEATED"); return; }
      this.sound("select");
      this.startStage(this.castleStage());
    } else {
      this.sound("select");
      this.openConfirmDelete("select");
    }
  }

  private castleStage(): StageId {
    const rooms = this.progress.castleRooms;
    return rooms === 0 ? "castle1" : rooms === 1 ? "castle2" : rooms === 2 ? "castle3" : "sam";
  }

  private setToast(text: string): void {
    this.toast = text;
    this.toastT = 1.8;
    this.sound("hit");
  }

  private openPasswordEntry(): void {
    this.pwMode = "enter";
    this.pwGrid = new Array<boolean>(25).fill(false);
    this.pwRow = 0;
    this.pwCol = 0;
    this.pwMsgT = 0;
    this.pwMsg = "";
    this.pwNext = "title";
    this.screen = "password";
    this.startPasteListener();
  }

  // Ctrl+V works only while the password entry screen is open; the listener is removed on every way out.
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
    if (this.over || this.screen !== "password" || this.pwMode !== "enter") return;
    const text = e.clipboardData?.getData("text") ?? "";
    e.preventDefault();
    this.applyPasted(text);
  };

  /** Fills the grid from pasted cell labels. Only fills: the player confirms with OK. */
  private applyPasted(text: string): void {
    const grid = parsePasswordText(text);
    if (!grid) {
      this.pwMsg = "NOT A PASSWORD";
      this.pwMsgT = 2;
      this.sound("hit");
      return;
    }
    this.pwGrid = grid;
    this.pwMsg = "PASTED";
    this.pwMsgT = 1.5;
    this.sound("pickup");
  }

  private pasteFromClipboard(): void {
    const nav = typeof navigator !== "undefined" ? navigator : null;
    const fail = () => {
      this.pwMsg = "PRESS CTRL+V";
      this.pwMsgT = 2.5;
    };
    if (!nav?.clipboard?.readText) {
      fail();
      return;
    }
    nav.clipboard.readText().then(
      (text) => {
        if (this.screen === "password" && this.pwMode === "enter" && !this.over) this.applyPasted(text);
      },
      fail,
    );
  }

  private passwordKey(up: boolean, down: boolean, left: boolean, right: boolean, ok: boolean, back: boolean): void {
    if (this.pwMode === "show") {
      if (up || down || left || right) { this.pwShowCursor = this.pwShowCursor === 0 ? 1 : 0; this.sound("select"); }
      if (!ok) return;
      if (this.pwShowCursor === 1) { this.copyPassword(); return; }
      this.sound("select");
      this.screen = this.pwNext;
      return;
    }
    const rows = 6;
    if (up) { this.pwRow = (this.pwRow + rows - 1) % rows; this.sound("select"); }
    if (down) { this.pwRow = (this.pwRow + 1) % rows; this.sound("select"); }
    const cols = this.pwRow === 5 ? 3 : 5;
    if (left) { this.pwCol = (this.pwCol + cols - 1) % cols; this.sound("select"); }
    if (right) { this.pwCol = (this.pwCol + 1) % cols; this.sound("select"); }
    if (this.pwCol >= cols) this.pwCol = cols - 1;
    if (back) { this.pwGrid = new Array<boolean>(25).fill(false); this.sound("select"); return; }
    if (!ok) return;
    if (this.pwRow < 5) {
      const i = this.pwRow * 5 + this.pwCol;
      this.pwGrid[i] = !this.pwGrid[i];
      this.sound("select");
    } else if (this.pwCol === 0) {
      this.pasteFromClipboard();
    } else if (this.pwCol === 2) {
      this.sound("select");
      this.titleCursor = 1;
      this.stopPasteListener();
      this.screen = "title";
    } else {
      const decoded = decodePassword(this.pwGrid);
      if (!decoded) { this.pwMsg = "WRONG PASSWORD"; this.pwMsgT = 2; this.sound("hit"); return; }
      this.stopPasteListener();
      this.progress = decoded;
      this.score = decoded.score;
      this.resetNextLife();
      this.emitScore();
      this.emitLevel();
      this.sound("weapon");
      this.selCursor = 0;
      this.screen = "select";
    }
  }

  /** Copies the filled cell labels (e.g. "A2 A3 B1") to the clipboard. */
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
    if (this.confirmCursor === 1) this.deleteProgress();
    this.screen = this.prevScreen;
    if (this.screen === "title") this.titleCursor = 0;
  }

  private deleteProgress(): void {
    this.progress = emptyProgress();
    this.weapon = "buster";
    this.score = 0;
    this.resetNextLife();
    this.emitScore();
    this.emitLevel();
  }

  // ---------------------------------------------------------------- weapons

  private unlockedWeapons(): WeaponId[] {
    const list: WeaponId[] = ["buster"];
    MASTERS.forEach((m, i) => {
      if (this.progress.masters[i]) list.push(m.weapon);
    });
    return WEAPON_ORDER.filter((w) => list.includes(w));
  }

  private cycleWeapon(dir: 1 | -1): void {
    const list = this.unlockedWeapons();
    if (list.length < 2) return;
    const i = list.indexOf(this.weapon);
    this.weapon = list[(i + dir + list.length) % list.length];
    this.sound("select");
  }

  private fullEnergy(): Record<WeaponId, number> {
    return { buster: 0, frost: WEAPON_ENERGY, ember: WEAPON_ENERGY, gale: WEAPON_ENERGY, tide: WEAPON_ENERGY };
  }

  // ---------------------------------------------------------------- level loading

  private newHero(x: number, y: number): Hero {
    return {
      x, y, w: HERO_W, h: HERO_H, vx: 0, vy: 0, crouching: false, onGround: false, facing: 1,
      hp: HERO_HP, invuln: 0, hurtT: 0, shootCd: 0, coyote: 0, standing: null,
    };
  }

  private loadLevel(id: StageId): LoadedLevel {
    const def = buildLevel(id);
    const grid = def.rows.map((r) => r.split(""));
    const spawns: Spawn[] = [];
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const ch = grid[r][c];
        if (SPAWN_CHARS.includes(ch)) {
          spawns.push({ ch, col: c, row: r });
          grid[r][c] = ".";
        }
      }
    }
    const pal = PALETTES[id];
    const w = grid[0].length * TILE;
    const far: LoadedLevel["far"] = [];
    const rng = makeRng(id.length * 7919);
    for (let x = 0; x < w * 0.5 + W; x += 60 + Math.floor(rng() * 120)) {
      far.push({ x, w: 50 + Math.floor(rng() * 110), h: 90 + Math.floor(rng() * 230) });
    }
    const roomX = def.bossCol !== null ? def.bossCol * TILE : 0;
    return { def, grid, w, spawns, layer: this.renderLayer(grid, spawns, pal), far, pal, roomX };
  }

  private renderLayer(grid: string[][], spawns: Spawn[], pal: Palette): HTMLCanvasElement {
    const layer = document.createElement("canvas");
    layer.width = grid[0].length * TILE;
    layer.height = H;
    const g = layer.getContext("2d");
    if (!g) return layer;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const ch = grid[r][c];
        const x = c * TILE;
        const y = r * TILE;
        if (ch === "#" || ch === "I") {
          g.fillStyle = pal.tile;
          g.fillRect(x, y, TILE, TILE);
          g.fillStyle = pal.tileDark;
          g.fillRect(x, y + TILE - 6, TILE, 6);
          g.fillRect(x + TILE - 4, y, 4, TILE);
          g.fillRect(x + 10, y + 16, 12, 4);
          if (!isSolidChar(tileAt(grid, c, r - 1))) {
            g.fillStyle = pal.tileTop;
            g.fillRect(x, y, TILE, 8);
          }
          if (ch === "I") {
            g.fillStyle = "rgba(255,255,255,0.35)";
            g.fillRect(x + 6, y + 12, 10, 3);
            g.fillRect(x + 26, y + 28, 12, 3);
          }
        } else if (ch === "^") {
          g.fillStyle = pal.hazard;
          for (let i = 0; i < 3; i++) {
            g.beginPath();
            g.moveTo(x + i * 16, y + TILE);
            g.lineTo(x + i * 16 + 8, y + 12);
            g.lineTo(x + i * 16 + 16, y + TILE);
            g.closePath();
            g.fill();
          }
        } else if (ch === "L") {
          g.fillStyle = pal.hazard;
          g.fillRect(x, y, TILE, TILE);
          g.fillStyle = pal.accent2;
          g.fillRect(x, y, TILE, 6);
          g.fillStyle = "rgba(255,255,255,0.25)";
          g.fillRect(x + 8, y + 18, 14, 4);
          g.fillRect(x + 28, y + 32, 12, 4);
        } else if (ch === "~") {
          g.fillStyle = "rgba(58,160,255,0.2)";
          g.fillRect(x, y, TILE, TILE);
        }
      }
    }
    for (const s of spawns) {
      if (s.ch === "E") {
        const x = s.col * TILE;
        const y = s.row * TILE - TILE;
        g.fillStyle = "#050c0a";
        g.fillRect(x, y, TILE, TILE * 2);
        g.strokeStyle = pal.accent2;
        g.lineWidth = 4;
        g.strokeRect(x + 2, y + 2, TILE - 4, TILE * 2 - 4);
        g.fillStyle = pal.accent;
        g.fillRect(x + 20, y + 10, 8, TILE * 2 - 20);
      }
    }
    return layer;
  }

  private startStage(id: StageId): void {
    this.stageId = id;
    this.lv = this.loadLevel(id);
    this.screen = MASTERS.some((m) => m.id === id) ? "stage" : "castle";
    this.weapon = "buster";
    this.energy = this.fullEnergy();
    this.checkpoint = null;
    this.setBossMusic(false);
    this.rematchIdx = 0;
    this.camX = 0;
    this.resetWorld();
  }

  /** (Re)builds hero, enemies, platforms and boss from the level markers. */
  private resetWorld(bossRetry = false): void {
    const lv = this.lv;
    if (!lv) return;
    this.setBossMusic(false);
    this.enemies = [];
    this.plats = [];
    this.shots = [];
    this.eshots = [];
    this.pickups = [];
    this.particles = [];
    this.boss = null;
    this.gateClosed = false;
    this.bossTriggered = false;
    this.jumpBuf = 0;
    const start = lv.spawns.find((s) => s.ch === "S");
    const hx = this.checkpoint ? this.checkpoint.x : (start ? start.col * TILE + 9 : 60);
    const hy = this.checkpoint ? this.checkpoint.y : (start ? (start.row + 1) * TILE - HERO_H : 400);
    this.hero = this.newHero(hx, hy);
    for (const s of lv.spawns) {
      const x = s.col * TILE;
      const y = s.row * TILE;
      if (s.ch === "w" || s.ch === "h" || s.ch === "t" || s.ch === "f") {
        const kind: EnemyKind = s.ch === "w" ? "walker" : s.ch === "h" ? "hopper" : s.ch === "t" ? "turret" : "flyer";
        const size = ENEMY_SIZE[kind];
        const hp = kind === "turret" ? 3 : kind === "flyer" ? 1 : 2;
        this.enemies.push({
          kind, x: x + (TILE - size.w) / 2, y: kind === "flyer" ? y : y + TILE - size.h,
          w: size.w, h: size.h, vx: 0, vy: 0, hp, dir: -1, t: 0.5 + (s.col % 5) * 0.2,
          fireT: 1 + (s.col % 3) * 0.4, flash: 0, baseY: y, onGround: false,
        });
      } else if (s.ch === "m") {
        this.plats.push({ x, y, w: 96, h: 16, cx: x + TILE / 2 - 48, range: 72, phase: s.col });
      } else if (s.ch === "o" || s.ch === "u") {
        this.pickups.push({
          x: x + 15, y: y + 15, w: 18, h: 18, vx: 0, vy: 0,
          kind: s.ch === "o" ? "hp" : "life", life: 9999, fixed: true,
        });
      }
    }
    for (const p of this.plats) p.x = p.cx + Math.sin(p.phase) * p.range;
    const spot = lv.spawns.find((s) => s.ch === "B");
    if (lv.def.arena) {
      const id = this.arenaBossId();
      const hp = this.stageId === "castle2" ? BOSS_HP_REMATCH : SAM_HP;
      if (spot) this.boss = this.makeBoss(id, hp, spot, 1);
      this.activateBoss(1.4);
    } else if (spot && lv.def.bossCol !== null) {
      const master = MASTERS.find((m) => m.id === this.stageId);
      if (master) this.boss = this.makeBoss(master.id, BOSS_HP, spot, 1);
    }
    if (bossRetry && lv.def.bossCol !== null && this.boss) {
      // Died in the boss room: start again at the beginning of the boss fight.
      this.hero.x = lv.def.bossCol * TILE + 24;
      this.hero.y = 10 * TILE - HERO_H;
      this.gateClosed = true;
      this.activateBoss(1.6);
      this.camX = lv.roomX;
    }
    this.phase = "ready";
    this.phaseT = READY_TIME;
    this.updateCamera(1);
  }

  private arenaBossId(): BossId {
    return this.stageId === "castle2" ? MASTERS[this.rematchIdx].id : "sam";
  }

  private makeBoss(id: BossId, hp: number, spot: Spawn, samPhase: 1 | 2): Boss {
    const size = id === "sam" ? (samPhase === 1 ? SAM_SAUCER_SIZE : SAM_MECH_SIZE) : MASTER_SIZE;
    const flying = id === "galeforce" || (id === "sam" && samPhase === 1);
    const b: Boss = {
      id, samPhase, hp, maxHp: hp, dir: -1, state: flying ? "hover" : "idle", t: 0.6,
      x: spot.col * TILE + (TILE - size.w) / 2, y: (spot.row + 1) * TILE - size.h,
      w: size.w, h: size.h, vx: 0, vy: 0, onGround: false, flash: 0, active: false,
      introT: 0, introTotal: 0, shown: 0, dead: false, deadT: 0, actIdx: 0, shotsLeft: 0, shotTimer: 0,
      hoverT: 0, swoop: null,
    };
    if (flying) {
      const hv = this.hoverPos(b);
      b.x = hv.x;
      b.y = hv.y;
    }
    return b;
  }

  private setBossMusic(on: boolean): void {
    if (this.bossMusic === on) return;
    this.bossMusic = on;
    this.cb.onMusic?.(on ? "boss" : "stage");
  }

  private activateBoss(intro: number): void {
    this.bossTriggered = true;
    this.setBossMusic(true);
    // The boss room is a clean arena: every other enemy and projectile goes away.
    this.enemies = [];
    this.eshots = [];
    if (this.boss) {
      this.boss.active = true;
      this.boss.introT = intro;
      this.boss.introTotal = intro;
      this.boss.shown = 0;
    }
  }

  // ---------------------------------------------------------------- update

  private update(dt: number): void {
    if (this.toastT > 0) this.toastT -= dt;
    if (this.pwMsgT > 0) this.pwMsgT -= dt;
    if (this.copyMsgT > 0) this.copyMsgT -= dt;
    if (this.screen !== "stage" && this.screen !== "castle") return;
    this.updatePlay(dt);
  }

  private updatePlay(dt: number): void {
    const lv = this.lv;
    if (!lv) return;
    if (this.phase === "ready") {
      this.phaseT -= dt;
      this.updatePlatforms();
      if (this.phaseT <= 0) this.phase = "play";
      this.updateCamera(dt);
      return;
    }
    if (this.phase === "dying") {
      this.phaseT -= dt;
      this.updateParticles(dt);
      if (this.phaseT <= 0) this.afterDeath();
      return;
    }
    if (this.phase === "win") {
      this.phaseT -= dt;
      this.updateParticles(dt);
      if (this.phaseT <= 0) this.finishWin();
      return;
    }
    this.updatePlatforms();
    this.updateHero(dt);
    if (this.phase !== "play") return;
    this.updateEnemies(dt);
    this.updateBoss(dt);
    this.updateShots(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.checkTriggers();
    this.updateCamera(dt);
  }

  private controlLocked(): boolean {
    return this.phase !== "play" || (this.boss !== null && this.boss.active && this.boss.introT > 0);
  }

  // Collision ---------------------------------------------------------

  private collides(e: Rect): boolean {
    const lv = this.lv;
    if (!lv) return false;
    const c0 = Math.floor(e.x / TILE);
    const c1 = Math.floor((e.x + e.w - 0.01) / TILE);
    const r0 = Math.floor(e.y / TILE);
    const r1 = Math.floor((e.y + e.h - 0.01) / TILE);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (isSolidChar(tileAt(lv.grid, c, r))) return true;
      }
    }
    if (this.gateClosed && lv.def.bossCol !== null) {
      const gx = (lv.def.bossCol - 1) * TILE;
      if (e.x < gx + TILE && e.x + e.w > gx && e.y < 10 * TILE) return true;
    }
    return false;
  }

  /** Moves in sub-steps; returns true when blocked by a wall. */
  private moveX(e: Body, dx: number): boolean {
    if (dx === 0) return false;
    const steps = Math.ceil(Math.abs(dx) / MAX_STEP);
    const sx = dx / steps;
    for (let i = 0; i < steps; i++) {
      e.x += sx;
      if (this.collides(e)) {
        e.x -= sx;
        e.vx = 0;
        return true;
      }
    }
    return false;
  }

  /** Moves in sub-steps; returns "down" when landing, "up" when hitting a ceiling. */
  private moveY(e: Body, dy: number): "down" | "up" | null {
    if (dy === 0) return null;
    const steps = Math.ceil(Math.abs(dy) / MAX_STEP);
    const sy = dy / steps;
    for (let i = 0; i < steps; i++) {
      e.y += sy;
      if (this.collides(e)) {
        if (sy > 0) {
          const row = Math.floor((e.y + e.h - 0.01) / TILE);
          e.y = row * TILE - e.h;
          e.vy = 0;
          return "down";
        }
        const row = Math.floor(e.y / TILE);
        e.y = (row + 1) * TILE;
        e.vy = 0;
        return "up";
      }
    }
    return null;
  }

  // Platforms ----------------------------------------------------------

  private updatePlatforms(): void {
    for (const p of this.plats) {
      const nx = p.cx + Math.sin(this.time * 1.1 + p.phase) * p.range;
      const dx = nx - p.x;
      p.x = nx;
      if (this.hero.standing === p && dx !== 0) this.moveX(this.hero, dx);
    }
  }

  // Hero ---------------------------------------------------------------

  private updateHero(dt: number): void {
    const h = this.hero;
    const lv = this.lv;
    if (!lv) return;
    h.invuln = Math.max(0, h.invuln - dt);
    h.hurtT = Math.max(0, h.hurtT - dt);
    h.shootCd = Math.max(0, h.shootCd - dt);
    this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    h.coyote = h.onGround ? 0.08 : Math.max(0, h.coyote - dt);
    const locked = this.controlLocked();
    this.setCrouch(
      !locked && h.onGround && h.hurtT <= 0 && this.jumpBuf <= 0 && this.held(DOWN_KEYS) && !this.held(UP_KEYS),
    );
    const dirIn = locked ? 0 : (this.held(RIGHT_KEYS) ? 1 : 0) - (this.held(LEFT_KEYS) ? 1 : 0);

    if (h.hurtT <= 0) {
      if (dirIn !== 0) h.facing = dirIn as 1 | -1;
      const target = (h.crouching ? 0 : dirIn) * RUN_SPEED;
      const below = tileAt(lv.grid, Math.floor((h.x + h.w / 2) / TILE), Math.floor((h.y + h.h + 1) / TILE));
      if (below === "I" && h.onGround) h.vx += (target - h.vx) * Math.min(1, 3 * dt);
      else h.vx = target;
    } else {
      h.vx *= 1 - Math.min(1, 6 * dt);
    }

    if (!locked && this.jumpBuf > 0 && (h.onGround || h.coyote > 0) && h.hurtT <= 0) {
      h.vy = JUMP_V;
      h.onGround = false;
      h.coyote = 0;
      this.jumpBuf = 0;
      this.sound("jump");
    }
    if (!this.held(JUMP_KEYS) && h.vy < JUMP_CUT_V) h.vy = JUMP_CUT_V;
    h.vy = Math.min(MAX_FALL, h.vy + GRAVITY * dt);

    h.standing = null;
    this.moveX(h, h.vx * dt);
    const prevBottom = h.y + h.h;
    h.onGround = false;
    const res = this.moveY(h, h.vy * dt);
    if (res === "down") h.onGround = true;
    if (h.vy >= 0) {
      for (const p of this.plats) {
        if (h.x + h.w > p.x && h.x < p.x + p.w && prevBottom <= p.y + 6 && h.y + h.h >= p.y) {
          h.y = p.y - h.h;
          h.vy = 0;
          h.onGround = true;
          h.standing = p;
        }
      }
    }
    if (h.x < 0) h.x = 0;

    if (!locked && h.hurtT <= 0 && this.held(SHOOT_KEYS) && h.shootCd <= 0) this.fireHero();

    // Hazards and pits
    const hit = { x: h.x + 8, y: h.y + 8, w: h.w - 16, h: h.h - 12 };
    const c0 = Math.floor(hit.x / TILE);
    const c1 = Math.floor((hit.x + hit.w) / TILE);
    const r0 = Math.floor(hit.y / TILE);
    const r1 = Math.floor((hit.y + hit.h) / TILE);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const ch = tileAt(lv.grid, c, r);
        if (!isHazardChar(ch)) continue;
        // Spikes only fill the lower part of their tile; lava fills it all.
        const top = ch === "^" ? 18 : 6;
        if (rectsOverlap(hit, { x: c * TILE + 4, y: r * TILE + top, w: TILE - 8, h: TILE - top })) {
          this.killHero();
          return;
        }
      }
    }
    if (h.y > H + 40) { this.killHero(); return; }

    // Enemy and boss contact
    if (h.invuln <= 0) {
      const box = { x: h.x + 4, y: h.y + 4, w: h.w - 8, h: h.h - 6 };
      for (const e of this.enemies) {
        if (rectsOverlap(box, e)) { this.hurtHero(CONTACT_DMG); break; }
      }
      const b = this.boss;
      if (h.invuln <= 0 && b && b.active && b.introT <= 0 && !b.dead && rectsOverlap(box, b)) {
        this.hurtHero(BOSS_CONTACT_DMG);
      }
    }
  }

  /** Crouching shrinks the hitbox from the top; standing up needs room above. */
  private setCrouch(on: boolean): void {
    const h = this.hero;
    const diff = HERO_H - CROUCH_H;
    if (on && !h.crouching) {
      h.y += diff;
      h.h = CROUCH_H;
      h.crouching = true;
    } else if (!on && h.crouching) {
      if (!this.collides({ x: h.x, y: h.y - diff, w: h.w, h: HERO_H })) {
        h.y -= diff;
        h.h = HERO_H;
        h.crouching = false;
      }
    }
  }

  private hurtHero(dmg: number): void {
    const h = this.hero;
    if (h.invuln > 0 || this.phase !== "play") return;
    if (this.boss?.dead) return;
    h.hp -= dmg * this.damageTakenFactor();
    this.sound("hit");
    if (h.hp <= 0) { this.killHero(); return; }
    h.invuln = 1.2;
    h.hurtT = 0.3;
    h.vy = -220;
    h.vx = -h.facing * 140;
  }

  /** 1 with no Master defeated, 0.6 with all four (10% less damage per Master). */
  private damageTakenFactor(): number {
    return 1 - DAMAGE_REDUCTION_PER_MASTER * this.progress.masters.filter(Boolean).length;
  }

  private killHero(): void {
    if (this.phase === "dying") return;
    const h = this.hero;
    h.hp = 0;
    this.phase = "dying";
    this.phaseT = DEATH_TIME;
    this.sound("death");
    this.cb.onHaptic?.("death");
    this.explode(h.x + h.w / 2, h.y + h.h / 2, "#00f5ff", 22);
    this.explode(h.x + h.w / 2, h.y + h.h / 2, "#ffffff", 10);
  }

  private afterDeath(): void {
    this.lives -= 1;
    this.emitLives();
    if (this.lives <= 0) {
      this.sound("gameover");
      this.finish();
      return;
    }
    this.energy = this.fullEnergy();
    this.resetWorld(this.bossTriggered && this.lv !== null && this.lv.def.bossCol !== null);
  }

  private fireHero(): void {
    const h = this.hero;
    let w = this.weapon;
    if (w !== "buster" && this.energy[w] < WEAPONS[w].cost) w = "buster";
    if (w === "buster" && this.shots.filter((s) => s.weapon === "buster").length >= 3) return;
    if (w !== "buster") this.energy[w] -= WEAPONS[w].cost;
    h.shootCd = HERO_SHOT_CD;
    const dir = h.facing;
    const up = this.held(UP_KEYS);
    // [length along travel, thickness, speed, life] per weapon.
    const spec: Record<WeaponId, [number, number, number, number]> = {
      buster: [10, 6, 520, 1.2],
      frost: [18, 10, 440, 1.4],
      ember: [16, 16, 340, 1.6],
      gale: [22, 14, 400, 1.4],
      tide: [26, 26, 280, 1.8],
    };
    const [len, thick, speed, life] = spec[w];
    // Horizontal shots leave the buster hand; upward shots leave the top of the head.
    const sw = up ? thick : len;
    const sh = up ? len : thick;
    // Upward shots leave the raised buster, on the facing side.
    const sx = up ? (dir > 0 ? h.x + h.w - 3 : h.x + 3) - sw / 2 : (dir > 0 ? h.x + h.w : h.x - sw);
    const handY = h.crouching ? h.y + 15 : h.y + 12;
    const sy = up ? h.y - sh + 4 : handY - (w === "tide" ? 10 : w === "ember" ? 6 : w === "frost" ? 2 : 0);
    this.shots.push({
      weapon: w, x: sx, y: sy, w: sw, h: sh,
      vx: up ? 0 : speed * dir,
      vy: up ? -speed : w === "ember" ? -140 : 0,
      ay: w === "ember" ? 520 : 0,
      age: 0, life, baseX: sx, baseY: sy, up, pierce: w === "tide",
    });
    this.sound("shoot");
  }

  // Enemies ------------------------------------------------------------

  private inActiveRange(x: number): boolean {
    return x > this.camX - 160 && x < this.camX + W + 160;
  }

  private updateEnemies(dt: number): void {
    const h = this.hero;
    for (const e of this.enemies) {
      e.flash = Math.max(0, e.flash - dt);
      if (!this.inActiveRange(e.x)) continue;
      const ecx = e.x + e.w / 2;
      const toHero: 1 | -1 = h.x + h.w / 2 > ecx ? 1 : -1;
      if (e.kind === "walker") {
        e.vx = e.dir * 60;
        e.vy = Math.min(MAX_FALL, e.vy + GRAVITY * dt);
        if (this.moveX(e, e.vx * dt)) e.dir = (e.dir * -1) as 1 | -1;
        const res = this.moveY(e, e.vy * dt);
        e.onGround = res === "down";
        if (e.onGround) {
          const fx = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
          const lv = this.lv;
          if (lv && !isSolidChar(tileAt(lv.grid, Math.floor(fx / TILE), Math.floor((e.y + e.h + 4) / TILE)))) {
            e.dir = (e.dir * -1) as 1 | -1;
          }
        }
      } else if (e.kind === "hopper") {
        e.vy = Math.min(MAX_FALL, e.vy + GRAVITY * dt);
        if (e.onGround) {
          e.vx = 0;
          e.t -= dt;
          e.dir = toHero;
          if (e.t <= 0) {
            e.vy = -620;
            e.vx = toHero * 90;
            e.t = 1;
            e.onGround = false;
          }
        }
        this.moveX(e, e.vx * dt);
        const res = this.moveY(e, e.vy * dt);
        if (res === "down") e.onGround = true;
        else if (res === null) e.onGround = false;
      } else if (e.kind === "turret") {
        e.dir = toHero;
        e.fireT -= dt;
        const dx = h.x + h.w / 2 - ecx;
        const dy = h.y + h.h / 2 - (e.y + e.h / 2);
        if (e.fireT <= 0 && Math.abs(dx) < 520 && Math.abs(dy) < 260 && this.inActiveRange(ecx)) {
          const len = Math.hypot(dx, dy) || 1;
          this.eshots.push({
            x: ecx - 6, y: e.y + 6, w: 12, h: 12, vx: (dx / len) * 240, vy: (dy / len) * 240,
            ay: 0, dmg: 2, life: 3, kind: "round",
          });
          e.fireT = 2;
        }
      } else {
        e.t += dt;
        const dx = h.x + h.w / 2 - ecx;
        if (Math.abs(dx) < 460) e.x += Math.sign(dx) * 80 * dt;
        e.y = e.baseY + Math.sin(e.t * 3) * 40;
        e.dir = toHero;
      }
    }
  }

  private killEnemy(e: Enemy, weapon: WeaponId): void {
    this.enemies = this.enemies.filter((x) => x !== e);
    this.explode(e.x + e.w / 2, e.y + e.h / 2, "#ffd24a", 8);
    this.sound("enemyDie");
    const master = MASTERS.find((m) => m.id === this.stageId);
    const bonus = master && isWeakness(weapon, master.id) ? SCORES.weaknessBonus : 1;
    this.addScore(SCORES.enemy * bonus);
    const r = this.rng();
    const kind: Pickup["kind"] | null = r < 0.22 ? "hp" : r < 0.34 ? "we" : r < 0.37 && this.lives < MAX_LIVES ? "life" : null;
    if (kind) {
      this.pickups.push({ x: e.x + e.w / 2 - 9, y: e.y, w: 18, h: 18, vx: 0, vy: -120, kind, life: 8, fixed: false });
    }
  }

  // Boss ---------------------------------------------------------------

  private hoverPos(b: Boss): { x: number; y: number } {
    const lv = this.lv;
    const roomX = lv ? lv.roomX : 0;
    const range = b.id === "sam" ? 280 : 220;
    return {
      x: roomX + W / 2 - b.w / 2 + Math.sin(b.hoverT * 1.1) * range,
      y: (b.id === "sam" ? 220 : 300) + Math.sin(b.hoverT * 2.1) * 20,
    };
  }

  private updateBoss(dt: number): void {
    const b = this.boss;
    if (!b) return;
    b.flash = Math.max(0, b.flash - dt);
    if (!b.active) return;
    if (b.introT > 0) {
      b.introT = Math.max(0, b.introT - dt);
      // The health bar fills over the whole intro, one tick sound per segment.
      const filled = b.introTotal > 0
        ? Math.min(b.maxHp, Math.floor(b.maxHp * (1 - b.introT / b.introTotal) + 1e-6))
        : b.maxHp;
      while (b.shown < filled) {
        b.shown += 1;
        this.sound("bossTick");
      }
      if (b.id !== "galeforce" && !(b.id === "sam" && b.samPhase === 1)) this.groundPhysics(b, dt);
      return;
    }
    if (b.dead) {
      b.deadT -= dt;
      if (this.rng() < 0.5) {
        this.explode(b.x + this.rng() * b.w, b.y + this.rng() * b.h, "#ffd24a", 3);
      }
      if (b.deadT <= 0) this.onBossGone();
      return;
    }
    const h = this.hero;
    const flying = b.id === "galeforce" || (b.id === "sam" && b.samPhase === 1);
    if (b.state !== "dash") b.dir = h.x + h.w / 2 > b.x + b.w / 2 ? 1 : -1;
    if (flying) this.updateFlyingBoss(b, dt);
    else this.updateGroundBoss(b, dt);
  }

  private groundPhysics(b: Boss, dt: number): void {
    b.vy = Math.min(MAX_FALL, b.vy + GRAVITY * dt);
    if (this.moveX(b, b.vx * dt)) b.vx = 0;
    const res = this.moveY(b, b.vy * dt);
    b.onGround = res === "down";
  }

  private updateGroundBoss(b: Boss, dt: number): void {
    const ai = GROUND_AI[b.id];
    switch (b.state) {
      case "idle":
        b.vx = 0;
        b.t -= dt;
        if (b.t <= 0) this.bossAction(b, ai);
        break;
      case "jump":
        b.t += dt;
        if (b.onGround && b.t > 0.2) { b.state = "idle"; b.t = ai.rest; b.vx = 0; }
        break;
      case "dash":
        b.t -= dt;
        b.vx = b.dir * (ai.dash || ai.speed);
        if (b.t <= 0) { b.state = "idle"; b.t = ai.rest; b.vx = 0; }
        break;
      case "shoot":
        b.vx = 0;
        b.shotTimer -= dt;
        if (b.shotTimer <= 0) {
          if (b.shotsLeft > 0) {
            this.bossShoot(b);
            b.shotsLeft -= 1;
            b.shotTimer = b.shotsLeft > 0 ? ai.burstGap : 0.4;
          } else {
            b.state = "idle";
            b.t = ai.rest;
          }
        }
        break;
      default:
        break;
    }
    this.groundPhysics(b, dt);
  }

  private bossAction(b: Boss, ai: GroundAI): void {
    const act = ai.actions[b.actIdx % ai.actions.length];
    b.actIdx += 1;
    if (act === "jump") {
      b.vy = ai.jumpV;
      b.vx = b.dir * ai.speed;
      b.onGround = false;
      b.state = "jump";
      b.t = 0;
    } else if (act === "shoot") {
      b.state = "shoot";
      b.shotsLeft = ai.burst;
      b.shotTimer = 0.3;
    } else {
      b.state = "dash";
      b.t = act === "dash" ? 0.5 : 0.8;
    }
  }

  private updateFlyingBoss(b: Boss, dt: number): void {
    b.hoverT += dt;
    if (b.state === "swoop" && b.swoop) {
      b.t -= dt;
      const p = Math.min(1, Math.max(0, 1 - b.t / 1.5));
      const ease = (v: number) => v * v * (3 - 2 * v);
      if (p < 0.5) {
        const k = ease(p * 2);
        b.x = b.swoop.sx + (b.swoop.tx - b.swoop.sx) * k;
        b.y = b.swoop.sy + (b.swoop.ty - b.swoop.sy) * k;
      } else {
        const hv = this.hoverPos(b);
        const k = ease((p - 0.5) * 2);
        b.x = b.swoop.tx + (hv.x - b.swoop.tx) * k;
        b.y = b.swoop.ty + (hv.y - b.swoop.ty) * k;
      }
      if (b.t <= 0) { b.state = "hover"; b.t = 1.1; b.swoop = null; }
      return;
    }
    const hv = this.hoverPos(b);
    b.x = hv.x;
    b.y = hv.y;
    b.t -= dt;
    if (b.t <= 0) {
      b.actIdx += 1;
      if (b.actIdx % 3 === 0) {
        const h = this.hero;
        b.swoop = { sx: b.x, sy: b.y, tx: Math.max(this.camX + 24, Math.min(this.camX + W - b.w - 24, h.x)), ty: h.y + h.h - b.h };
        b.state = "swoop";
        b.t = 1.5;
      } else {
        this.bossShoot(b);
        b.t = b.id === "sam" ? 0.9 : 1.1;
      }
    }
  }

  private bossShoot(b: Boss): void {
    const h = this.hero;
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const aim = Math.atan2(h.y + h.h / 2 - cy, h.x + h.w / 2 - cx);
    const push = (vx: number, vy: number, kind: EShotKind, ay = 0, size = 14) => {
      this.eshots.push({
        x: cx - size / 2, y: cy - size / 2, w: size, h: size, vx, vy, ay, dmg: 3, life: 4, kind,
      });
    };
    if (b.id === "frostbyte") {
      for (const a of [-0.32, 0, 0.32]) push(b.dir * Math.cos(a) * 300, Math.sin(a) * 300, "ice");
    } else if (b.id === "embercore") {
      push(Math.cos(aim) * 300, Math.sin(aim) * 300, "fire", 0, 16);
    } else if (b.id === "tidebreaker") {
      for (let i = 0; i < 3; i++) push(b.dir * (110 + i * 70), -440, "bubble", 720, 16);
    } else if (b.id === "galeforce") {
      for (const d of [-0.28, 0, 0.28]) push(Math.cos(aim + d) * 300, Math.sin(aim + d) * 300, "blade");
    } else if (b.samPhase === 1) {
      for (const d of [-0.3, 0, 0.3]) push(Math.cos(aim + d) * 280, Math.sin(aim + d) * 280, "round");
    } else {
      push(b.dir * 340, 0, "round", 0, 16);
    }
  }

  private damageBoss(b: Boss, weapon: WeaponId): void {
    if (!b.active || b.introT > 0 || b.dead) return;
    b.hp -= weaponDamage(weapon, b.id);
    b.flash = 0.12;
    if (b.hp > 0) { this.sound("bossHit"); return; }
    b.hp = 0;
    b.dead = true;
    b.deadT = 1.6;
    this.setBossMusic(false);
    // Sam's saucer phase is not a defeat on its own: only the mech phase counts.
    if (b.id !== "sam") this.cb.onBossDefeated?.(this.stageId === "castle2" ? `rematch:${b.id}` : b.id);
    else if (b.samPhase === 2) this.cb.onBossDefeated?.("sam");
    this.eshots = [];
    this.sound("bossDie");
    this.cb.onHaptic?.("clear");
  }

  /** Called when the boss explosion has finished. */
  private onBossGone(): void {
    const b = this.boss;
    if (!b) return;
    if (this.stageId === "castle2") {
      if (this.rematchIdx < 3) {
        this.rematchIdx += 1;
        const spot = this.lv?.spawns.find((s) => s.ch === "B");
        if (spot) this.boss = this.makeBoss(this.arenaBossId(), BOSS_HP_REMATCH, spot, 1);
        this.activateBoss(1.2);
        this.hero.hp = Math.min(HERO_HP, this.hero.hp + 7);
        this.energy = this.fullEnergy();
        this.sound("pickup");
      } else {
        this.boss = null;
        this.roomCleared();
      }
      return;
    }
    if (b.id === "sam") {
      if (b.samPhase === 1) {
        const spot = this.lv?.spawns.find((s) => s.ch === "B");
        if (spot) this.boss = this.makeBoss("sam", SAM_HP, spot, 2);
        this.activateBoss(1.2);
        this.sound("select");
      } else {
        this.boss = null;
        this.samDefeated();
      }
      return;
    }
    const idx = MASTERS.findIndex((m) => m.id === b.id);
    this.boss = null;
    this.progress.masters[idx] = true;
    this.addScore(SCORES.master);
    this.weapon = MASTERS[idx].weapon;
    this.winText = `GOT ${WEAPONS[MASTERS[idx].weapon].name}`;
    this.winColor = WEAPONS[MASTERS[idx].weapon].color;
    this.phase = "win";
    this.phaseT = 3;
    this.sound("weapon");
    this.emitLevel();
    this.pwTitle = `${MASTERS[idx].name} DEFEATED`;
  }

  private roomCleared(): void {
    const rooms = this.progress.castleRooms;
    this.progress.castleRooms = Math.min(3, rooms + 1) as Progress["castleRooms"];
    this.addScore(SCORES.castleRoom);
    this.cb.onHaptic?.("clear");
    this.sound("pickup");
    this.emitLevel();
    this.pwTitle = `ROOM ${rooms + 1} CLEARED`;
    this.phase = "win";
    this.phaseT = 1.6;
    this.winText = this.pwTitle;
    this.winColor = "#52f06a";
  }

  private samDefeated(): void {
    this.addScore(SCORES.sam);
    this.progress.cleared = true;
    this.progress.castleRooms = 3;
    this.progress.score = passwordScore(this.score);
    this.emitLevel();
    this.sound("victory");
    this.cb.onHaptic?.("clear");
    this.pwGrid = encodePassword(this.progress);
    this.pwShowCursor = 0;
    this.copyMsgT = 0;
    this.screen = "victory";
  }

  private finishWin(): void {
    this.progress.score = passwordScore(this.score);
    this.pwMode = "show";
    this.pwGrid = encodePassword(this.progress);
    this.pwNext = "select";
    this.pwShowCursor = 0;
    this.copyMsgT = 0;
    this.selCursor = 0;
    this.screen = "password";
    this.lv = null;
  }

  // Shots, pickups, particles -------------------------------------------

  private updateShots(dt: number): void {
    const lv = this.lv;
    if (!lv) return;
    const boss = this.boss;
    for (const s of this.shots) {
      s.age += dt;
      s.vy += s.ay * dt;
      s.x += s.vx * dt;
      if (s.weapon === "gale" || s.weapon === "tide") {
        // Wave and bob shots travel straight and wiggle across their path.
        const wiggle = s.weapon === "gale" ? Math.sin(s.age * 11) * 34 : Math.sin(s.age * 6) * 10;
        if (s.up) {
          s.y += s.vy * dt;
          s.x = s.baseX + wiggle;
        } else {
          s.y = s.baseY + wiggle;
        }
      } else {
        s.y += s.vy * dt;
      }
      if (s.age > s.life) { s.life = -1; continue; }
      if (isSolidChar(tileAt(lv.grid, Math.floor((s.x + s.w / 2) / TILE), Math.floor((s.y + s.h / 2) / TILE)))) {
        s.life = -1;
        continue;
      }
      if (boss && boss.active && !boss.dead && boss.introT <= 0 && rectsOverlap(s, boss)) {
        this.damageBoss(boss, s.weapon);
        s.life = -1;
        continue;
      }
      for (const e of this.enemies) {
        if (!rectsOverlap(s, e)) continue;
        const dmg = s.weapon === "buster" ? DAMAGE.buster : DAMAGE.other;
        e.hp -= dmg;
        e.flash = 0.1;
        if (e.hp <= 0) this.killEnemy(e, s.weapon);
        else this.sound("hit");
        if (!s.pierce) { s.life = -1; break; }
      }
    }
    this.shots = this.shots.filter(
      (s) => s.life !== -1 && s.x > this.camX - 80 && s.x < this.camX + W + 80 && s.y > -80 && s.y < H + 80,
    );

    const h = this.hero;
    for (const s of this.eshots) {
      s.vy += s.ay * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (isSolidChar(tileAt(lv.grid, Math.floor((s.x + s.w / 2) / TILE), Math.floor((s.y + s.h / 2) / TILE)))) s.life = -1;
      else if (rectsOverlap(s, { x: h.x + 3, y: h.y + 3, w: h.w - 6, h: h.h - 6 })) {
        this.hurtHero(s.dmg);
        s.life = -1;
      }
    }
    this.eshots = this.eshots.filter((s) => s.life > 0);
  }

  private updatePickups(dt: number): void {
    const h = this.hero;
    for (const p of this.pickups) {
      if (!p.fixed) {
        p.life -= dt;
        p.vy = Math.min(MAX_FALL, p.vy + GRAVITY * dt);
        const res = this.moveY(p, p.vy * dt);
        if (res === "down") p.vy = 0;
      }
      if (!rectsOverlap(p, h)) continue;
      if (p.kind === "hp") {
        h.hp = Math.min(HERO_HP, h.hp + 4);
      } else if (p.kind === "we") {
        const w = this.weapon !== "buster" ? this.weapon : this.unlockedWeapons().find((x) => x !== "buster");
        if (w) this.energy[w] = Math.min(WEAPON_ENERGY, this.energy[w] + 8);
        else h.hp = Math.min(HERO_HP, h.hp + 4);
      } else if (this.lives < MAX_LIVES) {
        this.lives += 1;
        this.emitLives();
      }
      this.sound("pickup");
      p.life = -1;
    }
    this.pickups = this.pickups.filter((p) => p.life > 0);
  }

  private explode(x: number, y: number, color: string, n: number): void {
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 120) break;
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 200;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, max: 0.5 + Math.random() * 0.5,
        color, size: 3 + Math.floor(Math.random() * 4),
      });
    }
  }

  private updateParticles(dt: number): void {
    for (const p of this.particles) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - Math.min(1, 1.5 * dt);
      p.vy *= 1 - Math.min(1, 1.5 * dt);
    }
    this.particles = this.particles.filter((p) => p.t < p.max);
  }

  // Triggers and camera ---------------------------------------------------

  private checkTriggers(): void {
    const lv = this.lv;
    if (!lv) return;
    const h = this.hero;
    for (const s of lv.spawns) {
      if (s.ch === "c") {
        const cx = s.col * TILE;
        if (h.x > cx && (!this.checkpoint || cx > this.checkpoint.x)) {
          this.checkpoint = { x: cx + 9, y: (s.row + 1) * TILE - HERO_H };
        }
      } else if (s.ch === "E" && lv.def.hasExit) {
        const door = { x: s.col * TILE, y: (s.row - 1) * TILE, w: TILE, h: TILE * 2 };
        if (rectsOverlap(h, door)) { this.roomCleared(); return; }
      }
    }
    if (lv.def.bossCol !== null && !this.bossTriggered && h.x >= lv.def.bossCol * TILE + 4) {
      this.gateClosed = true;
      this.activateBoss(1.6);
      this.sound("select");
    }
  }

  private updateCamera(dt: number): void {
    const lv = this.lv;
    if (!lv) return;
    const maxCam = Math.max(0, lv.w - W);
    const target = this.bossTriggered
      ? lv.roomX
      : Math.max(0, Math.min(maxCam, this.hero.x + this.hero.w / 2 - W / 2));
    if (this.bossTriggered) this.camX = Math.min(target, this.camX + 700 * dt);
    else this.camX = target;
  }

  // ---------------------------------------------------------------- drawing

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
    c.font = `bold ${size}px ${FONT}`;
    c.textAlign = align;
    c.textBaseline = "middle";
    c.fillStyle = color;
    c.fillText(s, x, y);
  }

  private draw(): void {
    const buf = this.skinFilter !== "none" ? this.bufCtx : null;
    if (!buf || !this.buf) {
      this.ctx = this.screenCtx;
      this.drawScene();
      return;
    }
    this.ctx = buf;
    this.drawScene();
    const s = this.screenCtx;
    s.filter = this.skinFilter;
    s.drawImage(this.buf, 0, 0);
    s.filter = "none";
  }

  private drawScene(): void {
    const c = this.ctx;
    c.imageSmoothingEnabled = false;
    switch (this.screen) {
      case "title": this.drawTitle(); break;
      case "select": this.drawSelect(); break;
      case "password": this.drawPassword(); break;
      case "victory": this.drawVictory(); break;
      case "confirm-delete":
        if (this.prevScreen === "select") this.drawSelect();
        else this.drawTitle();
        this.drawConfirm();
        break;
      default: this.drawWorld(); break;
    }
  }

  private menuBackdrop(): void {
    const c = this.ctx;
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#050c0a");
    g.addColorStop(1, "#0c2418");
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    c.fillStyle = "rgba(82,240,106,0.07)";
    for (let x = 0; x < W; x += 48) c.fillRect(x, 0, 1, H);
    for (let y = 0; y < H; y += 48) c.fillRect(0, y, W, 1);
  }

  private heroSprite(frame: HeroFrame): HTMLCanvasElement {
    return this.sprite(`hero-${frame}`, heroRows(frame), HERO_PALETTE);
  }

  private masterSprite(id: string): HTMLCanvasElement {
    return this.sprite(`master-${id}`, masterRows(id), MASTER_PALETTES[id]);
  }

  private drawTitle(): void {
    const c = this.ctx;
    this.menuBackdrop();
    this.text("ROBO VAULT", W / 2, 120, 64, "#52f06a", "center");
    this.text("ROBO VAULT", W / 2 + 3, 123, 64, "rgba(0,245,255,0.25)", "center");
    this.text("SAM LOCKED THE VAULT. TAKE IT BACK.", W / 2, 180, 16, "#9fe8ff", "center");
    const items = this.titleItems();
    items.forEach((label, i) => {
      const y = 280 + i * 50;
      const on = i === this.titleCursor;
      if (on) {
        c.fillStyle = "rgba(82,240,106,0.16)";
        c.fillRect(W / 2 - 170, y - 20, 340, 40);
        this.text(">", W / 2 - 150, y, 22, "#f5ff00");
      }
      this.text(label, W / 2, y, 22, on ? "#ffffff" : "#8aa89a", "center");
    });
    drawSprite(c, this.heroSprite("idle"), 140, 470, 3);
    MASTERS.forEach((m, i) => drawSprite(c, this.masterSprite(m.id), 300 + i * 90, 458, 2));
    this.text("ARROWS: MOVE   SPACE: OK", W / 2, 554, 13, "#5a7a6a", "center");
  }

  private drawPwGrid(x: number, y: number, cell: number, cursor: boolean): void {
    const c = this.ctx;
    for (let i = 0; i < 5; i++) {
      this.text(String(i + 1), x + i * cell + cell / 2, y - 14, 13, "#8aa89a", "center");
      this.text("ABCDE"[i], x - 16, y + i * cell + cell / 2, 13, "#8aa89a", "center");
    }
    for (let r = 0; r < 5; r++) {
      for (let col = 0; col < 5; col++) {
        const cx = x + col * cell + cell / 2;
        const cy = y + r * cell + cell / 2;
        const on = this.pwGrid[r * 5 + col];
        c.strokeStyle = "rgba(82,240,106,0.5)";
        c.lineWidth = 2;
        c.strokeRect(x + col * cell + 2, y + r * cell + 2, cell - 4, cell - 4);
        if (on) {
          c.fillStyle = "#52f06a";
          c.beginPath();
          c.arc(cx, cy, cell * 0.28, 0, Math.PI * 2);
          c.fill();
        }
        if (cursor && this.pwRow === r && this.pwCol === col) {
          c.strokeStyle = "#f5ff00";
          c.lineWidth = 3;
          c.strokeRect(x + col * cell, y + r * cell, cell, cell);
        }
      }
    }
  }

  private labelLines(): string[] {
    const labels = filledLabels(this.pwGrid);
    const lines: string[] = [];
    for (let i = 0; i < labels.length; i += 5) lines.push(labels.slice(i, i + 5).join(" "));
    return lines;
  }

  private drawPassword(): void {
    const c = this.ctx;
    this.menuBackdrop();
    const entering = this.pwMode === "enter";
    this.text(entering ? "ENTER PASSWORD" : (this.pwTitle || "PASSWORD"), W / 2, 56, 30, "#52f06a", "center");
    const cell = 58;
    const gx = 120;
    const gy = 130;
    this.drawPwGrid(gx, gy, cell, entering);
    this.text("DOTS", 470, 140, 16, "#9fe8ff");
    const lines = this.labelLines();
    if (lines.length === 0) this.text("(none)", 470, 172, 18, "#5a7a6a");
    lines.forEach((l, i) => this.text(l, 470, 172 + i * 28, 18, "#ffffff"));
    if (entering) {
      ["PASTE", "OK", "BACK"].forEach((label, i) => {
        const bx = 110 + i * 140;
        const by = 450;
        const on = this.pwRow === 5 && this.pwCol === i;
        c.fillStyle = on ? "rgba(245,255,0,0.2)" : "rgba(82,240,106,0.1)";
        c.fillRect(bx, by, 120, 44);
        c.strokeStyle = on ? "#f5ff00" : "rgba(82,240,106,0.5)";
        c.lineWidth = on ? 3 : 2;
        c.strokeRect(bx, by, 120, 44);
        this.text(label, bx + 60, by + 22, 20, "#ffffff", "center");
      });
      this.text("SPACE: DOT   X: CLEAR   CTRL+V: PASTE", W / 2, 530, 14, "#5a7a6a", "center");
      if (this.pwMsgT > 0) this.text(this.pwMsg, 470, 400, 26, this.pwMsg === "PASTED" ? "#52f06a" : "#ff3b6b");
    } else {
      this.text(`SCORE ${this.progress.score}`, 470, 380, 18, "#f5ff00");
      this.text("WRITE THE DOTS DOWN, OR COPY THEM.", W / 2, 462, 16, "#9fe8ff", "center");
      this.drawShowButtons(["CONTINUE", "COPY"], 505);
    }
  }

  private drawVictory(): void {
    this.menuBackdrop();
    this.text("SAM IS DEFEATED", W / 2, 52, 34, "#f5ff00", "center");
    this.text("THE VAULT IS YOURS", W / 2, 90, 18, "#9fe8ff", "center");
    this.drawPwGrid(120, 150, 58, false);
    this.text("FINAL PASSWORD", 470, 160, 16, "#9fe8ff");
    this.labelLines().forEach((l, i) => this.text(l, 470, 192 + i * 28, 18, "#ffffff"));
    this.text(`SCORE ${this.score}`, 470, 380, 18, "#f5ff00");
    this.drawShowButtons(["FINISH", "COPY"], 505);
  }

  /** Two buttons side by side (cursor in `pwShowCursor`) and the copy feedback. */
  private drawShowButtons(labels: [string, string], y: number): void {
    const c = this.ctx;
    labels.forEach((label, i) => {
      const bx = W / 2 - 150 + i * 160;
      const on = this.pwShowCursor === i;
      c.fillStyle = on ? "rgba(245,255,0,0.2)" : "rgba(82,240,106,0.1)";
      c.fillRect(bx, y - 22, 140, 44);
      c.strokeStyle = on ? "#f5ff00" : "rgba(82,240,106,0.5)";
      c.lineWidth = on ? 3 : 2;
      c.strokeRect(bx, y - 22, 140, 44);
      this.text(label, bx + 70, y, 20, "#ffffff", "center");
    });
    if (this.copyMsgT > 0) {
      this.text(this.copyMsg, W / 2, y + 44, 16, this.copyMsg === "COPIED" ? "#52f06a" : "#ff3b6b", "center");
    }
  }

  private drawConfirm(): void {
    const c = this.ctx;
    c.fillStyle = "rgba(0,0,0,0.72)";
    c.fillRect(0, 0, W, H);
    c.fillStyle = "#07140e";
    c.fillRect(W / 2 - 220, 200, 440, 170);
    c.strokeStyle = "#ff3b6b";
    c.lineWidth = 3;
    c.strokeRect(W / 2 - 220, 200, 440, 170);
    this.text("DELETE PROGRESS?", W / 2, 245, 28, "#ffffff", "center");
    this.text("SCORE AND WEAPONS GO BACK TO 0", W / 2, 280, 13, "#8aa89a", "center");
    ["NO", "YES"].forEach((label, i) => {
      const x = W / 2 - 130 + i * 140;
      const on = this.confirmCursor === i;
      c.fillStyle = on ? "rgba(245,255,0,0.2)" : "rgba(255,255,255,0.06)";
      c.fillRect(x, 305, 120, 40);
      c.strokeStyle = on ? "#f5ff00" : "#5a7a6a";
      c.lineWidth = on ? 3 : 2;
      c.strokeRect(x, 305, 120, 40);
      this.text(label, x + 60, 325, 22, "#ffffff", "center");
    });
  }

  private drawSelect(): void {
    const c = this.ctx;
    this.menuBackdrop();
    this.text("SELECT STAGE", W / 2, 34, 26, "#52f06a", "center");
    const pw = 216;
    const ph = 150;
    for (let i = 0; i < 6; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 48 + col * (pw + 12);
      const y = 60 + row * (ph + 12);
      const on = this.selCursor === i;
      c.fillStyle = "rgba(10,30,20,0.9)";
      c.fillRect(x, y, pw, ph);
      c.strokeStyle = on ? "#f5ff00" : "rgba(82,240,106,0.45)";
      c.lineWidth = on ? 4 : 2;
      c.strokeRect(x + 1, y + 1, pw - 2, ph - 2);
      if (i < 4) {
        const m = MASTERS[i];
        const done = this.progress.masters[i];
        c.globalAlpha = done ? 0.35 : 1;
        drawSprite(c, this.masterSprite(m.id), x + pw / 2 - 63, y + 14, 3);
        c.globalAlpha = 1;
        this.text(m.name, x + pw / 2, y + ph - 22, 16, done ? "#5a7a6a" : "#ffffff", "center");
        if (done) {
          c.save();
          c.translate(x + pw / 2, y + 62);
          c.rotate(-0.25);
          c.fillStyle = "rgba(255,59,107,0.85)";
          c.fillRect(-80, -16, 160, 32);
          c.restore();
          this.text("DEFEATED", x + pw / 2, y + 60, 18, "#ffffff", "center");
        }
      } else if (i === 4) {
        const p = this.progress;
        const locked = !p.masters.every(Boolean);
        this.text("SAM'S CASTLE", x + pw / 2, y + 36, 18, locked ? "#5a7a6a" : "#ff6ad0", "center");
        c.fillStyle = locked ? "#3a4a42" : "#b04ad0";
        c.fillRect(x + pw / 2 - 30, y + 58, 60, 50);
        c.fillRect(x + pw / 2 - 40, y + 50, 80, 12);
        c.fillStyle = "#050c0a";
        c.fillRect(x + pw / 2 - 6, y + 72, 12, 24);
        const sub = locked ? "LOCKED" : p.cleared ? "CLEARED" : p.castleRooms >= 3 ? "FINAL BATTLE" : `ROOM ${p.castleRooms + 1} / 3`;
        this.text(sub, x + pw / 2, y + ph - 22, 15, locked ? "#5a7a6a" : "#ffffff", "center");
      } else {
        this.text("DELETE", x + pw / 2, y + 56, 22, "#ff3b6b", "center");
        this.text("PROGRESS", x + pw / 2, y + 86, 22, "#ff3b6b", "center");
      }
    }
    // Current password
    this.pwGrid = encodePassword({ ...this.progress, score: passwordScore(this.score) });
    this.text("PASSWORD", 48, 396, 14, "#9fe8ff");
    this.drawPwGrid(66, 424, 26, false);
    this.labelLines().forEach((l, i) => this.text(l, 250, 436 + i * 24, 16, "#ffffff"));
    this.text(`SCORE ${this.score}`, 560, 436, 16, "#f5ff00");
    const cutSel = Math.round((1 - this.damageTakenFactor()) * 100);
    if (cutSel > 0) this.text(`ARMOR: -${cutSel}% DAMAGE TAKEN`, 560, 520, 12, "#9fe8ff");
    this.text("WEAPONS", 560, 470, 14, "#9fe8ff");
    const names = this.unlockedWeapons().filter((w) => w !== "buster").map((w) => WEAPONS[w].name);
    this.text(names.length ? names.join(", ") : "BUSTER ONLY", 560, 494, 12, "#ffffff");
    if (this.toastT > 0) {
      c.fillStyle = "rgba(0,0,0,0.8)";
      c.fillRect(W / 2 - 200, 270, 400, 44);
      this.text(this.toast, W / 2, 292, 18, "#ff3b6b", "center");
    }
    this.text("SPACE: GO   X: BACK", W / 2, 560, 12, "#5a7a6a", "center");
  }

  private drawWorld(): void {
    const c = this.ctx;
    const lv = this.lv;
    if (!lv) { this.menuBackdrop(); return; }
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, lv.pal.skyTop);
    g.addColorStop(1, lv.pal.skyBottom);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    c.fillStyle = lv.pal.far;
    for (const f of lv.far) {
      const x = Math.round(f.x - this.camX * 0.3);
      if (x > -f.w && x < W) c.fillRect(x, H - 96 - f.h, f.w, f.h + 96);
    }
    const cam = Math.round(this.camX);
    c.drawImage(lv.layer, cam, 0, W, H, 0, 0, W, H);
    c.save();
    c.translate(-cam, 0);
    this.drawEntities(lv);
    c.restore();
    this.drawHud();
    if (this.phase === "ready" && Math.floor(this.time * 6) % 2 === 0) {
      this.text("READY", W / 2, H / 2 - 40, 40, "#f5ff00", "center");
    }
    if (this.phase === "win") {
      this.text(this.winText, W / 2, H / 2 - 20, 34, this.winColor, "center");
    }
  }

  private drawEntities(lv: LoadedLevel): void {
    const c = this.ctx;
    // Checkpoint flags
    for (const s of lv.spawns) {
      if (s.ch !== "c") continue;
      const reached = this.checkpoint !== null && this.checkpoint.x >= s.col * TILE;
      c.fillStyle = "#cfd8d4";
      c.fillRect(s.col * TILE + 22, s.row * TILE + 6, 4, TILE - 6);
      c.fillStyle = reached ? "#52f06a" : "#ff3b6b";
      c.fillRect(s.col * TILE + 26, s.row * TILE + 6, 18, 12);
    }
    // Gate
    if (this.gateClosed && lv.def.bossCol !== null) {
      const gx = (lv.def.bossCol - 1) * TILE;
      c.fillStyle = "#1c2a24";
      c.fillRect(gx, 0, TILE, 10 * TILE);
      c.fillStyle = lv.pal.accent;
      for (let y = 0; y < 10 * TILE; y += 24) c.fillRect(gx + 6, y + 4, TILE - 12, 6);
    }
    for (const p of this.plats) {
      c.fillStyle = lv.pal.tileDark;
      c.fillRect(Math.round(p.x), p.y, p.w, p.h);
      c.fillStyle = lv.pal.accent2;
      c.fillRect(Math.round(p.x), p.y, p.w, 5);
    }
    for (const p of this.pickups) {
      c.fillStyle = p.kind === "hp" ? "#ff6a9a" : p.kind === "we" ? "#9fe8ff" : "#f5ff00";
      c.fillRect(p.x, p.y, p.w, p.h);
      c.fillStyle = "#ffffff";
      if (p.kind === "life") c.fillRect(p.x + 6, p.y + 4, 6, 10);
      else c.fillRect(p.x + 7, p.y + 3, 4, 12);
      if (p.kind !== "life") c.fillRect(p.x + 3, p.y + 7, 12, 4);
    }
    this.drawEnemies(lv);
    this.drawBoss();
    for (const s of this.shots) {
      c.fillStyle = WEAPONS[s.weapon].color;
      if (s.weapon === "frost") {
        c.beginPath();
        if (s.up) {
          c.moveTo(s.x + s.w / 2, s.y);
          c.lineTo(s.x, s.y + s.h);
          c.lineTo(s.x + s.w, s.y + s.h);
        } else {
          c.moveTo(s.vx > 0 ? s.x + s.w : s.x, s.y + s.h / 2);
          c.lineTo(s.vx > 0 ? s.x : s.x + s.w, s.y);
          c.lineTo(s.vx > 0 ? s.x : s.x + s.w, s.y + s.h);
        }
        c.closePath();
        c.fill();
      } else if (s.weapon === "buster") {
        c.fillRect(s.x, s.y, s.w, s.h);
      } else {
        c.beginPath();
        c.arc(s.x + s.w / 2, s.y + s.h / 2, s.w / 2, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "rgba(255,255,255,0.6)";
        c.beginPath();
        c.arc(s.x + s.w / 2 - 2, s.y + s.h / 2 - 2, s.w / 5, 0, Math.PI * 2);
        c.fill();
      }
    }
    for (const s of this.eshots) {
      c.fillStyle = ESHOT_COLOR[s.kind];
      c.beginPath();
      c.arc(s.x + s.w / 2, s.y + s.h / 2, s.w / 2, 0, Math.PI * 2);
      c.fill();
    }
    this.drawHero();
    for (const p of this.particles) {
      c.globalAlpha = Math.max(0, 1 - p.t / p.max);
      c.fillStyle = p.color;
      c.fillRect(p.x, p.y, p.size, p.size);
    }
    c.globalAlpha = 1;
  }

  private drawHero(): void {
    const h = this.hero;
    if (this.phase === "dying") return;
    if (h.invuln > 0 && Math.floor(this.time * 20) % 2 === 0) return;
    const legs: HeroLegs = !h.onGround ? "jump" : Math.abs(h.vx) > 20 ? (Math.floor(this.time * 10) % 2 === 0 ? "run1" : "run2") : "idle";
    const aimUp = this.phase === "play" && this.held(UP_KEYS);
    const frame: HeroFrame = h.crouching ? "crouch" : aimUp ? `up-${legs}` : legs;
    drawSprite(this.ctx, this.heroSprite(frame), h.x, h.y, 3, h.facing < 0);
  }

  private drawEnemies(lv: LoadedLevel): void {
    const c = this.ctx;
    const pal = enemyPalette(lv.pal.accent, lv.pal.accent2);
    const id = this.stageId;
    for (const e of this.enemies) {
      if (e.x + e.w < this.camX || e.x > this.camX + W) continue;
      if (e.flash > 0 && Math.floor(this.time * 30) % 2 === 0) continue;
      let rows: SpriteRows;
      let key: string;
      if (e.kind === "walker") {
        const f = Math.floor(this.time * 6) % 2;
        rows = f === 0 ? WALKER_A : WALKER_B;
        key = `walker${f}`;
      } else if (e.kind === "hopper") {
        const up = e.vy < 0;
        rows = up ? HOPPER_UP : HOPPER_DOWN;
        key = up ? "hopperU" : "hopperD";
      } else if (e.kind === "turret") {
        rows = TURRET;
        key = "turret";
      } else {
        const f = Math.floor(this.time * 8) % 2;
        rows = f === 0 ? FLYER_A : FLYER_B;
        key = `flyer${f}`;
      }
      const size = ENEMY_SIZE[e.kind];
      drawSprite(c, this.sprite(`${key}-${id}`, rows, pal), e.x, e.y, size.scale, e.dir > 0);
    }
  }

  private drawBoss(): void {
    const b = this.boss;
    if (!b || (b.dead && Math.floor(this.time * 20) % 2 === 0)) return;
    if (b.flash > 0 && Math.floor(this.time * 30) % 2 === 0) return;
    let sprite: HTMLCanvasElement;
    let scale = 3;
    if (b.id === "sam") {
      if (b.samPhase === 1) sprite = this.sprite("sam-saucer", SAM_SAUCER, SAM_PALETTE);
      else sprite = this.sprite("sam-mech", SAM_MECH, SAM_PALETTE);
      scale = 3;
    } else {
      sprite = this.masterSprite(b.id);
    }
    drawSprite(this.ctx, sprite, b.x, b.y, scale, b.dir > 0);
  }

  private drawHud(): void {
    const c = this.ctx;
    const h = this.hero;
    const bar = (x: number, y: number, segs: number, segH: number, value: number, color: string) => {
      c.fillStyle = "rgba(0,0,0,0.6)";
      c.fillRect(x - 3, y - 3, 20, segs * segH + 6);
      for (let i = 0; i < segs; i++) {
        const on = i < value;
        c.fillStyle = on ? color : "rgba(255,255,255,0.12)";
        c.fillRect(x, y + (segs - 1 - i) * segH, 14, segH - 2);
      }
    };
    bar(16, 40, HERO_HP, 10, h.hp, "#00f5ff");
    if (this.weapon !== "buster") {
      bar(42, 40, WEAPON_ENERGY, 5, this.energy[this.weapon], WEAPONS[this.weapon].color);
    }
    const b = this.boss;
    if (b && b.active) {
      const shown = b.introT > 0 ? b.shown : b.hp;
      bar(W - 30, 40, b.maxHp, 140 / b.maxHp, shown, "#ff3b6b");
    }
    this.text(WEAPONS[this.weapon].name, 16, H - 20, 14, WEAPONS[this.weapon].color);
    if (this.unlockedWeapons().length > 1) this.text("Q / E: WEAPON", 16, H - 40, 11, "#8aa89a");
    const cut = Math.round((1 - this.damageTakenFactor()) * 100);
    if (cut > 0) this.text(`ARMOR -${cut}% DMG`, 16, H - 60, 11, "#9fe8ff");
  }
}
