// Every tuned number of Street Jumper lives here. All values are design decisions of the spec.

export const COLS = 16;
export const ROWS = 14;
export const CELL = 40;
export const W = COLS * CELL; // 640
export const H = ROWS * CELL; // 560

// Zones (row index, 0 = top).
export const ROW_GOALS = 0;
export const ROW_RIVER_TOP = 1;
export const ROW_RIVER_BOT = 6;
export const ROW_SAFE_MID = 7;
export const ROW_ROAD_TOP = 8;
export const ROW_ROAD_BOT = 12;
export const ROW_START = 13;

export const START_COL = 8;
export const START_LIVES = 3;

/** Seconds a hop lasts. */
export const JUMP_TIME = 0.12;
/** Seconds the frog stays frozen after dying / after a round clears. */
export const DEATH_TIME = 0.5;
export const CLEAR_TIME = 0.7;

/** Lanes wrap on a loop of this many cells; entities live in [-LOOP_MARGIN, COLS). */
export const LOOP = 20;
export const LOOP_MARGIN = 4;

/** First column of each of the 5 goal slots; a slot spans 2 columns. Other columns of row 0 are walls. */
export const GOAL_SLOTS: readonly number[] = [1, 4, 7, 10, 13];
export const GOAL_SPAN = 2;

/** Round timer: 15 s at level 1, one second less per level, never below 8 s. */
export const TIME_BASE = 15;
export const TIME_STEP = 1;
export const TIME_MIN = 8;
/** Round timer drain rate: 0.5 means the countdown runs 50% slower (a 15 s round lasts 30 s). */
export const TIME_RATE = 0.5;

/** Lane speed grows 15% per level (compound), capped. */
export const SPEED_PER_LEVEL = 1.15;
export const SPEED_CAP = 2.5;

/** Turtle cycle: seconds visible, seconds submerged, and the last seconds of visibility that blink as a warning. */
export const TURTLE_UP = 9;
export const TURTLE_DOWN = 4.5;
export const TURTLE_WARN = 1.8;

export const ROW_POINTS = 10;
export const GOAL_POINTS = 50;
export const ROUND_POINTS = 200;
export const TIME_POINTS = 10;
export const MAX_LEVEL = 99;
export const MAX_SCORE = 10_000_000;
export const MAX_DT = 0.1;

export type SkinId = "retro" | "neon" | "pastel" | "gothic" | "negative" | "tide-poster" | "midnight-toll";

export interface SkinPalette {
  road: string;
  roadLine: string;
  river: string;
  riverWave: string;
  safe: string;
  safeEdge: string;
  goalWall: string;
  goalSlot: string;
  goalBorder: string;
  log: string;
  logLine: string;
  turtle: string;
  turtleShell: string;
  turtleWarn: string;
  cars: readonly string[];
  truckBody: string;
  truckCab: string;
  wheel: string;
  frog: string;
  frogBelly: string;
  frogEye: string;
  frogDead: string;
  timeGood: string;
  timeMid: string;
  timeLow: string;
  timeTrack: string;
}

const RETRO: SkinPalette = {
  road: "#16161c",
  roadLine: "#f2d94e",
  river: "#0b2a63",
  riverWave: "#1a4a9a",
  safe: "#16602a",
  safeEdge: "#2f9e4a",
  goalWall: "#0c3d1a",
  goalSlot: "#1d8a3a",
  goalBorder: "#e8b800",
  log: "#7a4a1d",
  logLine: "#4f2f10",
  turtle: "#2fbf5b",
  turtleShell: "#17803a",
  turtleWarn: "#9ee8b4",
  cars: ["#e03030", "#f2c230", "#3a7ae0"],
  truckBody: "#a5a8b0",
  truckCab: "#d0402f",
  wheel: "#0a0a0a",
  frog: "#52f06a",
  frogBelly: "#b6f7c0",
  frogEye: "#ffffff",
  frogDead: "#ff4d4d",
  timeGood: "#3ee66b",
  timeMid: "#ffd23a",
  timeLow: "#ff4040",
  timeTrack: "#0a0a0a",
};

/** Inverts one #rrggbb color channel by channel. */
const invertHex = (hex: string): string => {
  const n = parseInt(hex.slice(1), 16);
  return "#" + (0xffffff - n).toString(16).padStart(6, "0");
};

