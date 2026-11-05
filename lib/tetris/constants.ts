export type TetrisSkin = "retro" | "neon" | "pastel" | "gothic" | "negative" | "woodshop" | "ice-cavern" | "pixel";
export type TetrisTheme = "dark" | "light";

export type Shape = number[][];

// Board
export const COLS = 10;
export const ROWS = 20;
export const BLOCK = 30;
export const PREVIEW_BLOCK = 30;

// Canvas (logical pixels): board on the left, a 120-wide column on the right
export const W = 440;
export const H = 600;
export const BOARD_W = COLS * BLOCK;
export const BOARD_H = ROWS * BLOCK;

// Pieces, index 1 to 7 = I, O, T, S, Z, J, L (index 0 is an unused placeholder)
export const PIECE_TYPES = 7;
export const PIECES: readonly Shape[] = [
  [],
  [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I
  [[2, 2], [2, 2]], // O
  [[0, 3, 0], [3, 3, 3], [0, 0, 0]], // T
  [[0, 4, 4], [4, 4, 0], [0, 0, 0]], // S
  [[5, 5, 0], [0, 5, 5], [0, 0, 0]], // Z
  [[6, 0, 0], [6, 6, 6], [0, 0, 0]], // J
  [[0, 0, 7], [7, 7, 7], [0, 0, 0]], // L
];

// Piece colors by skin, index 1 to 7 (index 0 is an unused placeholder).
// `neon` uses the page tokens: --cyan --yellow --magenta --green --bronze --silver --gold.
export const SKIN_COLORS: Record<TetrisSkin, readonly string[]> = {
  retro: ["", "#4dd0e1", "#ffd54f", "#ba68c8", "#81c784", "#e57373", "#64b5f6", "#ffb74d"],
  neon: ["", "#00f5ff", "#f5ff00", "#ff006e", "#00ff88", "#d97a3a", "#c7d0e0", "#ffcf3a"],
  pastel: ["", "#a8e6ef", "#fff1b8", "#d9b8f0", "#b8e6c1", "#f5b8b8", "#b8d4f5", "#fbd3a8"],
  gothic: ["", "#9b8fc4", "#d8ceb4", "#c2314b", "#8a5fc0", "#d9566b", "#a9adb8", "#e8dfc8"],
  // computed inverse of retro (255 - channel)
  negative: ["", "#b22f1e", "#002ab0", "#459737", "#7e387b", "#1a8c8c", "#9b4a09", "#0048b2"],
  woodshop: ["", "#e0b27a", "#f2d16b", "#c8553d", "#8fae5a", "#d98b4a", "#7aa6b8", "#e8dcc4"],
  "ice-cavern": ["", "#bff3ff", "#ffffff", "#8fb7ff", "#6fe3d0", "#c4a8ff", "#5fa0e8", "#e0f0ff"],
  pixel: ["", "#29b6f6", "#fdd835", "#ab47bc", "#66bb6a", "#ef5350", "#3f6fd8", "#fb8c00"],
};

export interface ThemeColors {
  background: string; // canvas background, outside the boxes
  boardFill: string; // board and preview box fill
  grid: string;
  border: string;
  label: string; // NEXT / HOLD
}

export const THEME_COLORS: Record<TetrisTheme, ThemeColors> = {
  dark: {
    background: "#0f0f17",
    boardFill: "#1a1a25",
    grid: "#22222e",
    border: "#2a2a3a",
    label: "#9a9ab8",
  },
  light: {
    background: "#f2f3f7",
    boardFill: "#ffffff",
    grid: "#e3e5ee",
    border: "#c8cad6",
    label: "#6b6d85",
  },
};

// Per-skin overrides of the theme colors, so every piece palette keeps 3:1 against its board
// (labels 4.5:1 against the canvas background). `neon` and `gothic` use a dark board in both themes.
const DARK_BOARD = { boardFill: "#22222e", grid: "#30303e" } as const;
export const SKIN_THEME_OVERRIDES: Partial<
  Record<TetrisSkin, Partial<Record<TetrisTheme, Partial<ThemeColors>>>>
> = {
  retro: { light: DARK_BOARD },
  pixel: { light: DARK_BOARD },
  neon: {
    dark: { boardFill: "#000000", grid: "#1c1c2c" },
    light: { boardFill: "#000000", grid: "#1c1c2c" },
  },
  pastel: {
    light: { boardFill: "#4a4663", grid: "#5a5675", border: "#7a7699" },
  },
  gothic: {
    dark: { background: "#0a0709", boardFill: "#120d12", grid: "#241822", border: "#5a2030", label: "#a89fb0" },
    light: { background: "#e9e2d0", boardFill: "#120d12", grid: "#241822", border: "#5a2030", label: "#4a3b45" },
  },
  woodshop: {
    dark: { background: "#14100c", boardFill: "#241a12", grid: "#33261b", border: "#5a4630", label: "#b8a890" },
    light: { background: "#efe4d0", boardFill: "#241a12", grid: "#33261b", border: "#8a6f4a", label: "#5a4630" },
  },
  "ice-cavern": {
    dark: { background: "#050d1a", boardFill: "#0a1a30", grid: "#14294a", border: "#2c4a75", label: "#8fb7d0" },
    light: { background: "#e6f1fa", boardFill: "#0a1a30", grid: "#14294a", border: "#5f86b0", label: "#33506b" },
  },
  // Light board in both themes (inverse of retro); the theme only changes the canvas surround.
  negative: {
    dark: { background: "#14141a", boardFill: "#f4f4ec", grid: "#dcdcd0", border: "#d5d5c5", label: "#a9a9c4" },
    light: { background: "#f0f0e8", boardFill: "#f4f4ec", grid: "#dcdcd0", border: "#8a8a7a", label: "#555570" },
  },
};

export const getThemeColors = (skin: TetrisSkin, theme: TetrisTheme): ThemeColors => ({
  ...THEME_COLORS[theme],
  ...SKIN_THEME_OVERRIDES[skin]?.[theme],
});

// Side column
export const SIDE_X = 320;
export const SIDE_W = 120;
export const NEXT_LABEL_Y = 10;
export const NEXT_BOX = { x: SIDE_X, y: 20, w: SIDE_W, h: 120 } as const;
export const HOLD_LABEL_Y = 170;
export const HOLD_BOX = { x: SIDE_X, y: 180, w: SIDE_W, h: 120 } as const;

// Drawing
export const GRID_LINE_WIDTH = 0.5;
export const GHOST_ALPHA = 0.2;
export const LABEL_FONT = 'bold 10px "Courier New", monospace';
export const LABEL_LETTER_SPACING = "2px";

// Scoring and speed
export const LINE_SCORES = [0, 100, 300, 500, 800] as const;
export const SOFT_DROP_POINTS = 1;
export const HARD_DROP_POINTS = 2;
export const LINES_PER_LEVEL = 10;
export const MAX_SCORE = 10_000_000;

export const BASE_INTERVAL = 1000;
export const INTERVAL_STEP = 90;
export const MIN_INTERVAL = 100;
export const SLOW_FACTOR = 2;

// Rotation wall kicks, tried in order
export const KICKS = [0, -1, 1, -2, 2] as const;
