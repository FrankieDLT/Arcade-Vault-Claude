import {
  COMPANION_H,
  COMPANION_RISE,
  COMPANION_TIME,
  COMPANION_W,
  DEFAULT_SKIN,
  ESCAPE_TIME,
  FALL_TIME,
  HEIGHT,
  KIND_POINTS,
  MAX_DT,
  PERFECT_BONUS,
  ROUND_BANNER_TIME,
  ROUND_RESULT_TIME,
  ROUND_TARGETS,
  SCENE_COMPANION,
  SCENE_FLOOR,
  SHOTS_PER_WAVE,
  SKINS,
  WALL_MARGIN,
  WIDTH,
  WOBBLE_AMPLITUDE,
  WOBBLE_RATE,
  type CompanionPose,
  type TargetKind,
} from "./constants";
import {
  buildCompanion,
  companionMotion,
  type CompanionSprites,
} from "./companions";
import {
  buildSprites,
  drawTarget,
  type SpriteSet,
  type Target,
} from "./entities";
import { drawShotEffect, renderScene } from "./scenes";
import {
  clampRound,
  clampScore,
  decoyInWave,
  flightTime,
  hitRadius,
  pickKind,
  quota,
  targetSpeed,
  targetsPerWave,
} from "./utils";

export type WingshotSound =
  | "shot"
  | "hit"
  | "rare"
  | "escape"
  | "decoy"
  | "roundStart"
  | "roundClear"
  | "perfect"
  | "gameover"
  | "cheer" // companion, wave with at least one real hit
  | "blooper"; // companion, wave with no real hit

export interface WingshotCallbacks {
  onScore: (score: number) => void;
  onLines: (hitsThisRound: number) => void; // shown as "Hits"
  onLevel: (round: number) => void;
  onGameOver: (score: number) => void; // once per run
  onSound?: (name: WingshotSound) => void;
  onHaptic?: (name: "brick" | "clear" | "death") => void;
}

export interface WingshotOptions {
  skin?: string; // default "retro"
}

type Phase = "banner" | "wave" | "companion" | "result" | "over";
type Tick = "pending" | "hit" | "miss";

interface ShotFx {
  x: number;
  y: number;
  age: number; // s
}

const FX_TIME = 0.28;
const FONT = "bold 40px monospace";

