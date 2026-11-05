// Snake has no source code: every game value below is a design value of SPEC 09.
// Sprite crops are ported unchanged from references/source-assets/snake-assets/sprites.js.

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

export const SHEET_SRC = "/game-assets/snake/fruits.png";

export interface FruitSprite {
  x: number;
  y: number;
  w: number;
  h: number;
}

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

// Pixel-art row of fruits.png (all y = 136, h = 160).
export const FRUIT_SPRITES: Record<FruitName, FruitSprite> = {
  banana: { x: 34, y: 136, w: 110, h: 160 },
  orange: { x: 186, y: 136, w: 150, h: 160 },
  grape: { x: 378, y: 136, w: 110, h: 160 },
  garlic: { x: 540, y: 136, w: 130, h: 160 },
  eggplant: { x: 712, y: 136, w: 130, h: 160 },
  strawberry: { x: 894, y: 136, w: 110, h: 160 },
  cherry: { x: 1066, y: 136, w: 110, h: 160 },
  carrot: { x: 1228, y: 136, w: 130, h: 160 },
  mushroom: { x: 1400, y: 136, w: 130, h: 160 },
  broccoli: { x: 1582, y: 136, w: 110, h: 160 },
  watermelon: { x: 1734, y: 136, w: 150, h: 160 },
  pepper: { x: 1906, y: 136, w: 150, h: 160 },
  kiwi: { x: 2068, y: 136, w: 170, h: 160 },
  lemon: { x: 2250, y: 136, w: 140, h: 160 },
  peach: { x: 2432, y: 136, w: 130, h: 160 },
  peanut: { x: 2604, y: 136, w: 130, h: 160 },
  apple: { x: 2786, y: 136, w: 110, h: 160 },
  tomato: { x: 2948, y: 136, w: 130, h: 160 },
  berries: { x: 3110, y: 136, w: 150, h: 160 },
  grapes2: { x: 3302, y: 136, w: 110, h: 160 },
  pineapple: { x: 3454, y: 136, w: 150, h: 160 },
  melon: { x: 3637, y: 136, w: 130, h: 160 },
};

export const FRUIT_NAMES = Object.keys(FRUIT_SPRITES) as FruitName[];
export const BONUS_FRUIT: FruitName = "pineapple";

export type SnakeSkin = "retro" | "neon" | "pastel";

export interface SkinPalette {
  boardA: string; // checkerboard cell
  boardB: string; // checkerboard cell
  grid: string | null; // faint grid lines (neon only)
  body: string;
  head: string;
  eye: string;
  glow: number; // shadowBlur for the snake, 0 = none
  fruitFilter: string; // CSS filter for the sprites
  fallbackFruit: string; // flat circle if the sheet fails to load
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
    fallbackFruit: "#ff4d4d",
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
    fallbackFruit: "#ff006e",
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
    fallbackFruit: "#ff9aa8",
    bonusRing: "#f2b705",
  },
};
