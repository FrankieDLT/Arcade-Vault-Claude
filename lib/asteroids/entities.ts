import {
  H,
  POWERUP_TYPES,
  RADII,
  SPEEDS,
  SPREAD,
  W,
  BIG_VARIANT,
  type PowerUpType,
} from "./constants";
import { rainbow, rand, randInt, wrap } from "./utils";

// ── Bullet ───────────────────────────────────────────────────────────────────
export class Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl = 1.1;
  radius = 2;
  dead = false;
  rainbow = false;

  constructor(x: number, y: number, angle: number) {
    const SPEED = 520;
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
  }

  update(dt: number): void {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.rainbow ? rainbow() : "#fff";
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ─────────────────────────────────────────────────────────────────
export class Asteroid {
  x: number;
  y: number;
  size: number;
  radius: number;
  dead = false;
  vx: number;
  vy: number;
  rotSpeed: number;
  rot: number;
  verts: Array<[number, number]> = [];

  constructor(x: number, y: number, size = 3) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.radius = RADII[size];

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Irregular polygon (big ones use the traced shape half of the time)
    if (size === 3 && Math.random() < 0.5) {
      this.verts = BIG_VARIANT.map(([vx, vy]): [number, number] => [
        vx * this.radius,
        vy * this.radius,
      ]);
      return;
    }
    const n = randInt(8, 13);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt: number): void {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split(): Asteroid[] {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++) ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Ship ─────────────────────────────────────────────────────────────────────
export interface ShipInput {
  left: boolean;
  right: boolean;
  up: boolean;
}

export class Ship {
  x = W / 2;
  y = H / 2;
  angle = -Math.PI / 2;
  vx = 0;
  vy = 0;
  radius = 12;
  // Remaining HyperMode seconds. Survives reset() between levels; killShip clears it.
  hyper = 0;
  thrusting = false;
  invincible = 3;
  shootCooldown = 0;
  shield = 0;
  dead = false;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.x = W / 2;
    this.y = H / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.radius = 12;
    this.thrusting = false;
    this.invincible = 3;
    this.shootCooldown = 0;
    this.shield = 0;
    this.dead = false;
  }

  update(dt: number, input: ShipInput): void {
    if (this.dead) return;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.hyper > 0) this.hyper -= dt;
    if (this.shield > 0) this.shield -= dt;

    const boost = this.hyper > 0 ? 2 : 1;
    const ROT = 3.5 * boost; // rad/s
    const THRUST = 260 * boost; // px/s²
    const DRAG = 0.987; // applied per frame, as in the original

    if (input.left) this.angle -= ROT * dt;
    if (input.right) this.angle += ROT * dt;

    this.thrusting = input.up;
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  // `triple` is true while the engine's Triple timer is active.
  tryShoot(triple: boolean): Bullet[] {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = this.hyper > 0 ? 0.1 : 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    const angles = triple ? [-SPREAD, 0, SPREAD] : [0];
    return angles.map((d) => {
      const b = new Bullet(ox, oy, this.angle + d);
      b.rainbow = this.hyper > 0;
      return b;
    });
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.dead) return;

    // Shield (blinks during its last second)
    if (this.shield > 0 && (this.shield >= 1 || Math.floor(this.shield * 10) % 2 === 0)) {
      ctx.strokeStyle = "#4ff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 22, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Blink while invincible after respawn
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = this.hyper > 0 ? rainbow() : "#fff";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";

    // Classic silhouette: triangle with a rear notch
    ctx.beginPath();
    ctx.moveTo(20, 0); // nose
    ctx.lineTo(-12, -9); // left wing
    ctx.lineTo(-7, 0); // rear notch
    ctx.lineTo(-12, 9); // right wing
    ctx.closePath();
    ctx.stroke();

    // Thruster flame
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8, 4);
      ctx.strokeStyle = "rgba(255, 130, 0, 0.85)";
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Particle (explosion) ─────────────────────────────────────────────────────
export class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  dead = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl = this.life;
  }

  update(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── PowerUp ──────────────────────────────────────────────────────────────────
export class PowerUp {
  x: number;
  y: number;
  type: PowerUpType;
  vx: number;
  vy: number;
  radius: number;
  ttl: number;
  dead = false;

  constructor(x: number, y: number, type: PowerUpType) {
    const t = POWERUP_TYPES[type];
    this.x = x;
    this.y = y;
    this.type = type;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(18, 40);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.radius = t.radius;
    this.ttl = t.ttl;
  }

  update(dt: number): void {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // Blink during the last 2 seconds
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;
    const t = POWERUP_TYPES[this.type];
    const color = t.color ?? rainbow();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = `bold ${t.font}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(t.label, this.x, this.y + 1);
    ctx.textBaseline = "alphabetic";
  }
}