const NEGATIVE_BASE = Object.fromEntries(
  Object.entries(RETRO).map(([k, v]) => [k, Array.isArray(v) ? v.map(invertHex) : invertHex(v as string)]),
) as unknown as SkinPalette;

/** Computed inverse of retro; a few fields are nudged so every sprite keeps 3:1 against its lane. */
const NEGATIVE: SkinPalette = {
  ...NEGATIVE_BASE,
  goalSlot: "#d8f0e0",
  log: "#6a4a2a",
  logLine: "#d8c0a0",
  cars: ["#007a7a", "#0d3dcf", "#8a5a00"],
  truckCab: "#146e78",
  frog: "#6a2a80",
  frogDead: "#007a80",
  timeLow: "#007a88",
};

const NEON: SkinPalette = {
  road: "#05060f",
  roadLine: "#f5ff00",
  river: "#050a2a",
  riverWave: "#00f5ff",
  safe: "#0a0a1c",
  safeEdge: "#ff006e",
  goalWall: "#02020a",
  goalSlot: "#06233a",
  goalBorder: "#00f5ff",
  log: "#ff006e",
  logLine: "#ffd0e6",
  turtle: "#00ff88",
  turtleShell: "#007a44",
  turtleWarn: "#f5ff00",
  cars: ["#ff006e", "#f5ff00", "#00f5ff"],
  truckBody: "#00f5ff",
  truckCab: "#ff006e",
  wheel: "#000000",
  frog: "#00ff88",
  frogBelly: "#eafff4",
  frogEye: "#ffffff",
  frogDead: "#ff006e",
  timeGood: "#00ff88",
  timeMid: "#f5ff00",
  timeLow: "#ff006e",
  timeTrack: "#000000",
};

const PASTEL: SkinPalette = {
  road: "#d9d5e8",
  roadLine: "#fffbe6",
  river: "#b5dcf5",
  riverWave: "#ffffff",
  safe: "#d2efcf",
  safeEdge: "#86c283",
  goalWall: "#8fae8c",
  goalSlot: "#eaf8e7",
  goalBorder: "#8a5a1f",
  log: "#8a4f1c",
  logLine: "#4e2c0c",
  turtle: "#1f7a3a",
  turtleShell: "#124d24",
  turtleWarn: "#c2410c",
  cars: ["#a8203f", "#7a5000", "#2a46a0"],
  truckBody: "#5a5f78",
  truckCab: "#b02a4a",
  wheel: "#2a2a38",
  frog: "#1a6b34",
  frogBelly: "#d9f7de",
  frogEye: "#ffffff",
  frogDead: "#b3203f",
  timeGood: "#8fe3a6",
  timeMid: "#ffe08a",
  timeLow: "#ff9aa8",
  timeTrack: "#3a3650",
};

const GOTHIC: SkinPalette = {
  road: "#0d0b10",
  roadLine: "#b9b2a0",
  river: "#1a0c26",
  riverWave: "#5b2f86",
  safe: "#1c1418",
  safeEdge: "#8c1226",
  goalWall: "#07050a",
  goalSlot: "#2a0f1e",
  goalBorder: "#b8b8c4",
  log: "#8a6a4a",
  logLine: "#2a1c12",
  turtle: "#9a96a8",
  turtleShell: "#4c4860",
  turtleWarn: "#f1ead6",
  cars: ["#ee3f5c", "#b88af0", "#d8d0b8"],
  truckBody: "#8a8a96",
  truckCab: "#ee3f5c",
  wheel: "#000000",
  frog: "#e8e0c8",
  frogBelly: "#a81830",
  frogEye: "#f1ead6",
  frogDead: "#ff2a48",
  timeGood: "#b9b2a0",
  timeMid: "#9a5ad0",
  timeLow: "#e0203c",
  timeTrack: "#050408",
};

const TIDE_POSTER: SkinPalette = {
  road: "#1b2a3a",
  roadLine: "#e0a82e",
  river: "#0a3038",
  riverWave: "#2f8a96",
  safe: "#f2e6c8",
  safeEdge: "#d9c79a",
  goalWall: "#1b2a3a",
  goalSlot: "#f7efd8",
  goalBorder: "#c2512f",
  log: "#e8d3a0",
  logLine: "#8a5a2a",
  turtle: "#e0a82e",
  turtleShell: "#a8760f",
  turtleWarn: "#f7efd8",
  cars: ["#c2512f", "#e0a82e", "#f2e6c8"],
  truckBody: "#f2e6c8",
  truckCab: "#c2512f",
  wheel: "#0a121a",
  frog: "#28903c",
  frogBelly: "#d9f0c8",
  frogEye: "#ffffff",
  frogDead: "#c2512f",
  timeGood: "#7fd08a",
  timeMid: "#e0a82e",
  timeLow: "#e8704a",
  timeTrack: "#0a121a",
};

