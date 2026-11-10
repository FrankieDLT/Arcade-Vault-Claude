import {
  BANNER_TIME,
  BEAM_DURATION,
  BEAM_STOP_Y,
  BOSS_RETURN_TIME,
  CAPTURE_TIME,
  CAPTURED_RESPAWN_DELAY,
  CHALLENGE_SPEED,
  CLEARING_TIME,
  DIVE_SPEED,
  DUAL_GAP,
  ENEMY_SHOT_H,
  ENEMY_SHOT_W,
  ENTRY_GROUPS,
  ENTRY_SPEED,
  EXTRA_LIFE_FIRST,
  EXTRA_LIFE_STEP,
  FIRE_COOLDOWN,
  H,
  HOME_TIME,
  MAX_DT,
  MAX_LIVES,
  MAX_SHOTS,
  MAX_SHOTS_DUAL,
  MAX_STEP,
  PLAYER_H,
  PLAYER_SPEED,
  PLAYER_W,
  PLAYER_Y,
  POD_SIZE,
  POD_SPEED,
  RESPAWN_DELAY,
  RETURN_TIME,
  SCORES,
  SHIP_GAP,
  SHOT_H,
  SHOT_SPEED,
  SHOT_W,
  SKINS,
  START_LIVES,
  STATS_TIME,
  W,
  WAVE_GAP,
  type DogfightPalette,
  type GalacticDogfightSkin,
} from "./constants";
import {
  drawBadges,
  drawBanner,
  drawBeam,
  drawCapturedShip,
  drawEnemy,
  drawEnemyShot,
  drawField,
  drawFighter,
  drawReserve,
  drawShot,
  drawStars,
  type BannerLine,
  type Beam,
  type Enemy,
  type EnemyShot,
  type Fighter,
  type RescuePod,
  type Shot,
  type Star,
} from "./entities";
import {
  CHALLENGE_PATHS,
  ENTRY_PATHS,
  makeBeamPath,
  makeDivePath,
  makeEscapePath,
  pathDuration,
  pathPoint,
  type Path,
} from "./paths";
import {
  bossComboPoints,
  breathScale,
  clampScore,
  createStars,
  enemyRect,
  inBeam,
  isChallengingStage,
  rectsOverlap,
  slotPosition,
  stageParams,
} from "./utils";

export type { GalacticDogfightSkin } from "./constants";

export type GalacticDogfightSound =
  | "shoot"
  | "hit"
  | "bossHit"
  | "death"
  | "gameover"
  | "stageStart"
  | "beam"
  | "capture"
  | "rescue"
  | "challenge"
  | "perfect"
  | "extraLife";

export interface GalacticDogfightCallbacks {
  onScore: (score: number) => void;
  onLives: (lives: number) => void; // total fighters incl. the active one
  onLevel: (stage: number) => void;
  onGameOver: (finalScore: number) => void; // once per run
  onSound?: (name: GalacticDogfightSound) => void;
  onHaptic?: (name: "death" | "clear") => void;
}

export interface GalacticDogfightOptions {
  skin?: GalacticDogfightSkin; // default "retro"
}

type Phase = "banner" | "entry" | "battle" | "clearing" | "stats" | "over";

interface Capture {
  bossId: number;
  t: number;
  x0: number; // where the ship was taken from
  y0: number;
}

const LEFT_KEYS = ["ArrowLeft", "KeyA"];
const RIGHT_KEYS = ["ArrowRight", "KeyD"];
const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "KeyA", "KeyD", "Space"]);
const FIGHTER_HALF = PLAYER_W / 2;

const smooth = (u: number): number => {
  const c = Math.max(0, Math.min(1, u));
  return c * c * (3 - 2 * c);
};

export class GalacticDogfightEngine {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly callbacks: GalacticDogfightCallbacks;
  private skin: GalacticDogfightSkin;

  // Lifecycle
  private started = false;
  private paused = false;
  private finished = false; // onGameOver already fired for this run
  private destroyed = false;
  private listening = false;
  private rafId: number | null = null;
  private lastTime: number | null = null;

