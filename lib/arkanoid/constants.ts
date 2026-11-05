// Values copied unchanged from the vanilla source (references/StarterGames/04-arkanoid).

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

export const BAR = { y: 468, h: 8, color: "#7fd1ff" } as const; // full-width bar under the paddle

export const CAPSULE_STYLE: Record<PowerUpType, { letter: string; color: string }> = {
  triple: { letter: "T", color: "#2e86de" },
  bar: { letter: "B", color: "#27ae60" },
  frenzy: { letter: "F", color: "#e67e22" },
};

export type SkinId = "retro" | "pastel" | "neon";

export const SKINS: Record<SkinId, { label: string; filter: string }> = {
  retro: { label: "Retro", filter: "none" },
  pastel: { label: "Pastel", filter: "hue-rotate(20deg) saturate(0.55) brightness(1.25)" },
  neon: { label: "Neon", filter: "hue-rotate(-30deg) saturate(2.2) contrast(1.2) brightness(1.1)" },
};

export const MAX_STEP = 8; // px; max distance a ball moves per collision sub-step
export const MAX_BOUNCE_ANGLE = (60 * Math.PI) / 180; // from vertical, at paddle edges
export const START_LIVES = 3;
export const POINTS_PER_BRICK = 10;
export const MAX_DT = 1 / 30; // seconds; frame time cap
export const MAX_SCORE = 10_000_000;

export const SHEET_SRC = "/game-assets/arkanoid/spritesheet-breakout.png";

export interface Sprite {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export const SPRITES: {
  paddle: Sprite;
  ball: Sprite;
  blocks: Record<BrickColor, Sprite>;
} = {
  paddle: { sx: 32, sy: 112, sw: 162, sh: 14 },
  ball: { sx: 32, sy: 32, sw: 16, sh: 16 },
  blocks: {
    red: { sx: 32, sy: 176, sw: 32, sh: 16 },
    yellow: { sx: 32, sy: 240, sw: 32, sh: 16 },
    cyan: { sx: 32, sy: 192, sw: 32, sh: 16 },
    magenta: { sx: 32, sy: 224, sw: 32, sh: 16 },
    hotpink: { sx: 32, sy: 256, sw: 32, sh: 16 },
    green: { sx: 32, sy: 208, sw: 32, sh: 16 },
  },
};

// 4 frames per color: same row as the block, columns 256, 288, 320, 352.
const explosionFrames = (color: BrickColor): Sprite[] =>
  [256, 288, 320, 352].map((sx) => ({ sx, sy: SPRITES.blocks[color].sy, sw: 32, sh: 16 }));

export const EXPLOSION_FRAMES: Record<BrickColor, Sprite[]> = {
  red: explosionFrames("red"),
  yellow: explosionFrames("yellow"),
  cyan: explosionFrames("cyan"),
  magenta: explosionFrames("magenta"),
  hotpink: explosionFrames("hotpink"),
  green: explosionFrames("green"),
};

export const EXPLOSION_DURATION = 150; // ms