export class WingshotEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly callbacks: WingshotCallbacks;
  private skin: string;

  // Lifecycle
  private started = false;
  private paused = false;
  private finished = false; // onGameOver already fired for this run
  private destroyed = false;
  private listening = false;
  private rafId: number | null = null;
  private lastTime: number | null = null;

  // Skin-derived art (rebuilt by setSkin only)
  private sceneImg: HTMLCanvasElement | null = null;
  private sprites: SpriteSet | null = null;
  private companionSprites: CompanionSprites | null = null;

  // State
  private phase: Phase = "banner";
  private phaseTime = 0; // s in the current phase
  private companionPose: CompanionPose | null = null;
  private companionX = WIDTH / 2;
  private round = 1;
  private waveIndex = 0;
  private shotsLeft = SHOTS_PER_WAVE;
  private hitsThisRound = 0;
  private score = 0;
  private ticks: Tick[] = [];
  private targets: Target[] = [];
  private fx: ShotFx[] = [];
  private nextId = 1;
  private waveHitReal = false; // a non-decoy target of this wave was hit
  private lastResolvedX = WIDTH / 2;
  private escapeSoundDone = false;
  private resultText: string[] = [];
  private resultFails = false;
  private clock = 0; // s, advanced only in update

  // Last values sent to the callbacks, so they only fire on change.
  private emittedScore = NaN;
  private emittedHits = NaN;
  private emittedRound = NaN;

  constructor(
    canvas: HTMLCanvasElement,
    callbacks: WingshotCallbacks,
    options: WingshotOptions = {},
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx)
      throw new Error("WingshotEngine: 2D canvas context is not available");
    this.canvas = canvas;
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.skin =
      options.skin !== undefined && Object.hasOwn(SKINS, options.skin)
        ? options.skin
        : DEFAULT_SKIN;
    this.buildArt();
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
    this.emitSound("roundStart");
    this.attachListeners();
    this.draw();
    this.schedule();
  }

  pause(): void {
    if (!this.started || this.destroyed || this.finished || this.paused) return;
    this.paused = true;
    this.cancelFrame();
    this.draw();
  }

  resume(): void {
    if (!this.started || this.destroyed || this.finished || !this.paused)
      return;
    this.paused = false;
    this.lastTime = null;
    this.schedule();
  }

  /** Ends the run at once (END button). */
  end(): void {
    if (!this.started || this.destroyed || this.finished) return;
    this.resultText = [];
    this.gameOver();
  }

  destroy(): void {
    this.destroyed = true;
    this.cancelFrame();
    this.detachListeners();
  }

  /** Swaps scene, sprites, companion and palette at once; state and timers are untouched. */
  setSkin(skin: string): void {
    if (this.destroyed || !Object.hasOwn(SKINS, skin) || skin === this.skin)
      return;
    this.skin = skin;
    this.buildArt();
    this.draw();
  }

  // ── Setup ──────────────────────────────────────────────────────────────────

  private buildArt(): void {
    const { scene, palette } = SKINS[this.skin];
    this.sceneImg = renderScene(scene, palette);
    this.sprites = buildSprites(scene, palette);
    this.companionSprites = buildCompanion(palette, SCENE_COMPANION[scene]);
  }

  private initGame(): void {
    this.phase = "banner";
    this.phaseTime = 0;
    this.companionPose = null;
    this.companionX = WIDTH / 2;
    this.round = 1;
    this.score = 0;
    this.targets = [];
    this.fx = [];
    this.clock = 0;
    this.finished = false;
    this.resetRound();
  }

  private resetRound(): void {
    this.waveIndex = 0;
    this.shotsLeft = SHOTS_PER_WAVE;
    this.hitsThisRound = 0;
    this.ticks = Array.from({ length: ROUND_TARGETS }, () => "pending" as Tick);
    this.phase = "banner";
    this.phaseTime = 0;
  }

  private attachListeners(): void {
    if (this.listening) return;
    this.listening = true;
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
  }

  private detachListeners(): void {
    if (!this.listening) return;
    this.listening = false;
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  private onPointerDown = (e: PointerEvent): void => {
    if (e.button > 0) return; // main button, touch and pen contact only
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = ((e.clientX - rect.left) * WIDTH) / rect.width;
    const y = ((e.clientY - rect.top) * HEIGHT) / rect.height;
    this.shoot(x, y, e.pointerType);
  };

  private shoot(x: number, y: number, pointerType: string): void {
    if (
      !this.started ||
      this.paused ||
      this.finished ||
      this.destroyed ||
      this.phase !== "wave" ||
      this.shotsLeft <= 0
    ) {
      return;
    }
    this.shotsLeft -= 1;
    this.fx.push({ x, y, age: 0 });
    this.emitSound("shot");

    const radius = hitRadius(pointerType);
    let best: Target | null = null;
    let bestD = radius;
    for (const t of this.targets) {
      if (t.state !== "fly") continue;
      const d = Math.hypot(t.x - x, t.y - y);
      if (d <= bestD) {
        best = t;
        bestD = d;
      }
    }
    if (best) this.hitTarget(best);
    if (this.shotsLeft <= 0) this.releaseSurvivors();
    this.draw();
  }

  private hitTarget(t: Target): void {
    t.state = "fall";
    t.timer = FALL_TIME;
    t.spin = 0;
    this.lastResolvedX = t.x;
    this.score = clampScore(this.score + KIND_POINTS[t.kind]);
    if (t.kind === "decoy") {
      this.emitSound("decoy");
    } else {
      this.waveHitReal = true;
      this.emitSound(t.kind === "rare" ? "rare" : "hit");
      this.callbacks.onHaptic?.("brick");
    }
    if (t.quota) {
      this.hitsThisRound += 1;
      this.ticks[t.slot] = "hit";
    }
    this.emitChanges();
    // Every quota target of the wave is settled: a leftover decoy leaves at once.
    this.releaseDecoys();
  }

  /** Targets alive when the shots run out fly off the top (a miss). */
  private releaseSurvivors(): void {
    for (const t of this.targets) if (t.state === "fly") this.escape(t);
  }

  private releaseDecoys(): void {
    const quotaLeft = this.targets.some((t) => t.quota && t.state === "fly");
    if (quotaLeft) return;
    for (const t of this.targets)
      if (t.state === "fly" && !t.quota) this.escape(t);
  }

  private escape(t: Target): void {
    t.state = "escape";
    t.timer = ESCAPE_TIME;
    this.lastResolvedX = t.x;
    if (t.quota) {
      this.ticks[t.slot] = "miss";
      if (!this.escapeSoundDone) {
        this.escapeSoundDone = true;
        this.emitSound("escape");
      }
    }
  }

  // ── Loop ───────────────────────────────────────────────────────────────────

  private schedule(): void {
    if (this.rafId !== null || this.destroyed || this.finished) return;
    this.rafId = requestAnimationFrame(this.frame);
  }

  private cancelFrame(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.lastTime = null;
  }

  private frame = (time: number): void => {
    this.rafId = null;
    if (this.destroyed || this.paused || this.finished) return;
    const dt =
      this.lastTime === null
        ? 0
        : Math.min(MAX_DT, (time - this.lastTime) / 1000);
    this.lastTime = time;
    this.update(dt);
    this.draw();
    this.schedule();
  };

  private update(dt: number): void {
    this.clock += dt;
    this.phaseTime += dt;
    for (const f of this.fx) f.age += dt;
    this.fx = this.fx.filter((f) => f.age < FX_TIME);

    for (const t of this.targets) this.stepTarget(t, dt);
    this.targets = this.targets.filter((t) => t.state !== "gone");

    switch (this.phase) {
      case "banner":
        if (this.phaseTime >= ROUND_BANNER_TIME) this.startWave();
        break;
      case "wave":
        if (this.targets.length === 0) this.endWave();
        break;
      case "companion":
        if (this.phaseTime >= COMPANION_TIME) this.afterCompanion();
        break;
      case "result":
        if (this.phaseTime >= ROUND_RESULT_TIME) this.afterResult();
        break;
      default:
        break;
    }
  }

  private stepTarget(t: Target, dt: number): void {
    if (t.state === "fly") {
      t.age += dt;
      t.bx += t.vx * dt;
      t.by += t.vy * dt;
      const floor = SCENE_FLOOR[SKINS[this.skin].scene];
      if (t.bx < WALL_MARGIN) {
        t.bx = WALL_MARGIN;
        t.vx = Math.abs(t.vx);
      } else if (t.bx > WIDTH - WALL_MARGIN) {
        t.bx = WIDTH - WALL_MARGIN;
        t.vx = -Math.abs(t.vx);
      }
      if (t.by < WALL_MARGIN + 24) {
        t.by = WALL_MARGIN + 24;
        t.vy = Math.abs(t.vy);
      } else if (t.by > floor) {
        t.by = floor;
        t.vy = -Math.abs(t.vy);
      }
      t.flip = t.vx < 0;
      const speed = Math.hypot(t.vx, t.vy) || 1;
      const nx = -t.vy / speed;
      const ny = t.vx / speed;
      const w =
        Math.sin(t.age * WOBBLE_RATE * Math.PI * 2 + t.phase) *
        WOBBLE_AMPLITUDE;
      t.x = t.bx + nx * w;
      t.y = t.by + ny * w;
      if (t.age >= t.flightTime) this.escape(t);
    } else if (t.state === "fall") {
      t.timer -= dt;
      t.spin += dt * 9;
      t.y += (1 - Math.max(0, t.timer) / FALL_TIME + 0.3) * 520 * dt;
      if (t.timer <= 0) t.state = "gone";
    } else if (t.state === "escape") {
      t.timer -= dt;
      t.y -= ((t.y + 90) / Math.max(0.05, t.timer + dt)) * dt;
      if (t.timer <= 0) t.state = "gone";
    }
  }

  // ── Flow ───────────────────────────────────────────────────────────────────

  private startWave(): void {
    this.phase = "wave";
    this.phaseTime = 0;
    this.shotsLeft = SHOTS_PER_WAVE;
    this.waveHitReal = false;
    this.escapeSoundDone = false;
    this.companionPose = null;
    const per = targetsPerWave(this.round);
    for (let i = 0; i < per; i++) {
      const kind = pickKind(this.round, Math.random());
      this.targets.push(this.spawn(kind, true, this.waveIndex * per + i));
    }
    if (decoyInWave(this.round, Math.random())) {
      this.targets.push(this.spawn("decoy", false, -1));
    }
  }

  private spawn(kind: TargetKind, isQuota: boolean, slot: number): Target {
    const floor = SCENE_FLOOR[SKINS[this.skin].scene];
    const speed = targetSpeed(this.round, kind);
    const heading = ((20 + Math.random() * 140) * Math.PI) / 180;
    const x = 80 + Math.random() * (WIDTH - 160);
    return {
      id: this.nextId++,
      kind,
      quota: isQuota,
      slot,
      state: "fly",
      bx: x,
      by: floor,
      vx: Math.cos(heading) * speed,
      vy: -Math.sin(heading) * speed,
      age: 0,
      timer: 0,
      phase: Math.random() * Math.PI * 2,
      flightTime: flightTime(this.round),
      x,
      y: floor,
      spin: 0,
      flip: false,
    };
  }

  private endWave(): void {
    this.phase = "companion";
    this.phaseTime = 0;
    this.companionPose = this.waveHitReal ? "cheer" : "gag";
    this.companionX = Math.max(100, Math.min(700, this.lastResolvedX));
    this.emitSound(this.waveHitReal ? "cheer" : "blooper");
  }

  private afterCompanion(): void {
    this.companionPose = null;
    const per = targetsPerWave(this.round);
    const waves = ROUND_TARGETS / per;
    if (this.waveIndex + 1 < waves) {
      this.waveIndex += 1;
      this.startWave();
    } else {
      this.finishRound();
    }
  }

  private finishRound(): void {
    this.phase = "result";
    this.phaseTime = 0;
    const need = quota(this.round);
    const hits = this.hitsThisRound;
    const lines = [`${hits} / ${ROUND_TARGETS} HITS`];
    if (hits >= need) {
      this.resultFails = false;
      this.emitSound("roundClear");
      this.callbacks.onHaptic?.("clear");
      if (hits === ROUND_TARGETS) {
        const bonus = PERFECT_BONUS * this.round;
        this.score = clampScore(this.score + bonus);
        lines.push(`PERFECT +${bonus}`);
        this.emitSound("perfect");
      } else {
        lines.push("ROUND CLEAR");
      }
      this.emitChanges();
    } else {
      this.resultFails = true;
      lines[0] = `${hits} / ${ROUND_TARGETS} HITS · NEED ${need}`;
    }
    this.resultText = lines;
  }

  private afterResult(): void {
    if (this.resultFails) {
      this.gameOver();
      return;
    }
    this.round = clampRound(this.round + 1);
    this.resetRound();
    this.emitChanges();
    this.emitSound("roundStart");
  }

  private gameOver(): void {
    if (this.finished) return;
    this.finished = true;
    this.phase = "over";
    this.cancelFrame();
    this.detachListeners();
    this.emitChanges();
    this.emitSound("gameover");
    this.callbacks.onHaptic?.("death");
    this.draw();
    this.callbacks.onGameOver(this.score);
  }

  // ── Callbacks ──────────────────────────────────────────────────────────────

  private emitSound(name: WingshotSound): void {
    this.callbacks.onSound?.(name);
  }

  private emitChanges(): void {
    if (this.score !== this.emittedScore) {
      this.emittedScore = this.score;
      this.callbacks.onScore(this.score);
    }
    if (this.hitsThisRound !== this.emittedHits) {
      this.emittedHits = this.hitsThisRound;
      this.callbacks.onLines(this.hitsThisRound);
    }
    if (this.round !== this.emittedRound) {
      this.emittedRound = this.round;
      this.callbacks.onLevel(this.round);
    }
  }

  // ── Drawing ────────────────────────────────────────────────────────────────

  private draw(): void {
    const ctx = this.ctx;
    const { scene, palette } = SKINS[this.skin];
    ctx.imageSmoothingEnabled = false;
    if (this.sceneImg) ctx.drawImage(this.sceneImg, 0, 0);

    if (this.sprites) {
      for (const t of this.targets)
        drawTarget(ctx, this.sprites, t, this.clock);
    }
    this.drawCompanion();
    for (const f of this.fx) {
      drawShotEffect(ctx, scene, palette, f.x, f.y, f.age / FX_TIME);
    }
    this.drawHud();
    if (this.phase === "banner") {
      this.drawPlate([
        `ROUND ${this.round}`,
        `HIT ${quota(this.round)} OF ${ROUND_TARGETS}`,
      ]);
    } else if (this.phase === "result" || this.phase === "over") {
      if (this.resultText.length) this.drawPlate(this.resultText);
    }
  }

  private drawCompanion(): void {
    if (
      this.phase !== "companion" ||
      !this.companionPose ||
      !this.companionSprites
    ) {
      return;
    }
    const ctx = this.ctx;
    const t = this.phaseTime;
    const rise = Math.min(1, t / COMPANION_RISE);
    const sink = Math.min(
      1,
      Math.max(0, (COMPANION_TIME - t) / COMPANION_RISE),
    );
    const vis = Math.min(rise, sink);
    const offset = (1 - vis * vis * (3 - 2 * vis)) * COMPANION_H;
    const m = companionMotion(
      SCENE_COMPANION[SKINS[this.skin].scene],
      this.companionPose,
      Math.max(0, t - COMPANION_RISE),
    );
    const img = this.companionSprites[this.companionPose][m.frame];
    ctx.save();
    ctx.translate(
      Math.round(this.companionX + m.dx),
      Math.round(HEIGHT - COMPANION_H / 2 + offset + m.dy),
    );
    if (m.rot) ctx.rotate(m.rot);
    ctx.drawImage(img, -COMPANION_W / 2, -COMPANION_H / 2);
    ctx.restore();
  }

  private drawHud(): void {
    const ctx = this.ctx;
    const { palette } = SKINS[this.skin];
    // Quota ticks, top centre. The marker under a tick shows the hit count to reach.
    const size = 20;
    const gap = 8;
    const total = ROUND_TARGETS * size + (ROUND_TARGETS - 1) * gap;
    const x0 = (WIDTH - total) / 2;
    const y0 = 14;
    const need = quota(this.round);
    ctx.fillStyle = palette.hudPanel ?? "rgba(0,0,0,0.35)";
    ctx.fillRect(x0 - 10, y0 - 8, total + 20, size + 28);
    for (let i = 0; i < ROUND_TARGETS; i++) {
      const x = x0 + i * (size + gap);
      const tick = this.ticks[i];
      if (tick === "hit") {
        ctx.fillStyle = palette.accent;
        ctx.fillRect(x, y0, size, size);
      } else if (tick === "miss") {
        ctx.fillStyle = palette.bad;
        ctx.fillRect(x, y0, size, size);
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + 4, y0 + 4);
        ctx.lineTo(x + size - 4, y0 + size - 4);
        ctx.moveTo(x + size - 4, y0 + 4);
        ctx.lineTo(x + 4, y0 + size - 4);
        ctx.stroke();
      } else {
        ctx.strokeStyle = palette.ink;
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 1.5, y0 + 1.5, size - 3, size - 3);
      }
    }
    ctx.fillStyle = palette.accent;
    const mx = x0 + (need - 1) * (size + gap) + size / 2;
    ctx.beginPath();
    ctx.moveTo(mx, y0 + size + 4);
    ctx.lineTo(mx - 6, y0 + size + 14);
    ctx.lineTo(mx + 6, y0 + size + 14);
    ctx.closePath();
    ctx.fill();

    // Ammo pips, bottom left.
    for (let i = 0; i < SHOTS_PER_WAVE; i++) {
      const cx = 30 + i * 30;
      const cy = HEIGHT - 28;
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      if (i < this.shotsLeft && this.phase === "wave") {
        ctx.fillStyle = palette.accent;
        ctx.fill();
      }
      ctx.strokeStyle = palette.ink;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  private drawPlate(lines: string[]): void {
    const ctx = this.ctx;
    const { palette } = SKINS[this.skin];
    const h = 40 + lines.length * 52;
    const w = 600;
    const x = (WIDTH - w) / 2;
    const y = HEIGHT / 2 - h / 2 - 30;
    ctx.fillStyle = palette.platePanel ?? "rgba(0,0,0,0.6)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 4;
    ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    lines.forEach((line, i) => {
      ctx.font = i === 0 ? FONT : "bold 28px monospace";
      ctx.fillStyle =
        i === 0 ? (palette.plateTitle ?? "#ffffff") : palette.accent;
      ctx.fillText(line, WIDTH / 2, y + 46 + i * 52);
    });
  }
}