  // Game state (instance-owned, nothing shared between engines)
  private stage = 1;
  private phase: Phase = "banner";
  private phaseT = 0;
  private challenging = false;
  private enemies: Enemy[] = [];
  private fighter: Fighter = { x: W / 2, dual: false, alive: true, state: "playing", respawnIn: 0 };
  private shots: Shot[] = [];
  private enemyShots: EnemyShot[] = [];
  private pod: RescuePod | null = null;
  private beam: Beam | null = null;
  private capture: Capture | null = null;
  private stars: Star[] = [];
  private swayT = 0;
  private breathAmp = 0;
  private diveTimer = 0;
  private fired = 0;
  private hits = 0;
  private challengeHits = 0;
  private perfect = false;
  private score = 0;
  private lives = START_LIVES;
  private nextExtraLife = EXTRA_LIFE_FIRST;
  private nextId = 1;
  private clock = 0; // seconds, advanced only in update (drives flaps, twinkle, fire cooldown)
  private lastShotAt = -1;
  private held = new Set<string>();

  // Last values sent to the callbacks, so they only fire on change.
  private emittedScore = NaN;
  private emittedLives = NaN;
  private emittedLevel = NaN;

  constructor(
    canvas: HTMLCanvasElement,
    callbacks: GalacticDogfightCallbacks,
    options: GalacticDogfightOptions = {},
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("GalacticDogfightEngine: 2D canvas context is not available");
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
    this.announceStage();
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

  setSkin(skin: GalacticDogfightSkin): void {
    if (!(skin in SKINS)) return;
    this.skin = skin;
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
    for (const s of this.stars) {
      s.y += s.speed * dt;
      if (s.y > H) {
        s.y -= H;
        s.x = Math.random() * W;
      }
    }

    if (this.phase === "banner") {
      this.phaseT += dt;
      if (this.phaseT >= BANNER_TIME) this.startEntry();
      return;
    }
    this.updateWorld(dt);
  }

  // The world runs in every phase but the banner: entry, battle, clearing and stats.
  private updateWorld(dt: number): void {
    this.phaseT += dt;
    this.swayT += dt;
    if (this.phase === "battle") this.breathAmp = Math.min(1, this.breathAmp + dt);

    this.updateFighter(dt);
    this.updateEnemies(dt);
    if (this.finished) return;
    this.checkRams();
    if (this.finished) return;
    if (this.phase === "battle") this.scheduleDives(dt);
    this.updateBeam(dt);
    this.updateCapture(dt);
    if (this.finished) return;
    this.moveProjectiles(dt);
    if (this.finished) return;
    this.updatePod(dt);

    switch (this.phase) {
      case "entry":
        if (!this.challenging && this.enemies.every((e) => e.mode !== "entering")) {
          this.phase = "battle";
          this.phaseT = 0;
        }
        break;
      case "clearing":
        if (this.phaseT >= CLEARING_TIME) {
          this.phase = "stats";
          this.phaseT = 0;
        }
        break;
      case "stats":
        if (this.phaseT >= STATS_TIME) {
          this.stage += 1;
          this.beginStage();
          this.announceStage();
        }
        break;
      default:
        break;
    }
    if (
      (this.phase === "entry" || this.phase === "battle") &&
      this.enemies.every((e) => e.mode === "dead")
    ) {
      this.clearStage();
    }
  }

  // ── Stages ─────────────────────────────────────────────────────────────────

  private beginStage(): void {
    this.challenging = isChallengingStage(this.stage);
    this.enemies = [];
    this.shots = [];
    this.enemyShots = [];
    this.pod = null;
    this.beam = null;
    this.capture = null;
    this.phase = "banner";
    this.phaseT = 0;
    this.swayT = 0;
    this.breathAmp = 0;
    this.challengeHits = 0;
    this.perfect = false;
    if (this.fighter.state === "playing") this.fighter.state = "ready";
  }

  private announceStage(): void {
    this.callbacks.onSound?.(this.challenging ? "challenge" : "stageStart");
  }

  private startEntry(): void {
    this.phase = "entry";
    this.phaseT = 0;
    if (this.fighter.state === "ready") this.fighter.state = "playing";
    const params = stageParams(this.stage);
    this.diveTimer = params.diveInterval;
    this.spawnEnemies(params.shootDuringEntry);
  }

  private spawnEnemies(shootDuringEntry: boolean): void {
    this.enemies = [];
    ENTRY_GROUPS.forEach((group, wave) => {
      const path: Path = this.challenging ? CHALLENGE_PATHS[wave] : ENTRY_PATHS[wave];
      const dur = pathDuration(path, this.challenging ? CHALLENGE_SPEED : ENTRY_SPEED);
      group.forEach((ship, i) => {
        const fireAt =
          !this.challenging && shootDuringEntry && Math.random() < 0.5
            ? [dur * (0.3 + Math.random() * 0.5)]
            : [];
        this.enemies.push({
          id: this.nextId++,
          kind: ship.kind,
          col: ship.col,
          row: ship.row,
          mode: this.challenging ? "challenge" : "entering",
          t: -(wave * WAVE_GAP + i * SHIP_GAP),
          x: path[0][0],
          y: path[0][1],
          hp: ship.kind === "boss" && !this.challenging ? 2 : 1,
          carrying: false,
          escortOf: null,
          wave,
          path,
          dur,
          angle: 0,
          fromX: 0,
          fromY: 0,
          retDur: RETURN_TIME,
          fireAt,
          beamDive: false,
        });
      });
    });
  }

  private clearStage(): void {
    this.phase = "clearing";
    this.phaseT = 0;
    this.callbacks.onHaptic?.("clear");
    if (this.challenging && this.challengeHits === this.enemies.length) {
      this.perfect = true;
      this.addScore(SCORES.perfect);
      this.callbacks.onSound?.("perfect");
    }
  }

  // ── Fighter ────────────────────────────────────────────────────────────────

  private axis(): number {
    const l = LEFT_KEYS.some((c) => this.held.has(c));
    const r = RIGHT_KEYS.some((c) => this.held.has(c));
    return (r ? 1 : 0) - (l ? 1 : 0); // both together cancel
  }

  private halfSpan(): number {
    return this.fighter.dual ? DUAL_GAP / 2 + FIGHTER_HALF : FIGHTER_HALF;
  }

  private updateFighter(dt: number): void {
    const f = this.fighter;
    if (f.state === "respawning") {
      f.respawnIn -= dt;
      if (f.respawnIn <= 0) {
        f.respawnIn = 0;
        f.state = "playing";
        f.x = W / 2;
        f.dual = false;
      }
      return;
    }
    if (f.state !== "playing") return;
    const half = this.halfSpan();
    f.x = Math.max(half, Math.min(W - half, f.x + this.axis() * PLAYER_SPEED * dt));
    if (this.phase === "entry" || this.phase === "battle") this.tryFire();
  }

  private tryFire(): void {
    if (!this.held.has("Space")) return;
    const f = this.fighter;
    const n = f.dual ? 2 : 1;
    const cap = f.dual ? MAX_SHOTS_DUAL : MAX_SHOTS;
    if (this.shots.length + n > cap) return;
    if (this.clock - this.lastShotAt < FIRE_COOLDOWN) return;
    this.lastShotAt = this.clock;
    const top = PLAYER_Y - PLAYER_H / 2 - SHOT_H;
    if (f.dual) {
      this.shots.push({ x: f.x - DUAL_GAP / 2, y: top }, { x: f.x + DUAL_GAP / 2, y: top });
    } else {
      this.shots.push({ x: f.x, y: top });
    }
    this.fired += n;
    for (let i = 0; i < n; i++) this.callbacks.onSound?.("shoot");
  }

  private fighterRect() {
    const half = this.halfSpan();
    return { x: this.fighter.x - half, y: PLAYER_Y - PLAYER_H / 2, w: half * 2, h: PLAYER_H };
  }

  private destroyFighter(): void {
    const f = this.fighter;
    if (f.state !== "playing") return;
    this.lives = Math.max(0, this.lives - 1);
    f.dual = false;
    f.state = "respawning";
    f.respawnIn = RESPAWN_DELAY;
    this.enemyShots = [];
    this.callbacks.onSound?.("death");
    this.callbacks.onHaptic?.("death");
    this.emitChanges();
    if (this.lives <= 0) this.finishRun();
  }

  // ── Enemies ────────────────────────────────────────────────────────────────

  private breath(): number {
    return breathScale(this.swayT, this.breathAmp);
  }

  private slotOf(e: Enemy): { x: number; y: number } {
    return slotPosition(e.col, e.row, this.swayT, this.breath());
  }

  private isVisible(e: Enemy): boolean {
    if (e.mode === "dead") return false;
    return !((e.mode === "entering" || e.mode === "challenge") && e.t < 0);
  }

  // Moves an enemy and turns it to face where it goes.
  private place(e: Enemy, x: number, y: number): void {
    const dx = x - e.x;
    const dy = y - e.y;
    if (dx * dx + dy * dy > 0.0001) e.angle = Math.atan2(-dx, dy);
    e.x = x;
    e.y = y;
  }

  private relaxAngle(e: Enemy, dt: number): void {
    e.angle *= Math.max(0, 1 - dt * 10);
  }

  private updateEnemies(dt: number): void {
    for (const e of this.enemies) {
      switch (e.mode) {
        case "entering": {
          e.t += dt;
          if (e.t < 0) break;
          if (e.t < e.dur) {
            const [px, py] = pathPoint(e.path, e.t / e.dur);
            this.place(e, px, py);
          } else {
            const u = (e.t - e.dur) / HOME_TIME;
            if (u >= 1) {
              e.mode = "formation";
              const s = this.slotOf(e);
              e.x = s.x;
              e.y = s.y;
              e.angle = 0;
            } else {
              const end = e.path[e.path.length - 1];
              const s = this.slotOf(e);
              const k = smooth(u);
              this.place(e, end[0] + (s.x - end[0]) * k, end[1] + (s.y - end[1]) * k);
              this.relaxAngle(e, dt);
            }
          }
          this.fireCheck(e);
          break;
        }
        case "formation": {
          const s = this.slotOf(e);
          e.x = s.x;
          e.y = s.y;
          e.angle = 0;
          break;
        }
        case "diving": {
          e.t += dt;
          if (e.t >= e.dur) {
            if (e.beamDive) {
              this.startBeam(e);
            } else {
              const s = this.slotOf(e);
              e.mode = "returning";
              e.t = 0;
              e.fromX = s.x;
              e.fromY = -30;
              e.retDur = RETURN_TIME;
              e.escortOf = null;
              e.x = e.fromX;
              e.y = e.fromY;
            }
            break;
          }
          const [px, py] = pathPoint(e.path, e.t / e.dur);
          this.place(e, px, py);
          this.fireCheck(e);
          break;
        }
        case "returning": {
          e.t += dt;
          const u = e.t / e.retDur;
          const s = this.slotOf(e);
          if (u >= 1) {
            e.mode = "formation";
            e.x = s.x;
            e.y = s.y;
            e.angle = 0;
          } else {
            const k = smooth(u);
            this.place(e, e.fromX + (s.x - e.fromX) * k, e.fromY + (s.y - e.fromY) * k);
            this.relaxAngle(e, dt);
          }
          break;
        }
        case "beaming":
          this.relaxAngle(e, dt);
          break;
        case "challenge": {
          e.t += dt;
          if (e.t < 0) break;
          if (e.t >= e.dur) {
            e.mode = "dead"; // flew away
            break;
          }
          const [px, py] = pathPoint(e.path, e.t / e.dur);
          this.place(e, px, py);
          break;
        }
        default:
          break;
      }
    }
  }

  private fireCheck(e: Enemy): void {
    while (e.fireAt.length > 0 && e.t >= e.fireAt[0]) {
      e.fireAt.shift();
      this.enemyFire(e);
    }
  }

  // Aimed at the fighter column at fire time, never more than the stage allows on screen.
  private enemyFire(e: Enemy): void {
    const p = stageParams(this.stage);
    if (this.enemyShots.length >= p.maxShots || e.y < 0 || e.y > 470) return;
    let angle = 0;
    if (this.fighter.state === "playing") {
      angle = Math.atan2(this.fighter.x - e.x, PLAYER_Y - e.y);
      angle = Math.max(-0.6, Math.min(0.6, angle));
    }
    this.enemyShots.push({
      x: e.x,
      y: e.y + 10,
      vx: Math.sin(angle) * p.shotSpeed,
      vy: Math.cos(angle) * p.shotSpeed,
    });
  }

  // ── Dives ──────────────────────────────────────────────────────────────────

  private scheduleDives(dt: number): void {
    if (this.fighter.state !== "playing") return; // held while the fighter is gone
    this.diveTimer -= dt;
    if (this.diveTimer > 0) return;
    const p = stageParams(this.stage);
    this.diveTimer = p.diveInterval * (0.8 + Math.random() * 0.4);
    const divers = this.enemies.filter((e) => e.mode === "diving" || e.mode === "beaming").length;
    if (divers >= p.maxDivers) return;
    const ready = this.enemies.filter((e) => e.mode === "formation");
    if (ready.length === 0) return;
    const bosses = ready.filter((e) => e.kind === "boss");
    const pick =
      bosses.length > 0 && Math.random() < 0.3
        ? bosses[Math.floor(Math.random() * bosses.length)]
        : ready[Math.floor(Math.random() * ready.length)];
    this.launchDive(pick);
  }

  private canBeam(): boolean {
    return (
      this.fighter.state === "playing" &&
      this.capture === null &&
      this.beam === null &&
      !this.enemies.some((e) => e.carrying)
    );
  }

  private launchDive(e: Enemy): void {
    const p = stageParams(this.stage);
    const speed = DIVE_SPEED * p.diveSpeedFactor;
    const tx = Math.max(40, Math.min(W - 40, this.fighter.x));
    e.escortOf = null;
    e.fireAt = [];
    if (e.kind === "boss" && this.canBeam() && Math.random() < 0.55) {
      e.path = makeBeamPath(e.x, e.y, tx, BEAM_STOP_Y);
      e.beamDive = true;
    } else {
      const variant = Math.random() < 0.5 ? 0 : 1;
      e.path = makeDivePath(e.x, e.y, tx, variant);
      e.beamDive = false;
      if (e.kind === "boss") this.launchEscorts(e, tx, variant, speed);
      const shots = 1 + (Math.random() < 0.5 ? 1 : 0);
      const dur = pathDuration(e.path, speed);
      e.fireAt = Array.from({ length: shots }, () => dur * (0.2 + Math.random() * 0.4)).sort(
        (a, b) => a - b,
      );
    }
    e.dur = pathDuration(e.path, speed);
    e.t = 0;
    e.mode = "diving";
  }

  // A Boss takes up to two Butterflies from the slots next to it.
  private launchEscorts(boss: Enemy, tx: number, variant: 0 | 1, speed: number): void {
    for (const col of [boss.col - 1, boss.col + 1]) {
      const escort = this.enemies.find(
        (o) => o.mode === "formation" && o.kind === "butterfly" && o.row === 1 && o.col === col,
      );
      if (!escort) continue;
      escort.escortOf = boss.id;
      escort.path = makeDivePath(escort.x, escort.y, tx, variant);
      escort.beamDive = false;
      escort.dur = pathDuration(escort.path, speed);
      escort.t = 0;
      const dur = escort.dur;
      escort.fireAt = [dur * (0.25 + Math.random() * 0.3)];
      escort.mode = "diving";
    }
  }

  // ── Tractor beam, capture, rescue ──────────────────────────────────────────

  private startBeam(e: Enemy): void {
    if (!this.canBeam()) {
      this.escape(e);
      return;
    }
    e.mode = "beaming";
    e.t = 0;
    this.beam = { bossId: e.id, t: 0, x: e.x, y: e.y };
    this.callbacks.onSound?.("beam");
  }

  // The Boss leaves its stop point and exits through the bottom.
  private escape(e: Enemy): void {
    const speed = DIVE_SPEED * stageParams(this.stage).diveSpeedFactor;
    e.path = makeEscapePath(e.x, e.y);
    e.dur = pathDuration(e.path, speed);
    e.t = 0;
    e.beamDive = false;
    e.fireAt = [];
    e.mode = "diving";
  }

  private updateBeam(dt: number): void {
    const beam = this.beam;
    if (!beam) return;
    beam.t += dt;
    const boss = this.enemies.find((e) => e.id === beam.bossId);
    if (!boss || boss.mode !== "beaming") {
      this.beam = null;
      return;
    }
    if (this.capture) return; // the cone stays on while the ship is lifted
    if (beam.t >= BEAM_DURATION) {
      this.beam = null;
      this.escape(boss);
      return;
    }
    const f = this.fighter;
    if (f.state !== "playing") return;
    const inside = f.dual
      ? inBeam(f.x - DUAL_GAP / 2, beam) || inBeam(f.x + DUAL_GAP / 2, beam)
      : inBeam(f.x, beam);
    if (inside) this.startCapture(boss);
  }

  private startCapture(boss: Enemy): void {
    const f = this.fighter;
    this.callbacks.onSound?.("capture");
    this.callbacks.onHaptic?.("death");
    if (f.dual) {
      // One ship of the pair is taken, the other stays: no life lost.
      this.capture = { bossId: boss.id, t: 0, x0: f.x + DUAL_GAP / 2, y0: PLAYER_Y };
      f.dual = false;
      f.x = Math.max(FIGHTER_HALF, f.x - DUAL_GAP / 2);
    } else {
      this.capture = { bossId: boss.id, t: 0, x0: f.x, y0: PLAYER_Y };
      f.state = "captured";
      this.lives = Math.max(0, this.lives - 1);
      this.enemyShots = [];
      this.emitChanges();
    }
  }

  private updateCapture(dt: number): void {
    const c = this.capture;
    if (!c) return;
    c.t += dt;
    if (c.t < CAPTURE_TIME) return;
    this.capture = null;
    this.beam = null;
    const boss = this.enemies.find((e) => e.id === c.bossId);
    if (boss && boss.mode === "beaming") {
      boss.carrying = true;
      boss.mode = "returning";
      boss.t = 0;
      boss.fromX = boss.x;
      boss.fromY = boss.y;
      boss.retDur = BOSS_RETURN_TIME;
    }
    if (this.lives <= 0) {
      this.finishRun(); // the last ship was captured: no rescue possible
      return;
    }
    if (this.fighter.state === "captured") {
      this.fighter.state = "respawning";
      this.fighter.respawnIn = CAPTURED_RESPAWN_DELAY;
    }
  }

  private updatePod(dt: number): void {
    const pod = this.pod;
    if (!pod) return;
    pod.y += POD_SPEED * dt;
    pod.angle += 6 * dt;
    const f = this.fighter;
    if (f.state === "playing") {
      pod.x += Math.max(-50 * dt, Math.min(50 * dt, f.x - pod.x));
      const rect = { x: pod.x - POD_SIZE / 2, y: pod.y - POD_SIZE / 2, w: POD_SIZE, h: POD_SIZE };
      if (rectsOverlap(rect, this.fighterRect())) {
        this.pod = null;
        if (!f.dual) {
          f.dual = true;
          f.x = Math.min(W - this.halfSpan(), f.x + DUAL_GAP / 2);
        }
        this.addScore(SCORES.rescue);
        this.callbacks.onSound?.("rescue");
        return;
      }
    }
    if (pod.y > H + 30) this.pod = null;
  }

  // ── Projectiles and collisions ─────────────────────────────────────────────

  // Everything moves in sub-steps of at most MAX_STEP px so nothing tunnels through a target.
  private moveProjectiles(dt: number): void {
    if (this.shots.length === 0 && this.enemyShots.length === 0) return;
    const fastest = Math.max(SHOT_SPEED, stageParams(this.stage).shotSpeed);
    const steps = Math.max(1, Math.ceil((fastest * dt) / MAX_STEP));
    const sdt = dt / steps;
    for (let i = 0; i < steps && !this.finished; i++) {
      for (const s of this.shots) s.y -= SHOT_SPEED * sdt;
      this.checkShots();
      for (const es of this.enemyShots) {
        es.x += es.vx * sdt;
        es.y += es.vy * sdt;
      }
      this.checkEnemyShots();
    }
  }

  private checkShots(): void {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      if (s.y + SHOT_H < 0) {
        this.shots.splice(i, 1);
        continue;
      }
      const rect = { x: s.x - SHOT_W / 2, y: s.y, w: SHOT_W, h: SHOT_H };
      const target = this.enemies.find(
        (e) =>
          this.isVisible(e) &&
          !(e.mode === "beaming" && this.capture !== null) && // untouchable while it lifts the ship
          rectsOverlap(rect, enemyRect(e)),
      );
      if (target) {
        this.shots.splice(i, 1);
        this.hits++;
        if (target.hp > 1) {
          target.hp--;
          this.callbacks.onSound?.("bossHit");
        } else {
          this.killEnemy(target);
        }
        continue;
      }
      // A captured ship carried by a diving Boss can be shot too.
      const carried = this.enemies.find(
        (e) =>
          e.carrying &&
          e.mode === "diving" &&
          rectsOverlap(rect, {
            x: e.x - PLAYER_W / 2,
            y: e.y - 24 - PLAYER_H / 2,
            w: PLAYER_W,
            h: PLAYER_H,
          }),
      );
      if (carried) {
        this.shots.splice(i, 1);
        this.hits++;
        carried.carrying = false;
        this.addScore(SCORES.capturedShot);
        this.callbacks.onSound?.("hit");
      }
    }
  }

