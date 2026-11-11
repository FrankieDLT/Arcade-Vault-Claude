// Snake has no source code: every game value below is a design value of SPEC 09.
// Fruit art is original: 16x16 run tables in sprites.ts (SPEC 26).

export const COLS = 20;
export const ROWS = 15;
export const CELL = 40;
export const W = COLS * CELL; // 800
export const H = ROWS * CELL; // 600

export const START_LENGTH = 3;
export const START_COL = 10; // head column; body at 9 and 8
export const START_ROW = 7;

export const START_TPS = 8; // ticks per second at the start
export const TPS_PER_FRUIT = 0.4;
export const MAX_TPS = 16;

export const FRUIT_POINTS = 10;
export const BONUS_POINTS = 50;
export const BONUS_CHANCE = 0.15; // after each regular fruit, if no bonus is on the board
export const BONUS_LIFETIME = 6; // seconds of game time
export const BONUS_BLINK = 2; // blinks during the last seconds

export const MAX_DT = 0.1; // seconds; longest frame the clock accepts
export const INPUT_QUEUE = 2; // direction changes waiting for a tick

export const SPRITE_BOX = 36; // px; fruit sprites fit a square box centered in the cell

export const MAX_SCORE = 10_000_000;

export type FruitName =
  | "banana"
  | "orange"
  | "grape"
  | "garlic"
  | "eggplant"
  | "strawberry"
  | "cherry"
  | "carrot"
  | "mushroom"
  | "broccoli"
  | "watermelon"
  | "pepper"
  | "kiwi"
  | "lemon"
  | "peach"
  | "peanut"
  | "apple"
  | "tomato"
  | "berries"
  | "grapes2"
  | "pineapple"
  | "melon";

// The 22 regular fruits (see sprites.ts) and the golden bonus.
export type SpriteName = FruitName | "golden";
export const FRUIT_NAMES: readonly FruitName[] = [
  "banana", "orange", "grape", "garlic", "eggplant", "strawberry", "cherry", "carrot", "mushroom", "broccoli", "watermelon",
  "pepper", "kiwi", "lemon", "peach", "peanut", "apple", "tomato", "berries", "grapes2", "pineapple", "melon",
];
export const BONUS_FRUIT: SpriteName = "golden";

export type SnakeSkin = "retro" | "neon" | "pastel" | "gothic" | "negative" | "lcd-brick" | "magma";

export interface SkinPalette {
  boardA: string; // checkerboard cell
  boardB: string; // checkerboard cell
  grid: string | null; // faint grid lines (neon only)
  body: string;
  head: string;
  eye: string;
  glow: number; // shadowBlur for the snake, 0 = none
  fruitFilter: string; // CSS filter applied when the sprites are pre-rendered
  bonusRing: string;
}

export const SKINS: Record<SnakeSkin, SkinPalette> = {
  retro: {
    boardA: "#1c3a12",
    boardB: "#173010",
    grid: null,
    body: "#4caf3a",
    head: "#8be36a",
    eye: "#0d1f08",
    glow: 0,
    fruitFilter: "none",
    bonusRing: "#ffd400",
  },
  neon: {
    boardA: "#05060d",
    boardB: "#05060d",
    grid: "rgba(0, 245, 255, 0.12)",
    body: "#00ff88", // --green
    head: "#00f5ff", // --cyan
    eye: "#05060d",
    glow: 14,
    fruitFilter: "saturate(1.4) brightness(1.1)",
    bonusRing: "#f5ff00", // --yellow
  },
  pastel: {
    boardA: "#f3ecf7",
    boardB: "#e6dcef",
    grid: null,
    body: "#a8e6cf",
    head: "#ffb7c5",
    eye: "#5a4a63",
    glow: 0,
    fruitFilter: "saturate(0.7) brightness(1.15)",
    bonusRing: "#f2b705",
  },
  gothic: {
    boardA: "#0d0a0e",
    boardB: "#150f17",
    grid: "rgba(168, 168, 176, 0.07)", // tarnished silver
    body: "#cf2442", // deep crimson
    head: "#e8e0cc", // bone
    eye: "#2a0610",
    glow: 0,
    fruitFilter: "saturate(0.6) contrast(1.1) brightness(0.95)",
    bonusRing: "#b9a4ff", // violet
  },
  // Computed inverse of retro, channel by channel (255 - c); fruits use invert(1).
  negative: {
    boardA: "#e3c5ed",
    boardB: "#e8cfef",
    grid: null,
    body: "#9a3aae",
    head: "#741c95",
    eye: "#f2e0f7",
    glow: 0,
    fruitFilter: "invert(1)",
    bonusRing: "#002bff",
  },
  // 90s phone LCD: dark pixels on a green-gray screen.
  "lcd-brick": {
    boardA: "#c7d6a0",
    boardB: "#bccb94",
    grid: null,
    body: "#2d3b22",
    head: "#0f1a0a",
    eye: "#c7d6a0",
    glow: 0,
    fruitFilter: "grayscale(1) sepia(0.6) contrast(1.2)",
    bonusRing: "#0f1a0a",
  },
  // Molten rock: glowing orange snake on charred basalt.
  magma: {
    boardA: "#1a0d0a",
    boardB: "#240f08",
    grid: null,
    body: "#ff7a1a",
    head: "#ffd166",
    eye: "#1a0d0a",
    glow: 0,
    fruitFilter: "saturate(1.3) hue-rotate(-10deg)",
    bonusRing: "#7fe7ff",
  },
};
