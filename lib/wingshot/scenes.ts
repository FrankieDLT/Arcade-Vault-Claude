// Scenes: static backdrops drawn once per skin into an offscreen canvas (no per-frame cost).
// Plain fills and alpha only: no blend modes, no animated layers.

import { HEIGHT, WIDTH, type Palette, type SceneId } from "./constants";

type Ctx = CanvasRenderingContext2D;

function sky(ctx: Ctx, pal: Palette, to = HEIGHT): void {
  const g = ctx.createLinearGradient(0, 0, 0, to);
  g.addColorStop(0, pal.skyTop);
  g.addColorStop(1, pal.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

/** A ridge of jagged hills as a filled polygon. */
function ridge(
  ctx: Ctx,
  color: string,
  baseY: number,
  amp: number,
  step: number,
  seed: number,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT);
  for (let x = 0; x <= WIDTH + step; x += step) {
    const n =
      Math.sin(x * 0.013 + seed) + 0.6 * Math.sin(x * 0.031 + seed * 2.3);
    ctx.lineTo(x, baseY - amp * (0.5 + 0.5 * n));
  }
  ctx.lineTo(WIDTH, HEIGHT);
  ctx.closePath();
  ctx.fill();
}

function disc(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Deterministic pseudo-random (no module state: a closure per call). */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function lake(ctx: Ctx, pal: Palette): void {
  sky(ctx, pal, 420);
  disc(ctx, 600, 150, 46, pal.sun);
  ctx.globalAlpha = 0.25;
  disc(ctx, 600, 150, 70, pal.sun);
  ctx.globalAlpha = 1;
  ridge(ctx, pal.far, 400, 110, 16, 1.2);
  ridge(ctx, pal.mid, 420, 60, 16, 4.1);
  // water
  ctx.fillStyle = pal.water;
  ctx.fillRect(0, 420, WIDTH, HEIGHT - 420);
  const r = rng(7);
  ctx.fillStyle = pal.sun;
  ctx.globalAlpha = 0.28;
  for (let i = 0; i < 26; i++) {
    const y = 432 + r() * 120;
    const w = 24 + r() * 60;
    ctx.fillRect(r() * (WIDTH - w), Math.round(y / 4) * 4, w, 4);
  }
  ctx.globalAlpha = 1;
  // far shore line
  ctx.fillStyle = pal.mid;
  ctx.fillRect(0, 416, WIDTH, 8);
  // near shore and reeds
  ctx.fillStyle = pal.near;
  ctx.fillRect(0, 560, WIDTH, 40);
  ctx.fillStyle = pal.mid;
  for (let x = 12; x < WIDTH; x += 52) {
    const h = 36 + ((x * 7) % 30);
    ctx.fillRect(x, 560 - h, 4, h);
    ctx.fillRect(x + 8, 560 - h * 0.7, 4, h * 0.7);
  }
}

function moors(ctx: Ctx, pal: Palette): void {
  sky(ctx, pal);
  const r = rng(11);
  ctx.fillStyle = pal.ink;
  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = 0.25 + r() * 0.5;
    ctx.fillRect(Math.floor(r() * WIDTH), Math.floor(r() * 320), 3, 3);
  }
  ctx.globalAlpha = 1;
  ctx.globalAlpha = 0.18;
  disc(ctx, 560, 130, 88, pal.sun);
  ctx.globalAlpha = 1;
  disc(ctx, 560, 130, 58, pal.sun);
  ctx.fillStyle = pal.far;
  disc(ctx, 540, 118, 9, "rgba(0,0,0,0.12)");
  disc(ctx, 582, 148, 6, "rgba(0,0,0,0.12)");
  ridge(ctx, pal.far, 470, 120, 16, 2.2);
  ridge(ctx, pal.mid, 520, 80, 16, 5.3);
  ridge(ctx, pal.near, 580, 40, 16, 1.7);
  // bare trees
  ctx.strokeStyle = pal.near;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  for (const [x, h] of [
    [90, 190],
    [700, 230],
    [340, 120],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x, 590);
    ctx.lineTo(x, 590 - h);
    ctx.moveTo(x, 590 - h * 0.55);
    ctx.lineTo(x - 40, 590 - h * 0.85);
    ctx.moveTo(x, 590 - h * 0.7);
    ctx.lineTo(x + 44, 590 - h * 0.95);
    ctx.stroke();
  }
  // lantern post, lit
  ctx.fillStyle = pal.near;
  ctx.fillRect(758, 410, 8, 190);
  ctx.fillStyle = pal.p.g;
  ctx.fillRect(750, 394, 24, 20);
  ctx.globalAlpha = 0.16;
  disc(ctx, 762, 404, 56, pal.p.g);
  ctx.globalAlpha = 1;
}

function orbit(ctx: Ctx, pal: Palette): void {
  sky(ctx, pal);
  const r = rng(23);
  ctx.fillStyle = pal.ink;
  for (let i = 0; i < 70; i++) {
    ctx.globalAlpha = 0.2 + r() * 0.6;
    const s = r() < 0.15 ? 4 : 2;
    ctx.fillRect(Math.floor(r() * WIDTH), Math.floor(r() * 440), s, s);
  }
  ctx.globalAlpha = 1;
  // planet with a ring, half below the horizon
  disc(ctx, 220, 500, 190, pal.far);
  disc(ctx, 220, 500, 150, pal.sun);
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = pal.far;
  for (let i = 0; i < 5; i++) ctx.fillRect(70, 372 + i * 26, 300, 10);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = pal.accent;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(220, 430, 260, 40, -0.12, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // moon surface
  ctx.fillStyle = pal.mid;
  ctx.fillRect(0, 548, WIDTH, 52);
  ridge(ctx, pal.mid, 566, 34, 16, 3.3);
  ctx.fillStyle = pal.near;
  for (const [x, w] of [
    [120, 70],
    [420, 54],
    [650, 90],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(x, 584, w, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = pal.accent;
  ctx.fillRect(0, 548, WIDTH, 3);
}

/** Paper-cut dusk: layered folded ridges with crease lines and a flat sun. */
function origami(ctx: Ctx, pal: Palette): void {
  sky(ctx, pal);
  disc(ctx, 560, 190, 80, pal.sun);
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = pal.skyBottom;
  for (let i = 0; i < 4; i++) ctx.fillRect(470, 150 + i * 28, 180, 8);
  ctx.globalAlpha = 1;
  const layers: [string, number, number][] = [
    [pal.far, 400, 150],
    [pal.mid, 470, 120],
    [pal.near, 540, 80],
  ];
  layers.forEach(([color, base, amp], li) => {
    const r = rng(31 + li * 9);
    const pts: [number, number][] = [];
    for (let x = 0; x <= WIDTH + 100; x += 100) {
      pts.push([x, base - amp * (0.3 + 0.7 * r())]);
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT);
    pts.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(WIDTH + 100, HEIGHT);
    ctx.closePath();
    ctx.fill();
    // crease: darker facet on the right of every peak
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      if (y1 <= y0) continue;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x0, y1 + 40);
      ctx.closePath();
      ctx.fill();
    }
  });
  ctx.fillStyle = pal.near;
  ctx.fillRect(0, 570, WIDTH, 30);
  ctx.fillStyle = "rgba(0,0,0,0.1)";
  ctx.fillRect(0, 570, WIDTH, 4);
}

/** Mine: dark cavern, rock wall, timber supports, hanging lanterns, rails. */
function mine(ctx: Ctx, pal: Palette): void {
  sky(ctx, pal);
  ridge(ctx, pal.far, 500, 230, 20, 3.7);
  const r = rng(41);
  for (let i = 0; i < 120; i++) {
    ctx.globalAlpha = 0.25 + r() * 0.35;
    ctx.fillStyle = r() < 0.5 ? pal.mid : pal.skyBottom;
    ctx.fillRect(
      Math.floor(r() * WIDTH),
      Math.floor(r() * 520),
      4 + Math.floor(r() * 3) * 4,
      4,
    );
  }
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = pal.sun;
  for (let i = 0; i < 9; i++) {
    ctx.fillRect(Math.floor(r() * 780), 200 + Math.floor(r() * 300), 4, 4);
  }
  ctx.globalAlpha = 1;
  // timber frames: two posts, a cross beam and braces
  const frame = (x0: number, x1: number): void => {
    ctx.fillStyle = pal.water;
    ctx.fillRect(x0, 110, 16, 440);
    ctx.fillRect(x1, 110, 16, 440);
    ctx.fillRect(x0 - 20, 96, x1 - x0 + 56, 22);
    ctx.strokeStyle = pal.water;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(x0 + 16, 190);
    ctx.lineTo(x0 + 60, 118);
    ctx.moveTo(x1, 190);
    ctx.lineTo(x1 - 44, 118);
    ctx.stroke();
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(x0 + 10, 110, 6, 440);
    ctx.fillRect(x1 + 10, 110, 6, 440);
  };
  frame(60, 250);
  frame(560, 730);
  // hanging lanterns with glow
  for (const [x, y] of [
    [155, 170],
    [645, 160],
  ] as const) {
    ctx.strokeStyle = pal.mid;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, 118);
    ctx.lineTo(x, y - 12);
    ctx.stroke();
    ctx.globalAlpha = 0.1;
    disc(ctx, x, y, 140, pal.sun);
    ctx.globalAlpha = 0.14;
    disc(ctx, x, y, 90, pal.sun);
    ctx.globalAlpha = 0.2;
    disc(ctx, x, y, 48, pal.p.h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.mid;
    ctx.fillRect(x - 12, y - 14, 24, 4);
    ctx.fillStyle = pal.sun;
    ctx.fillRect(x - 9, y - 10, 18, 22);
    ctx.fillStyle = pal.p.e;
    ctx.fillRect(x - 3, y - 4, 6, 10);
    ctx.fillStyle = pal.mid;
    ctx.fillRect(x - 12, y + 12, 24, 4);
  }
  // floor and rails
  ctx.fillStyle = pal.near;
  ctx.fillRect(0, 548, WIDTH, 52);
  ctx.fillStyle = pal.water;
  for (let x = 4; x < WIDTH; x += 56) ctx.fillRect(x, 560, 28, 10);
  ctx.fillStyle = pal.p.a;
  ctx.fillRect(0, 556, WIDTH, 4);
  ctx.fillRect(0, 572, WIDTH, 4);
  ctx.fillStyle = pal.accent;
  ctx.fillRect(0, 548, WIDTH, 3);
}

/** Cartoon: grainy paper sky, outlined clouds and sun, inked riverboat on grey waves. */
function cartoon(ctx: Ctx, pal: Palette): void {
  const ink = pal.p.o;
  sky(ctx, pal);
  const r = rng(53);
  ctx.fillStyle = pal.near;
  for (let i = 0; i < 520; i++) {
    ctx.globalAlpha = 0.08 + r() * 0.12;
    ctx.fillRect(Math.floor(r() * WIDTH), Math.floor(r() * 480), 2, 2);
  }
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = ink;
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(Math.floor(r() * WIDTH), 0, 2, 480);
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = ink;
  const cloud = (x: number, y: number, s: number): void => {
    ctx.fillStyle = "#ffffff";
    for (const [dx, dy, rr] of [
      [0, 0, 30],
      [34, -12, 38],
      [74, 0, 30],
    ] as const) {
      ctx.beginPath();
      ctx.arc(x + dx * s, y + dy * s, rr * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // flat base
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 30 * s, y, 134 * s, 30 * s);
    ctx.beginPath();
    ctx.moveTo(x - 30 * s, y);
    ctx.lineTo(x - 30 * s, y + 30 * s);
    ctx.lineTo(x + 104 * s, y + 30 * s);
    ctx.lineTo(x + 104 * s, y);
    ctx.stroke();
    ctx.fillStyle = pal.far;
    ctx.fillRect(x - 24 * s, y + 20 * s, 122 * s, 3);
  };
  cloud(90, 190, 0.9);
  cloud(400, 110, 0.7);
  // sun with rays
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(660, 120, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 4;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(660 + Math.cos(a) * 58, 120 + Math.sin(a) * 58);
    ctx.lineTo(
      660 + Math.cos(a) * (i % 2 ? 72 : 82),
      120 + Math.sin(a) * (i % 2 ? 72 : 82),
    );
    ctx.stroke();
  }
  // water
  ctx.fillStyle = pal.water;
  ctx.fillRect(0, 480, WIDTH, HEIGHT - 480);
  // riverboat on the horizon line
  ctx.lineWidth = 5;
  ctx.strokeStyle = ink;
  // smoke
  ctx.fillStyle = pal.far;
  for (const [x, y, rr] of [
    [570, 310, 16],
    [592, 280, 22],
    [624, 244, 28],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // stacks
  for (const x of [530, 580]) {
    ctx.fillStyle = pal.p.a;
    ctx.fillRect(x, 340, 28, 70);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x, 340, 28, 10);
    ctx.strokeRect(x, 340, 28, 70);
  }
  // cabin
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(470, 400, 220, 40);
  ctx.strokeRect(470, 400, 220, 40);
  ctx.fillStyle = pal.far;
  for (let i = 0; i < 5; i++) ctx.fillRect(488 + i * 40, 410, 22, 20);
  ctx.strokeStyle = ink;
  for (let i = 0; i < 5; i++) ctx.strokeRect(488 + i * 40, 410, 22, 20);
  // wheelhouse
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(530, 370, 90, 30);
  ctx.strokeRect(530, 370, 90, 30);
  // hull
  ctx.fillStyle = pal.near;
  ctx.beginPath();
  ctx.moveTo(440, 440);
  ctx.lineTo(730, 440);
  ctx.lineTo(700, 490);
  ctx.lineTo(470, 490);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // paddle wheel at the back
  ctx.fillStyle = pal.mid;
  ctx.beginPath();
  ctx.arc(730, 450, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineWidth = 4;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(730, 450);
    ctx.lineTo(730 + Math.cos(a) * 34, 450 + Math.sin(a) * 34);
    ctx.stroke();
  }
  // hand-inked waves: scalloped white and black arcs
  for (let row = 0; row < 4; row++) {
    const y = 502 + row * 30;
    for (let x = (row % 2) * 30 - 30; x < WIDTH + 60; x += 60) {
      ctx.lineWidth = 6;
      ctx.strokeStyle = ink;
      ctx.beginPath();
      ctx.arc(x + 30, y, 28, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x + 30, y, 28, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
  }
}

const DRAW: Record<SceneId, (ctx: Ctx, pal: Palette) => void> = {
  lake,
  moors,
  orbit,
  origami,
  mine,
  cartoon,
};

export function renderScene(
  scene: SceneId,
  palette: Palette,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (ctx) DRAW[scene](ctx, palette);
  return canvas;
}

/** Muzzle flash for one shot, `t` = 0..1 of its life. Each scene has its own effect. */
export function drawShotEffect(
  ctx: Ctx,
  scene: SceneId,
  palette: Palette,
  x: number,
  y: number,
  t: number,
): void {
  ctx.save();
  ctx.globalAlpha = 1 - t;
  ctx.strokeStyle = palette.fx;
  ctx.fillStyle = palette.fx;
  ctx.lineWidth = 4;
  switch (scene) {
    case "lake": {
      // harpoon splash ring
      ctx.beginPath();
      ctx.ellipse(x, y, 10 + t * 34, 5 + t * 16, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "moors": {
      // lantern flash
      const g = ctx.createRadialGradient(x, y, 2, x, y, 18 + t * 40);
      g.addColorStop(0, palette.fx);
      g.addColorStop(1, "rgba(255,233,168,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 18 + t * 40, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "orbit": {
      // stun-ray pulse
      ctx.beginPath();
      ctx.arc(x, y, 8 + t * 38, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 3 + t * 16, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case "mine": {
      // sparks flying off the rock and a dust puff
      ctx.lineWidth = 3;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + 0.3;
        const d0 = 6 + t * 18;
        const d1 = 14 + t * 44;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * d0, y + Math.sin(a) * d0);
        ctx.lineTo(x + Math.cos(a) * d1, y + Math.sin(a) * d1);
        ctx.stroke();
      }
      ctx.globalAlpha = (1 - t) * 0.55;
      ctx.fillStyle = "#d2b296";
      ctx.beginPath();
      ctx.arc(x, y - t * 14, 10 + t * 30, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "cartoon": {
      // ink burst: white-edged black spikes and a ring
      const spikes = (w: number, color: string): void => {
        ctx.lineWidth = w;
        ctx.strokeStyle = color;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(
            x + Math.cos(a) * (10 + t * 10),
            y + Math.sin(a) * (10 + t * 10),
          );
          ctx.lineTo(
            x + Math.cos(a) * (22 + t * 34),
            y + Math.sin(a) * (22 + t * 34),
          );
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(x, y, 6 + t * 12, 0, Math.PI * 2);
        ctx.stroke();
      };
      spikes(9, "#ffffff");
      spikes(4, palette.fx);
      break;
    }
    default: {
      // paper dart puff: little squares flying out
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const d = 8 + t * 34;
        ctx.fillRect(x + Math.cos(a) * d - 3, y + Math.sin(a) * d - 3, 6, 6);
      }
    }
  }
  ctx.restore();
}