  private checkEnemyShots(): void {
    const fighter = this.fighterRect();
    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      const es = this.enemyShots[i];
      if (es.y > H + 10 || es.x < -10 || es.x > W + 10) {
        this.enemyShots.splice(i, 1);
        continue;
      }
      if (this.fighter.state !== "playing") continue;
      const rect = {
        x: es.x - ENEMY_SHOT_W / 2,
        y: es.y,
        w: ENEMY_SHOT_W,
        h: ENEMY_SHOT_H,
      };
      if (rectsOverlap(rect, fighter)) {
        this.destroyFighter();
        return;
      }
    }
  }

  // A diving ship that touches the fighter destroys it and dies too, scoring normally.
  private checkRams(): void {
    if (this.fighter.state !== "playing") return;
    const fighter = this.fighterRect();
    const rammer = this.enemies.find(
      (e) =>
        this.isVisible(e) &&
        e.mode !== "formation" &&
        e.mode !== "challenge" &&
        rectsOverlap(enemyRect(e), fighter),
    );
    if (!rammer) return;
    this.killEnemy(rammer);
    this.destroyFighter();
  }

  // ── Scoring ────────────────────────────────────────────────────────────────

  private killEnemy(e: Enemy): void {
    const inFormation = e.mode === "formation";
    let points: number;
    if (e.mode === "challenge") {
      points = SCORES.challenge;
      this.challengeHits++;
    } else if (e.kind === "boss") {
      if (inFormation) {
        points = SCORES.boss.formation;
      } else {
        const escorts = this.enemies.filter(
          (o) => o.escortOf === e.id && o.mode !== "dead" && o.mode !== "formation",
        ).length;
        points = bossComboPoints(escorts);
      }
    } else {
      points = inFormation ? SCORES[e.kind].formation : SCORES[e.kind].dive;
    }
    if (e.carrying) {
      // Freed only when the Boss dies away from its slot; in formation the ship dies with it.
      if (!inFormation && this.pod === null) {
        this.pod = { x: e.x, y: e.y, angle: 0 };
      }
      e.carrying = false;
    }
    if (this.beam && this.beam.bossId === e.id) this.beam = null;
    e.mode = "dead";
    this.addScore(points);
    this.callbacks.onSound?.("hit");
  }

  // Adds points and grants extra lives at 20,000, 70,000 and every 70,000 after.
  private addScore(points: number): void {
    this.score = clampScore(this.score + points);
    while (this.score >= this.nextExtraLife) {
      if (this.lives < MAX_LIVES) {
        this.lives++;
        this.callbacks.onSound?.("extraLife");
      }
      this.nextExtraLife =
        this.nextExtraLife === EXTRA_LIFE_FIRST ? EXTRA_LIFE_STEP : this.nextExtraLife + EXTRA_LIFE_STEP;
    }
  }

  // ── Run end and callbacks ──────────────────────────────────────────────────

  // Stops the engine for good (until destroy) and reports the final score once.
  private finishRun(): void {
    if (this.finished) return;
    this.finished = true;
    this.phase = "over";
    this.fighter.alive = false;
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
    if (this.emittedLevel !== this.stage) {
      this.emittedLevel = this.stage;
      this.callbacks.onLevel(this.stage);
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
    this.stage = 1;
    this.nextExtraLife = EXTRA_LIFE_FIRST;
    this.fired = 0;
    this.hits = 0;
    this.nextId = 1;
    this.clock = 0;
    this.lastShotAt = -1;
    this.lastTime = null;
    this.fighter = { x: W / 2, dual: false, alive: true, state: "playing", respawnIn: 0 };
    this.stars = createStars();
    this.held.clear();
    this.beginStage();
  }

  // ── Drawing ────────────────────────────────────────────────────────────────

  private bannerLines(palette: DogfightPalette): BannerLine[] {
    const color = palette.text;
    if (this.phase === "banner") {
      if (this.challenging) return [{ text: "CHALLENGING STAGE", size: 24, color }];
      const lines: BannerLine[] = [{ text: `STAGE ${this.stage}`, size: 28, color }];
      if (this.stage === 1) lines.push({ text: "READY", size: 20, color });
      return lines;
    }
    if (this.capture) return [{ text: "FIGHTER CAPTURED", size: 22, color }];
    if (this.phase === "clearing" || this.phase === "stats") {
      const lines: BannerLine[] = [];
      if (this.perfect) {
        lines.push({ text: "PERFECT!", size: 28, color });
        lines.push({ text: `BONUS ${SCORES.perfect}`, size: 16, color });
      }
      if (this.phase === "stats") {
        if (this.challenging) {
          lines.push({ text: `NUMBER OF HITS ${this.challengeHits}`, size: 16, color });
        } else {
          const ratio = this.fired > 0 ? ((this.hits / this.fired) * 100).toFixed(1) : "0.0";
          lines.push({ text: `SHOTS FIRED ${this.fired}`, size: 16, color });
          lines.push({ text: `NUMBER OF HITS ${this.hits}`, size: 16, color });
          lines.push({ text: `HIT-MISS RATIO ${ratio}%`, size: 16, color });
        }
      }
      return lines;
    }
    return [];
  }

  private draw(): void {
    if (this.destroyed) return;
    const ctx = this.ctx;
    const palette = SKINS[this.skin];
    drawField(ctx, palette);
    drawStars(ctx, this.stars, palette, this.clock);
    if (this.beam) drawBeam(ctx, this.beam, palette);

    const flap = Math.floor(this.clock * 3) % 2;
    for (const e of this.enemies) {
      if (!this.isVisible(e)) continue;
      drawEnemy(ctx, e, palette, flap);
      if (e.carrying) drawCapturedShip(ctx, e.x, e.y - 24, 0, palette.captured);
    }
    if (this.pod) drawCapturedShip(ctx, this.pod.x, this.pod.y, this.pod.angle, palette.captured);

    const f = this.fighter;
    if (f.state === "playing" || f.state === "ready") drawFighter(ctx, f.x, f.dual, palette);
    if (this.capture) {
      const boss = this.enemies.find((e) => e.id === this.capture?.bossId);
      if (boss) {
        const k = smooth(this.capture.t / CAPTURE_TIME);
        const x = this.capture.x0 + (boss.x - this.capture.x0) * k;
        const y = this.capture.y0 + (boss.y + 26 - this.capture.y0) * k;
        drawCapturedShip(ctx, x, y, this.capture.t * 12, palette.captured);
      }
    }

    for (const s of this.shots) drawShot(ctx, s, palette.shot, palette.glow);
    for (const es of this.enemyShots) drawEnemyShot(ctx, es, palette.enemyShot);

    drawReserve(ctx, this.lives - 1, palette);
    drawBadges(ctx, this.stage, palette);
    const lines = this.bannerLines(palette);
    if (lines.length > 0) drawBanner(ctx, lines, H / 2);
  }
}
