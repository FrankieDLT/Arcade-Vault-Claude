// Every tuned number of Glowmaw lives here. All values are design decisions of the spec.

export const COLS = 19;
export const ROWS = 15;
export const CELL = 40;
export const W = 800;
export const H = 600;
export const MAZE_X = 20;
export const MAZE_Y = 0;

/** Glowmaw speed in tiles/s (220 px/s). */
export const PLAYER_SPEED = 5.5;
/** Drifter speed at level 1, tiles/s. */
export const DRIFTER_BASE = 4.2;
export const DRIFTER_PER_LEVEL = 0.1;
/** Cap (reached at level 12); always below PLAYER_SPEED. */
export const DRIFTER_MAX = 5.3;
export const DAZED_SPEED = 3.0;
export const EYES_SPEED = 10;

export const START_LIVES = 3;
export const MAX_LIVES = 5;
export const EXTRA_LIFE_FIRST = 10_000;
export const EXTRA_LIFE_STEP = 40_000;

/** Seconds from the end of the ready freeze (per drifter: Hunter, Mirror, Roamer, Pacer). */
export const RELEASE_TIMES = [0, 4, 8, 12] as const;
/** First level with the fourth drifter (Pacer). */
export const FOURTH_LEVEL = 4;

export const DAZE_BASE = 6;
export const DAZE_STEP = 0.4;
export const DAZE_MIN = 2;
export const DAZE_BLINK = 1.5;
export const DEN_REST = 1.5;

export const STREAK_GAP = 0.6;
export const STREAK_STEP = 10;
export const MAX_MULT = 5;

export const READY_TIME = 1.5;
export const DEATH_TIME = 1.2;
export const CLEAR_TIME = 1.2;
/** Seconds per on/off phase of the maze flash after a clear. */
export const CLEAR_FLASH = 0.15;

export const EAT_RADIUS = 10;
export const KILL_RADIUS = 26;
export const MAX_STEP = 8;
export const MAX_DT = 0.1;
export const MAX_LEVEL = 99;
export const MAX_SCORE = 10_000_000;

export const MOTE_POINTS = 10;
export const PEARL_POINTS = 50;
export const DRIFTER_POINTS = 100;
export const CLEAR_BONUS = 1000;

/** Glowmaw body radius and the streak ring radius, px. */
export const PLAYER_RADIUS = 15;
export const RING_RADIUS = 22;

/** Den geometry (cells). */
export const DEN_COL = 9;
export const DEN_ROW = 7;
export const DOOR_ROW = 6;
export const EXIT_ROW = 5;

// Legend: # wall, . mote, o pearl, _ empty floor, - den door (drifters only), P Glowmaw start.
// Row 7 is open at columns 0 and 18 (the warp).
export const MAZE_A: readonly string[] = [
  "###################",
  "#........#........#",
  "#o##.###.#.###.##o#",
  "#.................#",
  "#.##.#.#####.#.##.#",
  "#....#.......#....#",
  "####.#.##-##.#.####",
  ".....#.#___#.#.....",
  "####.#.#####.#.####",
  "#....#.......#....#",
  "#.##.#.#####.#.##.#",
  "#........P........#",
  "#o##.###.#.###.##o#",
  "#........#........#",
  "###################",
];

export type SkinId = "abyss" | "retro" | "neon" | "pastel" | "gothic" | "negative" | "coral" | "sunken-ruin" | "paper-lantern";

export interface SkinPalette {
  bg: string;
  wallFill: string;
  wallStroke: string;
  /** shadowBlur of the wall outline (static, drawn once). */
  wallGlow: number;
  /** Outline color during the clear flash. */
  flash: string;
  mote: string;
  pearl: string;
  player: string;
  halo: string;
  haloBlur: number;
  /** Dark detail color (eye of Glowmaw, pupils). */
  eye: string;
  door: string;
  ring: string;
  tag: string;
  /** Hunter, Mirror, Roamer, Pacer. */
  drifters: readonly [string, string, string, string];
  dazed: string;
  dazedBlink: string;
}