const MIDNIGHT_TOLL: SkinPalette = {
  road: "#11161f",
  roadLine: "#ff9a2e",
  river: "#0a1a33",
  riverWave: "#2a4a80",
  safe: "#1a2230",
  safeEdge: "#ff9a2e",
  goalWall: "#07090e",
  goalSlot: "#12263f",
  goalBorder: "#ff9a2e",
  log: "#8a6a52",
  logLine: "#3a281c",
  turtle: "#2fb3a3",
  turtleShell: "#14685f",
  turtleWarn: "#dfe9f5",
  cars: ["#ff9a2e", "#dfe9f5", "#e0455a"],
  truckBody: "#7f8fa8",
  truckCab: "#ff9a2e",
  wheel: "#000000",
  frog: "#2fb3a3",
  frogBelly: "#dfe9f5",
  frogEye: "#ffffff",
  frogDead: "#ff4d5e",
  timeGood: "#2fb3a3",
  timeMid: "#ff9a2e",
  timeLow: "#ff4d5e",
  timeTrack: "#05070b",
};

export const SKINS: Record<SkinId, SkinPalette> = {
  retro: RETRO,
  neon: NEON,
  pastel: PASTEL,
  gothic: GOTHIC,
  negative: NEGATIVE,
  "tide-poster": TIDE_POSTER,
  "midnight-toll": MIDNIGHT_TOLL,
};

export type LaneKind = "road" | "river";
export type EntityType = "car" | "truck" | "log" | "turtle";

export interface LaneTemplate {
  row: number;
  kind: LaneKind;
  /** Base speed in cells per second at level 1. */
  speed: number;
  dir: 1 | -1;
  /** [start col, width, type] of each entity, inside the loop. */
  entities: readonly (readonly [number, number, EntityType])[];
}

// Gaps between entities are always at least 3 cells on roads and 3 on rivers.
export const LANE_TEMPLATES: readonly LaneTemplate[] = [
  // River, row 1 (far) to 6 (near the median).
  { row: 1, kind: "river", speed: 1.7, dir: -1, entities: [[3, 3, "log"], [10, 3, "log"], [16, 3, "log"]] },
  { row: 2, kind: "river", speed: 1.0, dir: 1, entities: [[0, 2, "turtle"], [5, 2, "turtle"], [10, 2, "turtle"], [15, 2, "turtle"]] },
  { row: 3, kind: "river", speed: 1.5, dir: -1, entities: [[2, 2, "log"], [7, 2, "log"], [12, 2, "log"], [17, 2, "log"]] },
  { row: 4, kind: "river", speed: 1.9, dir: 1, entities: [[0, 4, "log"], [10, 4, "log"]] },
  { row: 5, kind: "river", speed: 1.0, dir: -1, entities: [[1, 3, "turtle"], [8, 3, "turtle"], [15, 3, "turtle"]] },
  { row: 6, kind: "river", speed: 1.2, dir: 1, entities: [[0, 3, "log"], [7, 3, "log"], [14, 3, "log"]] },
  // Road, row 8 (far) to 12 (near the start).
  { row: 8, kind: "road", speed: 2.6, dir: 1, entities: [[3, 2, "car"], [12, 2, "car"]] },
  { row: 9, kind: "road", speed: 3.2, dir: -1, entities: [[1, 1, "car"], [8, 1, "car"], [14, 1, "car"]] },
  { row: 10, kind: "road", speed: 1.4, dir: 1, entities: [[0, 3, "truck"], [10, 3, "truck"]] },
  { row: 11, kind: "road", speed: 2.2, dir: -1, entities: [[2, 1, "car"], [9, 1, "car"], [16, 1, "car"]] },
  { row: 12, kind: "road", speed: 1.6, dir: 1, entities: [[0, 1, "car"], [5, 1, "car"], [10, 1, "car"], [15, 1, "car"]] },
];
