// Super Tennis constants. Coordinates: origin top-left, y grows down, units are canvas pixels and seconds.

export const W = 800;
export const H = 600;

export const PADDLE_W = 12;
export const PADDLE_H = 100;
export const PADDLE_MARGIN = 30; // gap between a paddle and its side wall
export const PADDLE_SPEED = 420; // px/s, human paddles

export const BALL_SIZE = 14;
export const BALL_START_SPEED = 420; // px/s at serve
export const BALL_SPEED_PER_HIT = 0.05; // +5% of the start speed per paddle hit in the rally
export const BALL_MAX_SPEED = 900; // px/s
export const MAX_BOUNCE_ANGLE = 55; // degrees, for a hit on the very edge of a paddle
export const SERVE_ANGLE = 25; // degrees, max random angle of a serve

export const SERVE_DELAY = 1; // seconds the ball waits (and blinks) before it launches
export const START_LIVES = 3;
export const GOAL_POINTS_PER_HIT = 10;
export const HIT_POINTS = 5; // awarded to a human each time their paddle returns the ball

export const MAX_DT = 0.05; // seconds; longer frames are clamped
export const MAX_STEP = 8; // px; the ball never moves more than this per sub-step
export const MAX_SCORE = 10_000_000;

// PvE: every MULTIPLIER_GOALS_PER_STEP goals scored by the human adds 1 to their score multiplier, up to MULTIPLIER_MAX_BONUS extra units.
export const MULTIPLIER_GOALS_PER_STEP = 3;
export const MULTIPLIER_MAX_BONUS = 10;

export type SuperTennisDifficulty = "easy" | "normal" | "hard";

/** CPU tuning and PvE score multiplier. Design values: adjust here, the engine reads nothing else. */
export const CPU: Record<
  SuperTennisDifficulty,
  { speed: number; reaction: number; aim: number; points: number }
> = {
  easy: { speed: 190, reaction: 0.45, aim: 120, points: 0.75 }, // px/s, seconds, ± px, score multiplier
  normal: { speed: 270, reaction: 0.22, aim: 60, points: 1 },
  hard: { speed: 480, reaction: 0.04, aim: 8, points: 1.5 },
};

export interface SuperTennisPalette {
  bg: string;
  net: string;
  left: string; // Player 1 paddle
  right: string; // Player 2 / CPU paddle
  ball: string;
  numeral: string; // big score digits
  tag: string; // P1 / P2 / CPU labels
  pipOn: string; // life pip kept
  pipOff: string; // life pip lost (outline)
  glow: number; // shadowBlur on paddles and ball, 0 = none
}

export const SKINS = {
  retro: {
    bg: "#000000",
    net: "rgba(255,255,255,0.45)",
    left: "#ffffff",
    right: "#ffffff",
    ball: "#ffffff",
    numeral: "rgba(255,255,255,0.9)",
    tag: "rgba(255,255,255,0.7)",
    pipOn: "#ffffff",
    pipOff: "rgba(255,255,255,0.35)",
    glow: 0,
  },
  // Page tokens --cyan --magenta --yellow on near-black; glow on paddles and ball only.
  neon: {
    bg: "#05020f",
    net: "rgba(0,245,255,0.5)",
    left: "#00f5ff",
    right: "#ff006e",
    ball: "#f5ff00",
    numeral: "rgba(0,245,255,0.85)",
    tag: "rgba(0,245,255,0.8)",
    pipOn: "#f5ff00",
    pipOff: "rgba(245,255,0,0.4)",
    glow: 14,
  },
  pastel: {
    bg: "#f3ecf7",
    net: "rgba(90,74,99,0.65)",
    left: "#2f8f7a",
    right: "#c4486a",
    ball: "#7c4fc0",
    numeral: "rgba(90,74,99,0.9)",
    tag: "#5a4a63",
    pipOn: "#7c4fc0",
    pipOff: "rgba(90,74,99,0.65)",
    glow: 0,
  },
  gothic: {
    bg: "#0d0a0e",
    net: "rgba(168,168,176,0.6)", // tarnished silver
    left: "#e8e0cc", // bone
    right: "#cf2442", // deep crimson
    ball: "#b9a4ff", // violet
    numeral: "rgba(232,224,204,0.8)",
    tag: "rgba(232,224,204,0.7)",
    pipOn: "#cf2442",
    pipOff: "rgba(207,36,66,0.9)",
    glow: 0,
  },
  // Computed inverse of retro, channel by channel (255 - c).
  negative: {
    bg: "#ffffff",
    net: "rgba(0,0,0,0.45)",
    left: "#000000",
    right: "#000000",
    ball: "#000000",
    numeral: "rgba(0,0,0,0.9)",
    tag: "rgba(0,0,0,0.7)",
    pipOn: "#000000",
    pipOff: "rgba(0,0,0,0.45)",
    glow: 0,
  },
  // Green phosphor monitor: two greens and a white ball, soft glow.
  phosphor: {
    bg: "#02100a",
    net: "rgba(125,255,166,0.45)",
    left: "#7dffa6",
    right: "#d4ff7a",
    ball: "#ffffff",
    numeral: "rgba(125,255,166,0.9)",
    tag: "rgba(125,255,166,0.85)",
    pipOn: "#7dffa6",
    pipOff: "rgba(125,255,166,0.45)",
    glow: 8,
  },
  // Tennis clay court: rust ground, cream lines, apricot opponent, yellow ball.
  "clay-court": {
    bg: "#5a2310",
    net: "rgba(246,239,224,0.5)",
    left: "#f6efe0",
    right: "#f2a03d",
    ball: "#e8f542",
    numeral: "rgba(246,239,224,0.95)",
    tag: "rgba(246,239,224,0.95)",
    pipOn: "#e8f542",
    pipOff: "rgba(246,239,224,0.5)",
    glow: 0,
  },
} satisfies Record<string, SuperTennisPalette>;

export type SuperTennisSkin = keyof typeof SKINS;