// `neon` uses the page tokens --cyan --yellow --magenta --green --silver.
export const SKINS: Record<SkinId, SkinPalette> = {
  abyss: {
    bg: "#030b17",
    wallFill: "#0d3b46",
    wallStroke: "#00d8e8",
    wallGlow: 6,
    flash: "#c8fbff",
    mote: "#bff7ff",
    pearl: "#f2fdff",
    player: "#c9fbff",
    halo: "#00f5ff",
    haloBlur: 18,
    eye: "#031019",
    door: "#5be9f5",
    ring: "#00f5ff",
    tag: "#e8fdff",
    drifters: ["#ff2f92", "#2bf08a", "#ffd23a", "#c7d0e0"],
    dazed: "#8fb8ff",
    dazedBlink: "#ffffff",
  },
  // 8-bit home-computer look: black, indigo walls, yellow Glowmaw.
  retro: {
    bg: "#000000",
    wallFill: "#16224a",
    wallStroke: "#5a78ff",
    wallGlow: 0,
    flash: "#ffffff",
    mote: "#ffe9a8",
    pearl: "#ffffff",
    player: "#ffe14a",
    halo: "#ffe14a",
    haloBlur: 10,
    eye: "#000000",
    door: "#ff7ad0",
    ring: "#ffe14a",
    tag: "#ffe14a",
    drifters: ["#ff4a3a", "#46d65a", "#ff9a2a", "#d8d8e8"],
    dazed: "#4a6bff",
    dazedBlink: "#ffffff",
  },
  pastel: {
    bg: "#f6f0fa",
    wallFill: "#d6e6f7",
    wallStroke: "#5f7fae",
    wallGlow: 0,
    flash: "#2a2150",
    mote: "#b8678f",
    pearl: "#d9457f",
    player: "#b87500",
    halo: "#b87500",
    haloBlur: 8,
    eye: "#fff6e0",
    door: "#c04a86",
    ring: "#c47a00",
    tag: "#4a3a6a",
    drifters: ["#d9456f", "#278a66", "#a67608", "#6a72b8"],
    dazed: "#4a7bd0",
    dazedBlink: "#1b2f7a",
  },
  gothic: {
    bg: "#0a0709",
    wallFill: "#1a0f1c",
    wallStroke: "#b03050",
    wallGlow: 3,
    flash: "#e8dfc8",
    mote: "#d8ceb4",
    pearl: "#f0e8d0",
    player: "#e8dfc8",
    halo: "#8a5fc0",
    haloBlur: 16,
    eye: "#0a0709",
    door: "#a9adb8",
    ring: "#a88af0",
    tag: "#e8dfc8",
    drifters: ["#d9344f", "#a88af0", "#b8bcc8", "#7fa59a"],
    dazed: "#6f7fa8",
    dazedBlink: "#f0e8d0",
  },
  // Computed inverse (255 - channel) of `retro`; drifter and dazed hues adjusted to keep 3:1 on white.
  negative: {
    bg: "#ffffff",
    wallFill: "#e9ddb5",
    wallStroke: "#a58700",
    wallGlow: 0,
    flash: "#000000",
    mote: "#001657",
    pearl: "#000000",
    player: "#001eb5",
    halo: "#001eb5",
    haloBlur: 0,
    eye: "#ffffff",
    door: "#00852f",
    ring: "#001eb5",
    tag: "#001eb5",
    drifters: ["#009aa8", "#b929a5", "#0065d5", "#272717"],
    dazed: "#9a7b00",
    dazedBlink: "#000000",
  },
  neon: {
    bg: "#000000",
    wallFill: "#000000",
    wallStroke: "#00f5ff",
    wallGlow: 12,
    flash: "#ffffff",
    mote: "#f5ff00",
    pearl: "#ff006e",
    player: "#f5ff00",
    halo: "#f5ff00",
    haloBlur: 30,
    eye: "#000000",
    door: "#ff006e",
    ring: "#00f5ff",
    tag: "#f5ff00",
    drifters: ["#ff006e", "#00f5ff", "#00ff88", "#c7d0e0"],
    dazed: "#7aa2ff",
    dazedBlink: "#ffffff",
  },
  coral: {
    bg: "#1a0b1f",
    wallFill: "#b04062",
    wallStroke: "#ffc8a0",
    wallGlow: 4,
    flash: "#fff0e0",
    mote: "#f2dfb8",
    pearl: "#fff3df",
    player: "#ffcf4a",
    halo: "#ffb27a",
    haloBlur: 16,
    eye: "#2a1020",
    door: "#ffc8a0",
    ring: "#ffcf4a",
    tag: "#fff3df",
    drifters: ["#37c4b8", "#b99cf2", "#8ff0c0", "#e8d2a0"],
    dazed: "#8fb4e8",
    dazedBlink: "#ffffff",
  },
  // Drowned temple: verdigris stone, old gold Glowmaw.
  "sunken-ruin": {
    bg: "#07100e",
    wallFill: "#1f3a34",
    wallStroke: "#4fae98",
    wallGlow: 2,
    flash: "#e8f5ee",
    mote: "#cfe8d8",
    pearl: "#f4ecd0",
    player: "#e3b94f",
    halo: "#e3b94f",
    haloBlur: 14,
    eye: "#07100e",
    door: "#e08a6a",
    ring: "#e3b94f",
    tag: "#efe6c8",
    drifters: ["#ff7a5c", "#e8e0c8", "#a58be0", "#c9683a"],
    dazed: "#6fa8d8",
    dazedBlink: "#ffffff",
  },
  // Night festival: indigo sky, plum walls, lantern-orange Glowmaw.
  "paper-lantern": {
    bg: "#0e1030",
    wallFill: "#2a1d4e",
    wallStroke: "#8f7be0",
    wallGlow: 4,
    flash: "#fff4dc",
    mote: "#ffe3b0",
    pearl: "#fff4dc",
    player: "#ffb347",
    halo: "#ffb347",
    haloBlur: 22,
    eye: "#0e1030",
    door: "#ff6a4a",
    ring: "#ffb347",
    tag: "#fff4dc",
    drifters: ["#ff4d3a", "#3fd9a0", "#ffd23a", "#efe6d0"],
    dazed: "#7aa2ff",
    dazedBlink: "#ffffff",
  },
};
