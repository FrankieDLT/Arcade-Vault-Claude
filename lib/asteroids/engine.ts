import {
  H,
  HYPER_DURATION,
  POINTS,
  POWERUP_CHANCE,
  POWERUP_KEYS,
  POWERUP_TYPES,
  SHIELD_DURATION,
  SLOW_DURATION,
  SLOW_FACTOR,
  TRIPLE_DURATION,
  W,
  type PowerUpType,
} from "./constants";
import { Asteroid, Particle, PowerUp, Ship, type Bullet } from "./entities";
import { dist, rainbow, rand } from "./utils";

export interface AsteroidsCallbacks {
  onScore: (score: number) => void; // called when the score changes
  onLives: (lives: number) => void; // called when lives change
  onLevel: (level: number) => void; // called when the level changes
  onGameOver: (finalScore: number) => void; // called once per run when lives reach 0
}

type RunState = "playing" | "dead" | "gameover";

const GAME_KEYS = new Set(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

export class AsteroidsEngine {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly callbacks: AsteroidsCallbacks;

  // Lifecycle
  private started = false;
  private paused = false;
  private finished = false; // onGameOver already fired for this run
  private destroyed = false;
  private listening = false;
  private rafId: number | null = null;
  private lastTime: number | null = null;

  // Input (held keys, fed by window listeners)
  private keys: Record<string, boolean> = {};

  // Game state (instance-owned, nothing shared between engines)
  private ship = new Ship();
  private bullets: Bullet[] = [];
  private asteroids: Asteroid[] = [];
  private particles: Particle[] = [];
  private powerUps: PowerUp[] = [];
  private score = 0;
  private lives = 3;
  private level = 1;
  private bombFlash = 0;
  // Kept here, not in Ship, so they survive ship.reset() between levels.
  private slowTimer = 0;
  private tripleTimer = 0;
  private state: RunState = "playing";
  private deadTimer = 0;

  // Last values sent to the callbacks, so they only fire on change.
  private emitted = { score: NaN, lives: NaN, level: NaN };

  constructor(canvas: HTMLCanvasElement, callbacks: AsteroidsCallbacks) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("AsteroidsEngine: 2D canvas context is not available");
    this.ctx = ctx;
    this.callbacks = callbacks;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

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
    this.keys = {};
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
    this.state = "gameover";
    this.emitChanges();
    this.finishRun();
  }

  destroy(): void {
    this.destroyed = true;
    this.cancelFrame();
    this.detachListeners();
    this.keys = {};
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
    const dt = this.lastTime === null ? 0 : Math.min((ts - this.lastTime) / 1000, 0.05);
    this.lastTime = ts;
    this.update(dt);
    this.emitChanges();
    this.draw();
    if (this.state === "gameover") {
      this.finishRun();
      return;
    }
    this.schedule();
  };

  // Stops the engine for good (until destroy) and reports the final score once.
  private finishRun(): void {
    if (this.finished) return;
    this.finished = true;
    this.cancelFrame();
    this.detachListeners();
    this.keys = {};
    this.draw();
    this.callbacks.onGameOver(this.score);
  }

  private emitChanges(): void {
    if (this.emitted.score !== this.score) {
      this.emitted.score = this.score;
      this.callbacks.onScore(this.score);
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
    if (this.paused || this.finished) return;
    this.keys[e.code] = true;
    if (GAME_KEYS.has(e.code)) e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys[e.code] = false;
  };

  private clearKeys = (): void => {
    this.keys = {};
  };

  private onVisibility = (): void => {
    if (document.hidden) this.keys = {};
  };

  // ── Game state ─────────────────────────────────────────────────────────────

  private initGame(): void {
    this.ship = new Ship();
    this.bullets = [];
    this.asteroids = [];
    this.particles = [];
    this.powerUps = [];
    this.bombFlash = 0;
    this.slowTimer = 0;
    this.tripleTimer = 0;
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.state = "playing";
    this.deadTimer = 0;
    this.emitted = { score: NaN, lives: NaN, level: NaN };
    this.spawnAsteroids(4);
  }

  private spawnAsteroids(count: number): void {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x: number;
      let y: number;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      this.asteroids.push(new Asteroid(x, y, 3));
    }
  }

  private nextLevel(): void {
    this.level++;
    this.bullets = [];
    this.particles = [];
    this.powerUps = [];
    this.ship.reset();
    this.spawnAsteroids(3 + this.level);
  }

  private explode(x: number, y: number, count = 8): void {
    for (let i = 0; i < count; i++) this.particles.push(new Particle(x, y));
  }

  private maybeDropPowerUp(a: Asteroid): void {
    if (Math.random() >= POWERUP_CHANCE) return;
    let roll = Math.random() * POWERUP_KEYS.reduce((s, k) => s + POWERUP_TYPES[k].weight, 0);
    const type = POWERUP_KEYS.find((k) => (roll -= POWERUP_TYPES[k].weight) < 0) ?? POWERUP_KEYS[0];
    this.powerUps.push(new PowerUp(a.x, a.y, type));
  }

  private applyPowerUp(type: PowerUpType): void {
    if (type === "bomb") this.detonateBomb();
    if (type === "hyper") this.ship.hyper = HYPER_DURATION;
    if (type === "shield") this.ship.shield = SHIELD_DURATION;
    if (type === "slow") this.slowTimer = SLOW_DURATION;
    if (type === "triple") this.tripleTimer = TRIPLE_DURATION;
  }

  private destroyAsteroid(a: Asteroid, newAsteroids: Asteroid[]): void {
    a.dead = true;
    this.score += POINTS[a.size];
    this.explode(a.x, a.y, a.size * 5);
    this.maybeDropPowerUp(a);
    newAsteroids.push(...a.split());
  }

  private detonateBomb(): void {
    for (const a of this.asteroids) {
      if (a.dead) continue;
      this.score += POINTS[a.size];
      this.explode(a.x, a.y, a.size * 5);
      this.maybeDropPowerUp(a);
    }
    this.asteroids = [];
    this.bombFlash = 0.25;
  }

  private killShip(): void {
    this.explode(this.ship.x, this.ship.y, 14);
    this.ship.dead = true;
    this.ship.hyper = 0;
    this.tripleTimer = 0;
    this.lives--;
    if (this.lives <= 0) {
      this.state = "gameover";
    } else {
      this.state = "dead";
      this.deadTimer = 2;
    }
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  private update(dt: number): void {
    if (this.state === "gameover") return;

    if (this.state === "dead") {
      this.deadTimer -= dt;
      this.slowTimer = Math.max(0, this.slowTimer - dt);
      this.particles.forEach((p) => p.update(dt));
      this.particles = this.particles.filter((p) => !p.dead);
      this.powerUps.forEach((p) => p.update(dt));
      this.powerUps = this.powerUps.filter((p) => !p.dead);
      const slowDt = this.slowTimer > 0 ? dt * SLOW_FACTOR : dt;
      this.asteroids.forEach((a) => a.update(slowDt));
      if (this.deadTimer <= 0) {
        this.state = "playing";
        this.ship.reset();
      }
      return;
    }

    const ship = this.ship;

    // Fire
    if (this.keys["Space"]) {
      this.bullets.push(...ship.tryShoot(this.tripleTimer > 0));
    }

    this.slowTimer = Math.max(0, this.slowTimer - dt);
    if (this.tripleTimer > 0) this.tripleTimer -= dt;
    const asteroidDt = this.slowTimer > 0 ? dt * SLOW_FACTOR : dt;

    ship.update(dt, {
      left: !!this.keys["ArrowLeft"],
      right: !!this.keys["ArrowRight"],
      up: !!this.keys["ArrowUp"],
    });
    this.bullets.forEach((b) => b.update(dt));
    this.asteroids.forEach((a) => a.update(asteroidDt));
    this.particles.forEach((p) => p.update(dt));
    this.powerUps.forEach((p) => p.update(dt));
    if (this.bombFlash > 0) this.bombFlash -= dt;

    this.bullets = this.bullets.filter((b) => !b.dead);
    this.particles = this.particles.filter((p) => !p.dead);
    this.powerUps = this.powerUps.filter((p) => !p.dead);

    // Bullet vs asteroid
    const newAsteroids: Asteroid[] = [];
    for (const b of this.bullets) {
      for (const a of this.asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          this.destroyAsteroid(a, newAsteroids);
        }
      }
    }

    // Ship vs asteroid (HyperMode and invincibility make it immune; the shield absorbs one hit)
    if (ship.invincible <= 0 && ship.hyper <= 0) {
      for (const a of this.asteroids) {
        if (!a.dead && dist(ship, a) < ship.radius + a.radius * 0.82) {
          if (ship.shield > 0) {
            ship.shield = 0;
            ship.invincible = 1;
            this.destroyAsteroid(a, newAsteroids);
          } else {
            this.killShip();
          }
          break;
        }
      }
    }

    this.asteroids = this.asteroids.filter((a) => !a.dead).concat(newAsteroids);
    this.bullets = this.bullets.filter((b) => !b.dead);

    // Ship vs power-up
    if (!ship.dead) {
      for (const p of this.powerUps) {
        if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
          p.dead = true;
          this.applyPowerUp(p.type);
        }
      }
      this.powerUps = this.powerUps.filter((p) => !p.dead);
    }

    // Level cleared
    if (this.asteroids.length === 0 && this.state === "playing") this.nextLevel();
  }

  // ── Draw ───────────────────────────────────────────────────────────────────

  // Playfield and power-up timers only. Score, level, lives and the GAME OVER
  // overlay belong to the platform HUD and modal.
  private draw(): void {
    const ctx = this.ctx;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    this.particles.forEach((p) => p.draw(ctx));
    this.asteroids.forEach((a) => a.draw(ctx));
    this.powerUps.forEach((p) => p.draw(ctx));
    this.bullets.forEach((b) => b.draw(ctx));
    this.ship.draw(ctx);

    if (this.bombFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${((this.bombFlash / 0.25) * 0.5).toFixed(2)})`;
      ctx.fillRect(0, 0, W, H);
    }

    this.drawTimers();
  }

  private drawTimers(): void {
    const ctx = this.ctx;
    ctx.font = "15px monospace";
    ctx.textBaseline = "alphabetic";

    if (this.ship.hyper > 0) {
      ctx.fillStyle = rainbow();
      ctx.textAlign = "left";
      ctx.fillText(`HYPERMODE ${this.ship.hyper.toFixed(1)}s`, 14, 26);
    }

    if (this.tripleTimer > 0) {
      ctx.fillStyle = "#0ff";
      ctx.textAlign = "left";
      ctx.fillText(`TRIPLE  ${Math.ceil(this.tripleTimer)}s`, 14, 46);
    }

    if (this.slowTimer > 0) {
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(`SLOWMO ${this.slowTimer.toFixed(1)}s`, W / 2, 26);
    }
  }
}
