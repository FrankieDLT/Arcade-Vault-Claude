// Wingshot: shared numbers, types and the skin table. Framework-free.

export const WIDTH = 800;
export const HEIGHT = 600;
export const SHOTS_PER_WAVE = 3;
export const ROUND_TARGETS = 10;
export const HIT_RADIUS = 36; // px, all pointer types
export const TOUCH_HIT_BONUS = 8; // px added for touch and pen
export const TARGET_SIZE = 64; // 16x16 run table drawn at x4
export const SPRITE_SCALE = 4;
export const FALL_TIME = 0.5; // s, a hit target falls
export const ESCAPE_TIME = 1.0; // s, a target flies off when ammo is gone or its flight ends
export const COMPANION_TIME = 1.8; // s, companion visible at the end of each wave
export const COMPANION_RISE = 0.3; // s, rise from and sink to the bottom edge
export const ROUND_BANNER_TIME = 1.5; // s, "ROUND N"
export const ROUND_RESULT_TIME = 2.0; // s, "N / 10 HITS"
export const MAX_SCORE = 10_000_000;
export const MAX_ROUND = 99;
export const MAX_DT = 0.05; // s, longest simulated step
export const WOBBLE_AMPLITUDE = 24; // px
export const WOBBLE_RATE = 0.9; // cycles per second
export const WALL_MARGIN = 32; // px, bounce margin at the sides and the top
export const COMPANION_W = 96;
export const COMPANION_H = 128;

export type TargetKind = "common" | "quick" | "rare" | "decoy";
export type SceneId =
  "lake" | "moors" | "orbit" | "origami" | "mine" | "cartoon";
export type CompanionId =
  | "fisherman"
  | "plague-doctor"
  | "astronaut"
  | "samurai"
  | "coal-miner"
  | "deckhand";
export type CompanionPose = "cheer" | "gag"; // 2 animation frames each

export const KIND_POINTS: Record<TargetKind, number> = {
  common: 100,
  quick: 200,
  rare: 400,
  decoy: -200,
}; // the score never goes below 0
export const PERFECT_BONUS = 1000; // x round, when all 10 targets of a round are hit

/** Speed multiplier per kind (px/s, on top of the round base speed). */
export const KIND_SPEED: Record<TargetKind, number> = {
  common: 1,
  quick: 1.6,
  rare: 1.3,
  decoy: 0.8,
};

export const SCENE_COMPANION: Record<SceneId, CompanionId> = {
  lake: "fisherman",
  moors: "plague-doctor",
  orbit: "astronaut",
  origami: "samurai",
  mine: "coal-miner",
  cartoon: "deckhand",
};

/** y of the lowest line a target flies to (it bounces there) and launches from. */
export const SCENE_FLOOR: Record<SceneId, number> = {
  lake: 430,
  moors: 500,
  orbit: 500,
  origami: 500,
  mine: 500,
  cartoon: 500,
};

/** Sprite chars: o outline, a main, b light, c accent, d dark, e white, g gold, r red,
 *  s skin, h cloth one, j cloth two. "." is empty. */
export type SpriteChar =
  "o" | "a" | "b" | "c" | "d" | "e" | "g" | "r" | "s" | "h" | "j";

export interface Palette {
  skyTop: string;
  skyBottom: string;
  far: string;
  mid: string;
  near: string;
  water: string;
  sun: string;
  /** HUD text and ticks. */
  ink: string;
  /** Ammo pips, hit ticks, banners. */
  accent: string;
  bad: string;
  /** Muzzle flash color. */
  fx: string;
  /** Optional HUD bar backdrop (default dark `rgba(0,0,0,0.35)`). */
  hudPanel?: string;
  /** Optional banner plate backdrop (default dark `rgba(0,0,0,0.6)`). */
  platePanel?: string;
  /** Optional banner title color (default white). */
  plateTitle?: string;
  p: Record<SpriteChar, string>;
}

export interface SkinDef {
  scene: SceneId;
  palette: Palette;
}

const clamp255 = (n: number): number => Math.max(0, Math.min(255, n));

