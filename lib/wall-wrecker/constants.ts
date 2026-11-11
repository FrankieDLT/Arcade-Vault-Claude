// Values copied unchanged from the vanilla source (the third folder of references/StarterGames).

export const W = 640;
export const H = 480;

export type BrickColor = "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green";

export const BRICK = { cols: 10, rows: 6, w: 64, h: 32, top: 60 } as const;
export const ROW_COLORS: readonly BrickColor[] = [
  "red",
  "yellow",
  "cyan",
  "magenta",
  "hotpink",
  "green",
];

export const PADDLE = { w: 100, h: 12, y: 440, speed: 480 } as const;
export const BALL = { size: 16, speed: 320 } as const;

export const LEVEL = {
  speedStep: 0.05, // +5% of BALL.speed per level above 1
  speedCapFactor: 2, // base speed never exceeds BALL.speed * 2
  holeChanceStep: 0.1, // hole probability = min(holeChanceMax, (level - 1) * step)
  holeChanceMax: 0.5,
} as const;
export const LEVEL_MIN = 1;
export const LEVEL_MAX = 99;

export type PowerUpType = "triple" | "bar" | "frenzy";

export const POWERUP = {
  dropChance: 0.1, // per destroyed brick
  types: ["triple", "bar", "frenzy"] as readonly PowerUpType[], // equally likely once a drop happens
  capsule: { w: 32, h: 16, fallSpeed: 120 }, // px, px/s
  tripleAngle: (25 * Math.PI) / 180, // rotation of the two new balls
  maxBalls: 6,
  barDuration: 10, // seconds
  frenzyDuration: 10, // seconds
  frenzyFactor: 2, // ball speed multiplier
} as const;

export const BAR = { y: 468, h: 8 } as const; // full-width bar under the paddle

export const CAPSULE_LETTER: Record<PowerUpType, string> = { triple: "T", bar: "B", frenzy: "F" };

export type SkinId = "retro" | "pastel" | "neon";

export interface SkinPalette {
  label: string;
  bricks: Record<BrickColor, string>;
  paddle: { body: string; edge: string; glow: number };
  ball: { fill: string; rim: string; glow: number };
  capsule: Record<PowerUpType, string>;
  bar: string;
  glow: number; // shadowBlur in px for bricks and capsules (0 = none)
}

// Original art is drawn from these palettes (SPEC 26): no image file, pre-rendered once per skin.
export const SKINS: Record<SkinId, SkinPalette> = {
  retro: {
    label: "Retro",
    bricks: { red: "#e0453a", yellow: "#f2c316", cyan: "#1fb5d1", magenta: "#a64bd6", hotpink: "#f06aa8", green: "#3fb950" },
    paddle: { body: "#e9edf2", edge: "#8e99a8", glow: 0 },
    ball: { fill: "#ffffff", rim: "#9aa6b5", glow: 0 },
    capsule: { triple: "#2e86de", bar: "#27ae60", frenzy: "#e67e22" },
    bar: "#7fd1ff",
    glow: 0,
  },
  pastel: {
    label: "Pastel",
    bricks: { red: "#f4a6a0", yellow: "#f7e2a0", cyan: "#a5e3ec", magenta: "#d5b3ee", hotpink: "#f7bdd8", green: "#b4e6b9" },
    paddle: { body: "#fdfbf6", edge: "#c9bfd6", glow: 0 },
    ball: { fill: "#fffdf8", rim: "#cfc3dd", glow: 0 },
    capsule: { triple: "#8fb8ee", bar: "#8fd6a8", frenzy: "#f5bd8c" },
    bar: "#b8dcf5",
    glow: 0,
  },
  neon: {
    label: "Neon",
    bricks: { red: "#ff3b5c", yellow: "#ffe600", cyan: "#00f0ff", magenta: "#d400ff", hotpink: "#ff2fa6", green: "#39ff6a" },
    paddle: { body: "#eafcff", edge: "#00f0ff", glow: 10 },
    ball: { fill: "#ffffff", rim: "#00f0ff", glow: 10 },
    capsule: { triple: "#2e9bff", bar: "#2dff8a", frenzy: "#ff8a1f" },
    bar: "#00f0ff",
    glow: 8,
  },
};

export const MAX_STEP = 8; // px; max distance a ball moves per collision sub-step
export const MAX_BOUNCE_ANGLE = (60 * Math.PI) / 180; // from vertical, at paddle edges
export const START_LIVES = 3;
export const POINTS_PER_BRICK = 10;
export const MAX_DT = 1 / 30; // seconds; frame time cap
export const MAX_SCORE = 10_000_000;

export const EXPLOSION_DURATION = 150; // ms
export const EXPLOSION_FRAMES = 4;
export const EXPLOSION_PAD = 16; // px of room around the brick for flying shards
