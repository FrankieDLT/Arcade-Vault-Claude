'use strict';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 800;
const H = 600;

// ── Input ─────────────────────────────────────────────────────────────────────
const keys = {};
const justPressed = {};

window.addEventListener('keydown', e => {
  justPressed[e.code] = !keys[e.code];
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
    e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function pressed(code) {
  const val = justPressed[code];
  justPressed[code] = false;
  return val;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap  = (v, max) => ((v % max) + max) % max;
const dist  = (a, b)   => Math.hypot(a.x - b.x, a.y - b.y);
const rand  = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));

// Color arcoíris que cicla con el tiempo
const rainbow = () => `hsl(${(performance.now() / 5) % 360}, 100%, 60%)`;

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
    this.ttl  = 1.1;
    this.radius = 2;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    ctx.fillStyle = this.rainbow ? rainbow() : '#fff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
const RADII  = [0, 16, 30, 50];   // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32];   // velocidad base por tamaño
const POINTS = [0, 100, 50, 20];  // puntos por tamaño

const POWERUP_CHANCE = 0.1;       // probabilidad de que un asteroide destruido suelte un power-up
const HYPER_DURATION  = 10;       // segundos
const SHIELD_DURATION = 5;        // segundos
const SLOW_DURATION   = 5;        // segundos
const SLOW_FACTOR     = 0.5;      // multiplicador de velocidad de los asteroides
const TRIPLE_DURATION = 10;       // segundos
const SPREAD          = Math.PI / 6;   // 30° entre balas del disparo triple

// Variante del asteroide grande (trazada de Shape_asteroid_of_asteroids_arcade_game.png),
// centrada y normalizada para que el vértice más lejano tenga radio 1.
const BIG_VARIANT = (() => {
  const pts = [
    [188, 63], [265, 87], [251, 171], [331, 195], [308, 282],
    [238, 279], [205, 335], [107, 288], [62, 206], [83, 119],
  ];
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const max = Math.max(...pts.map(p => Math.hypot(p[0] - cx, p[1] - cy)));
  return pts.map(p => [(p[0] - cx) / max, (p[1] - cy) / max]);
})();

class Asteroid {
  constructor(x, y, size = 3) {
    this.x    = x;
    this.y    = y;
    this.size = size;
    this.radius = RADII[size];
    this.dead = false;

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    // Polígono irregular (los grandes usan la forma de la imagen la mitad de las veces)
    this.verts = [];
    if (size === 3 && Math.random() < 0.5) {
      this.verts = BIG_VARIANT.map(([vx, vy]) => [vx * this.radius, vy * this.radius]);
      return;
    }
    const n = randInt(8, 13);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt) {
    this.x   = wrap(this.x + this.vx * dt, W);
    this.y   = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split() {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  constructor() { this.reset(); }

  reset() {
    this.x      = W / 2;
    this.y      = H / 2;
    this.angle  = -Math.PI / 2;
    this.vx     = 0;
    this.vy     = 0;
    this.radius = 12;
    this.hyper  = this.hyper || 0;   // segundos restantes de HyperMode (se conserva al pasar de nivel)
    this.thrusting     = false;
    this.invincible    = 3;
    this.shootCooldown = 0;
    this.shield        = 0;
    this.dead          = false;
  }

  update(dt) {
    if (this.dead) return;
    if (this.invincible    > 0) this.invincible    -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.hyper         > 0) this.hyper         -= dt;
    if (this.shield        > 0) this.shield        -= dt;

    const boost  = this.hyper > 0 ? 2 : 1;
    const ROT    = 3.5 * boost;   // rad/s
    const THRUST = 260 * boost;   // px/s²
    const DRAG   = 0.987;

    if (keys['ArrowLeft'])  this.angle -= ROT * dt;
    if (keys['ArrowRight']) this.angle += ROT * dt;

    this.thrusting = !!keys['ArrowUp'];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot() {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = this.hyper > 0 ? 0.1 : 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    const angles = tripleTimer > 0 ? [-SPREAD, 0, SPREAD] : [0];
    return angles.map(d => {
      const b = new Bullet(ox, oy, this.angle + d);
      b.rainbow = this.hyper > 0;
      return b;
    });
  }

  draw() {
    if (this.dead) return;

    // Escudo (parpadea durante el último segundo)
    if (this.shield > 0 && (this.shield >= 1 || Math.floor(this.shield * 10) % 2 === 0)) {
      ctx.strokeStyle = '#4ff';
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 22, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Parpadeo durante invencibilidad de reaparición
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = this.hyper > 0 ? rainbow() : '#fff';
    ctx.lineWidth   = 1.5;
    ctx.lineJoin    = 'round';

    // Silueta clásica: triángulo con muesca trasera
    ctx.beginPath();
    ctx.moveTo( 20,  0);   // nariz
    ctx.lineTo(-12, -9);   // ala izquierda
    ctx.lineTo( -7,  0);   // muesca trasera
    ctx.lineTo(-12,  9);   // ala derecha
    ctx.closePath();
    ctx.stroke();

    // Llama del propulsor
    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8,  4);
      ctx.strokeStyle = 'rgba(255, 130, 0, 0.85)';
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  constructor(x, y) {
    this.x  = x;
    this.y  = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx   = Math.cos(angle) * speed;
    this.vy   = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl  = this.life;
    this.dead = false;
  }

  update(dt) {
    this.x  += this.vx * dt;
    this.y  += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    const alpha = this.ttl / this.life;
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
  }
}

// ── Power-ups ─────────────────────────────────────────────────────────────────
// weight: peso relativo en el sorteo; ttl: segundos en pantalla; color null = arcoíris
const POWERUP_TYPES = {
  bomb:   { label: 'B',  color: '#ff0', weight: 1, ttl: 8,  radius: 12, font: 16 },
  hyper:  { label: 'H',  color: null,   weight: 1, ttl: 12, radius: 12, font: 22 },
  shield: { label: 'SH', color: '#4ff', weight: 3, ttl: 10, radius: 12, font: 11 },
  slow:   { label: 'SM', color: '#fff', weight: 3, ttl: 8,  radius: 14, font: 12 },
  triple: { label: '3',  color: '#0ff', weight: 3, ttl: 12, radius: 14, font: 18 },
};

class PowerUp {
  constructor(x, y, type) {
    const t = POWERUP_TYPES[type];
    this.x = x;
    this.y = y;
    this.type = type;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(18, 40);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.radius = t.radius;
    this.ttl  = t.ttl;
    this.dead = false;
  }

  update(dt) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw() {
    // Parpadeo durante los últimos 2 segundos
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;
    const t = POWERUP_TYPES[this.type];
    const color = t.color || rainbow();
    ctx.strokeStyle = color;
    ctx.fillStyle   = color;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = `bold ${t.font}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t.label, this.x, this.y + 1);
    ctx.textBaseline = 'alphabetic';
  }
}

// ── Estado del juego ──────────────────────────────────────────────────────────
let ship, bullets, asteroids, particles, powerUps;
let score, lives, level;
let bombFlash = 0;
let slowTimer = 0;
let tripleTimer = 0;   // global (no en Ship) para sobrevivir a ship.reset() al pasar de nivel
let state;      // 'playing' | 'dead' | 'gameover'
let deadTimer;

function spawnAsteroids(count) {
  const SAFE_DIST = 130;
  for (let i = 0; i < count; i++) {
    let x, y;
    do {
      x = rand(0, W);
      y = rand(0, H);
    } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
    asteroids.push(new Asteroid(x, y, 3));
  }
}

function initGame() {
  ship          = new Ship();
  bullets   = [];
  asteroids = [];
  particles = [];
  powerUps  = [];
  bombFlash = 0;
  slowTimer = 0;
  tripleTimer = 0;
  score  = 0;
  lives  = 3;
  level  = 1;
  state  = 'playing';
  spawnAsteroids(4);
}

function nextLevel() {
  level++;
  bullets   = [];
  particles = [];
  powerUps  = [];
  ship.reset();
  spawnAsteroids(3 + level);
}

function explode(x, y, count = 8) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y));
}

function maybeDropPowerUp(a) {
  if (Math.random() >= POWERUP_CHANCE) return;
  const types = Object.keys(POWERUP_TYPES);
  let roll = Math.random() * types.reduce((s, k) => s + POWERUP_TYPES[k].weight, 0);
  const type = types.find(k => (roll -= POWERUP_TYPES[k].weight) < 0) || types[0];
  powerUps.push(new PowerUp(a.x, a.y, type));
}

function applyPowerUp(type) {
  if (type === 'bomb')   detonateBomb();
  if (type === 'hyper')  ship.hyper = HYPER_DURATION;
  if (type === 'shield') ship.shield = SHIELD_DURATION;
  if (type === 'slow')   slowTimer = SLOW_DURATION;
  if (type === 'triple') tripleTimer = TRIPLE_DURATION;
}

function destroyAsteroid(a, newAsteroids) {
  a.dead = true;
  score += POINTS[a.size];
  explode(a.x, a.y, a.size * 5);
  maybeDropPowerUp(a);
  newAsteroids.push(...a.split());
}

function detonateBomb() {
  for (const a of asteroids) {
    if (a.dead) continue;
    score += POINTS[a.size];
    explode(a.x, a.y, a.size * 5);
    maybeDropPowerUp(a);
  }
  asteroids = [];
  bombFlash = 0.25;
}

function killShip() {
  explode(ship.x, ship.y, 14);
  ship.dead = true;
  ship.hyper = 0;
  tripleTimer = 0;
  lives--;
  if (lives <= 0) {
    state = 'gameover';
  } else {
    state     = 'dead';
    deadTimer = 2;
  }
}

// ── Update ────────────────────────────────────────────────────────────────────
function update(dt) {
  if (state === 'gameover') {
    if (pressed('Space')) initGame();
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    return;
  }

  if (state === 'dead') {
    deadTimer -= dt;
    slowTimer = Math.max(0, slowTimer - dt);
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => !p.dead);
    powerUps.forEach(p => p.update(dt));
    powerUps = powerUps.filter(p => !p.dead);
    const slowDt = slowTimer > 0 ? dt * SLOW_FACTOR : dt;
    asteroids.forEach(a => a.update(slowDt));
    if (deadTimer <= 0) { state = 'playing'; ship.reset(); }
    return;
  }

  // Disparar
  if (keys['Space']) {
    bullets.push(...ship.tryShoot());
  }

  slowTimer = Math.max(0, slowTimer - dt);
  if (tripleTimer > 0) tripleTimer -= dt;
  const asteroidDt = slowTimer > 0 ? dt * SLOW_FACTOR : dt;

  ship.update(dt);
  bullets.forEach(b => b.update(dt));
  asteroids.forEach(a => a.update(asteroidDt));
  particles.forEach(p => p.update(dt));
  powerUps.forEach(p => p.update(dt));
  if (bombFlash > 0) bombFlash -= dt;

  bullets   = bullets.filter(b => !b.dead);
  particles = particles.filter(p => !p.dead);
  powerUps  = powerUps.filter(p => !p.dead);

  // Bala vs asteroide
  const newAsteroids = [];
  for (const b of bullets) {
    for (const a of asteroids) {
      if (!a.dead && !b.dead && dist(b, a) < a.radius) {
        b.dead = true;
        destroyAsteroid(a, newAsteroids);
      }
    }
  }

  // Nave vs asteroide (HyperMode e invencibilidad la hacen inmune; el escudo absorbe un golpe)
  if (ship.invincible <= 0 && ship.hyper <= 0) {
    for (const a of asteroids) {
      if (!a.dead && dist(ship, a) < ship.radius + a.radius * 0.82) {
        if (ship.shield > 0) {
          ship.shield     = 0;
          ship.invincible = 1;
          destroyAsteroid(a, newAsteroids);
        } else {
          killShip();
        }
        break;
      }
    }
  }

  asteroids = asteroids.filter(a => !a.dead).concat(newAsteroids);
  bullets   = bullets.filter(b => !b.dead);

  // Nave vs power-up
  if (!ship.dead) {
    for (const p of powerUps) {
      if (!p.dead && dist(ship, p) < ship.radius + p.radius) {
        p.dead = true;
        applyPowerUp(p.type);
      }
    }
    powerUps = powerUps.filter(p => !p.dead);
  }

  // Nivel completado
  if (asteroids.length === 0) nextLevel();
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawLifeIcon(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-Math.PI / 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 1.2;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo( 9,  0);
  ctx.lineTo(-6, -5);
  ctx.lineTo(-3,  0);
  ctx.lineTo(-6,  5);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

function drawHUD() {
  ctx.fillStyle = '#fff';
  ctx.font = '15px monospace';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${score}`, 14, 26);

  ctx.textAlign = 'center';
  ctx.fillText(`NIVEL ${level}`, W / 2, 26);

  for (let i = 0; i < lives; i++)
    drawLifeIcon(W - 16 - i * 22, 18);

  if (ship.hyper > 0) {
    ctx.fillStyle = rainbow();
    ctx.textAlign = 'left';
    ctx.fillText(`HYPERMODE ${ship.hyper.toFixed(1)}s`, 14, 48);
  }

  if (tripleTimer > 0) {
    ctx.fillStyle = '#0ff';
    ctx.textAlign = 'left';
    ctx.fillText(`TRIPLE  ${Math.ceil(tripleTimer)}s`, 14, 68);
  }

  if (slowTimer > 0) {
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(`SlowMo ${slowTimer.toFixed(1)}s`, W / 2, 46);
  }

}

function drawOverlay(title, sub) {
  ctx.textAlign   = 'center';
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 46px monospace';
  ctx.fillText(title, W / 2, H / 2 - 18);
  ctx.font        = '18px monospace';
  ctx.fillStyle   = 'rgba(255,255,255,0.65)';
  ctx.fillText(sub, W / 2, H / 2 + 22);
}

function draw() {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  particles.forEach(p => p.draw());
  asteroids.forEach(a => a.draw());
  powerUps.forEach(p => p.draw());
  bullets.forEach(b => b.draw());
  ship.draw();

  if (bombFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${(bombFlash / 0.25 * 0.5).toFixed(2)})`;
    ctx.fillRect(0, 0, W, H);
  }

  drawHUD();

  if (state === 'gameover')
    drawOverlay('GAME OVER', `PUNTAJE: ${score}   —   ESPACIO PARA REINICIAR`);
}

// ── Loop principal ────────────────────────────────────────────────────────────
let lastTime = null;

function loop(ts) {
  const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

initGame();
requestAnimationFrame(loop);