/** Computed inverse of a `#rrggbb` color. */
export function invertHex(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp255(255 - ((n >> 16) & 255));
  const g = clamp255(255 - ((n >> 8) & 255));
  const b = clamp255(255 - (n & 255));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function invertPalette(pal: Palette): Palette {
  const p = {} as Record<SpriteChar, string>;
  for (const k of Object.keys(pal.p) as SpriteChar[])
    p[k] = invertHex(pal.p[k]);
  return {
    skyTop: invertHex(pal.skyTop),
    skyBottom: invertHex(pal.skyBottom),
    far: invertHex(pal.far),
    mid: invertHex(pal.mid),
    near: invertHex(pal.near),
    water: invertHex(pal.water),
    sun: invertHex(pal.sun),
    ink: invertHex(pal.ink),
    accent: invertHex(pal.accent),
    bad: invertHex(pal.bad),
    fx: invertHex(pal.fx),
    p,
  };
}

const RETRO: Palette = {
  skyTop: "#4aa3df",
  skyBottom: "#c4e9f5",
  far: "#5f9a74",
  mid: "#3f7a55",
  near: "#8a6a3c",
  water: "#2f6fa8",
  sun: "#ffe27a",
  ink: "#fff8e0",
  accent: "#ffd23f",
  bad: "#e85d4a",
  fx: "#ffffff",
  hudPanel: "rgba(0,0,0,0.6)",
  p: {
    o: "#1d2b3a",
    a: "#e0884b",
    b: "#f4c28a",
    c: "#fff2cf",
    d: "#7a4a2a",
    e: "#ffffff",
    g: "#ffd23f",
    r: "#e84a4a",
    s: "#f0c8a0",
    h: "#e8c040",
    j: "#3a6fb0",
  },
};

const GOTHIC: Palette = {
  skyTop: "#0b0a1a",
  skyBottom: "#2e1b40",
  far: "#1c1530",
  mid: "#140f22",
  near: "#0a0812",
  water: "#140f22",
  sun: "#e9e0d0",
  ink: "#efe6f5",
  accent: "#e08bff",
  bad: "#ff5c7a",
  fx: "#ffe9a8",
  p: {
    o: "#07050d",
    a: "#c8b8d8",
    b: "#efe6f5",
    c: "#b04fd0",
    d: "#6a5a80",
    e: "#ffffff",
    g: "#ffe27a",
    r: "#e84a6a",
    s: "#d9c8b0",
    h: "#3a3a48",
    j: "#7a2433",
  },
};

const NEON: Palette = {
  skyTop: "#02040c",
  skyBottom: "#1a0a46",
  far: "#2a0f66",
  mid: "#0d1a3a",
  near: "#06102a",
  water: "#0d1a3a",
  sun: "#ff006e",
  ink: "#e8ffff",
  accent: "#00f5ff",
  bad: "#ff3b6e",
  fx: "#7affff",
  p: {
    o: "#02101a",
    a: "#00f5ff",
    b: "#a8fbff",
    c: "#ff006e",
    d: "#2a6a8a",
    e: "#ffffff",
    g: "#f5ff00",
    r: "#ff3b3b",
    s: "#ffd9b0",
    h: "#e8f0ff",
    j: "#ff7700",
  },
};

const PASTEL: Palette = {
  skyTop: "#fbd2e2",
  skyBottom: "#fff0d6",
  far: "#e8b8d8",
  mid: "#c9a8e8",
  near: "#a8c8f0",
  water: "#a8c8f0",
  sun: "#ffb59a",
  ink: "#5a4a6a",
  accent: "#b82f5c",
  bad: "#c0392b",
  fx: "#ffffff",
  hudPanel: "rgba(255,250,245,0.7)",
  platePanel: "rgba(255,250,245,0.82)",
  plateTitle: "#5a4a6a",
  p: {
    o: "#6a5878",
    a: "#ffffff",
    b: "#fff6ea",
    c: "#ff9ab8",
    d: "#b8a0d0",
    e: "#ffffff",
    g: "#f2b84a",
    r: "#e8648c",
    s: "#f5d0b8",
    h: "#8fb4e8",
    j: "#e8648c",
  },
};

/** GOLDEN HOUR: dark cavern browns and plums, lantern gold and ember orange, cream ink. */
const GOLDEN_HOUR: Palette = {
  skyTop: "#1a1018",
  skyBottom: "#3a2230",
  far: "#4a3040",
  mid: "#2c1b24",
  near: "#3a2a22",
  water: "#6b4a30",
  sun: "#ffd23f",
  ink: "#fff4e0",
  accent: "#ffd23f",
  bad: "#ff9a3c",
  fx: "#ffd23f",
  hudPanel: "rgba(20,10,14,0.7)",
  p: {
    o: "#12080c",
    a: "#b8947c",
    b: "#e6cdb4",
    c: "#c2603a",
    d: "#6a4636",
    e: "#fff4e0",
    g: "#ffd23f",
    r: "#e8663a",
    s: "#c9a07c",
    h: "#ff9a3c",
    j: "#9a78c4",
  },
};

/** INK WASH: 1920s black and white cartoon. Only the gold note carries a tint. */
const INK_WASH: Palette = {
  skyTop: "#f2efe8",
  skyBottom: "#fbf9f3",
  far: "#d9d6cf",
  mid: "#b5b2ab",
  near: "#3a3a3a",
  water: "#7a7a7a",
  sun: "#ffffff",
  ink: "#ffffff",
  accent: "#ffffff",
  bad: "#d4d4d4",
  fx: "#111111",
  hudPanel: "rgba(17,17,17,0.88)",
  platePanel: "rgba(17,17,17,0.9)",
  plateTitle: "#ffffff",
  p: {
    o: "#111111",
    a: "#2b2b2b",
    b: "#f5f5f5",
    c: "#8c8c8c",
    d: "#5c5c5c",
    e: "#ffffff",
    g: "#f2b72a",
    r: "#111111",
    s: "#ffffff",
    h: "#ffffff",
    j: "#3a3a3a",
  },
};

/** Every skin: its scene and palette. Hit boxes, speeds, score and sounds never read this. */
export const SKINS: Record<string, SkinDef> = {
  retro: { scene: "lake", palette: RETRO },
  gothic: { scene: "moors", palette: GOTHIC },
  neon: { scene: "orbit", palette: NEON },
  pastel: { scene: "origami", palette: PASTEL },
  negative: { scene: "origami", palette: invertPalette(PASTEL) },
  "golden-hour": { scene: "mine", palette: GOLDEN_HOUR },
  "ink-wash": { scene: "cartoon", palette: INK_WASH },
};

export const DEFAULT_SKIN = "retro";
