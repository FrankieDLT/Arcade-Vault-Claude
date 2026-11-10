// Galactic DogFight constants. Coordinates: origin top-left, y grows down, units are canvas pixels and seconds.

export const W = 480;
export const H = 600;

export type EnemyKind = "bee" | "butterfly" | "boss";

// Formation: 10 x 5, slot (col, row) has its center at (SLOT_X0 + col * PITCH_X, SLOT_Y0 + row * PITCH_Y).
export const COLS = 10;
export const ROWS = 5;
export const SLOT_X0 = 60;
export const PITCH_X = 40;
export const SLOT_Y0 = 110;
export const PITCH_Y = 34;
export const ENEMY_W = 28;
export const ENEMY_H = 24;

// Fighter. PLAYER_Y is the center line of the ship(s).
export const PLAYER_Y = 540;
export const PLAYER_W = 26;
export const PLAYER_H = 26;
export const DUAL_GAP = 28; // distance between the two ship centers of the dual fighter
export const PLAYER_SPEED = 240; // px/s
export const SHOT_SPEED = 700; // px/s
export const SHOT_W = 4;
export const SHOT_H = 14;
export const MAX_SHOTS = 2; // bullets in flight
export const MAX_SHOTS_DUAL = 4;
export const FIRE_COOLDOWN = 0.16; // seconds between volleys while Space is held
export const START_LIVES = 3;
export const MAX_LIVES = 5;
export const RESPAWN_DELAY = 2; // seconds of engine clock
export const CAPTURED_RESPAWN_DELAY = 1; // extra wait after a capture animation

export const ENEMY_SHOT_W = 4;
export const ENEMY_SHOT_H = 10;

// Tractor beam
export const BEAM_DURATION = 3;
export const BEAM_RAMP = 0.5; // seconds for the cone to reach full length
export const BEAM_SPREAD = 0.2; // half width gained per px of length
export const BEAM_TOP_HALF = 8;
export const BEAM_STOP_Y = 280; // the Boss stops here to emit the beam
export const CAPTURE_TIME = 2;
export const POD_SPEED = 130; // px/s, the freed ship falling
export const POD_SIZE = 26;

// Formation motion
export const SWAY_AMP = 16;
export const SWAY_PERIOD = 4;
export const BREATH_AMP = 0.06; // pitch scale +-6%
export const BREATH_PERIOD = 3;

// Flights
export const ENTRY_SPEED = 270; // px/s along entry paths
export const CHALLENGE_SPEED = 250;
export const DIVE_SPEED = 230;
export const HOME_TIME = 0.6; // seconds to glide from the end of the entry path to the slot
export const RETURN_TIME = 1.1; // seconds from the top of the screen back to the slot
export const BOSS_RETURN_TIME = 1.6;
export const WAVE_GAP = 1.4; // seconds between entry waves
export const SHIP_GAP = 0.12; // seconds between ships of a wave

// Stage flow
export const BANNER_TIME = 1.8;
export const CLEARING_TIME = 1.5;
export const STATS_TIME = 3;
export const CHALLENGE_FIRST = 3;
export const CHALLENGE_EVERY = 4;
export const PARAMS_CAP_STAGE = 31;

export const SCORES = {
  bee: { formation: 50, dive: 100 },
  butterfly: { formation: 80, dive: 160 },
  boss: { formation: 150, dive: 400, diveEscort1: 800, diveEscort2: 1600 },
  rescue: 1000,
  capturedShot: 500,
  challenge: 100,
  perfect: 10_000,
} as const;

export const EXTRA_LIFE_FIRST = 20_000;
export const EXTRA_LIFE_STEP = 70_000;

export const STAR_COUNT = 60;
export const MAX_DT = 0.05; // seconds; longer frames are clamped
export const MAX_STEP = 8; // px; projectiles never move more than this per sub-step
export const MAX_SCORE = 10_000_000;

export interface EntryShip {
  kind: EnemyKind;
  col: number;
  row: number;
}

const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);
const ships = (kind: EnemyKind, row: number, cols: number[]): EntryShip[] =>
  cols.map((col) => ({ kind, col, row }));

/** 40 ships in 5 waves of 8: 4 Boss, 16 Butterfly, 20 Bee. Rows: 0 Boss, 1-2 Butterfly, 3-4 Bee. */
export const ENTRY_GROUPS: EntryShip[][] = [
  [...ships("boss", 0, range(3, 6)), ...ships("butterfly", 1, range(3, 6))],
  [...ships("butterfly", 1, [1, 2, 7, 8]), ...ships("butterfly", 2, [1, 2, 7, 8])],
  [...ships("butterfly", 2, range(3, 6)), ...ships("bee", 3, range(3, 6))],
  [...ships("bee", 3, [0, 1, 2, 7, 8, 9]), ...ships("bee", 4, [4, 5])],
  ships("bee", 4, [0, 1, 2, 3, 6, 7, 8, 9]),
];

export interface DogfightPalette {
  bg: string;
  star: string;
  bee: string;
  butterfly: string;
  boss: string;
  bossHit: string; // Boss after its first hit
  fighter: string;
  captured: string; // the captured / rescued ship
  shot: string;
  enemyShot: string;
  beam: string;
  text: string;
  glow: number; // shadowBlur on the fighter and shots only, 0 = none
}

export const SKINS = {
  retro: {
    bg: "#000000",
    star: "#ffffff",
    bee: "#ffffff",
    butterfly: "#ffffff",
    boss: "#ffffff",
    bossHit: "#8a8a8a",
    fighter: "#ffffff",
    captured: "#8a8a8a",
    shot: "#ffffff",
    enemyShot: "#ffffff",
    beam: "#ffffff",
    text: "#ffffff",
    glow: 0,
  },
  // Page tokens --yellow --magenta --cyan --green on near-black; glow on fighter and shots only.
  neon: {
    bg: "#05020f",
    star: "#7a88ff",
    bee: "#00f5ff",
    butterfly: "#ff006e",
    boss: "#f5ff00",
    bossHit: "#ff9a3c",
    fighter: "#00ff88",
    captured: "#ff3b3b",
    shot: "#00ff88",
    enemyShot: "#ff006e",
    beam: "#00f5ff",
    text: "#f5ff00",
    glow: 14,
  },
  pastel: {
    bg: "#f3ecf7",
    star: "#5a4a63",
    bee: "#2f8f7a",
    butterfly: "#c4486a",
    boss: "#7c4fc0",
    bossHit: "#b07a14",
    fighter: "#5a4a63",
    captured: "#d1242a",
    shot: "#5a4a63",
    enemyShot: "#c4486a",
    beam: "#2f8f7a",
    text: "#5a4a63",
    glow: 0,
  },
  gothic: {
    bg: "#0d0a0e",
    star: "#a8a8b0", // tarnished silver
    bee: "#e8e0cc", // bone
    butterfly: "#b9a4ff", // violet
    boss: "#cf2442", // deep crimson
    bossHit: "#ff7a5a",
    fighter: "#e8e0cc",
    captured: "#a8a8b0",
    shot: "#e8e0cc",
    enemyShot: "#e0405a",
    beam: "#b9a4ff",
    text: "#e8e0cc",
    glow: 0,
  },
  // Computed inverse of retro, channel by channel (255 - c).
  negative: {
    bg: "#ffffff",
    star: "#000000",
    bee: "#000000",
    butterfly: "#000000",
    boss: "#000000",
    bossHit: "#757575",
    fighter: "#000000",
    captured: "#757575",
    shot: "#000000",
    enemyShot: "#000000",
    beam: "#000000",
    text: "#000000",
    glow: 0,
  },
  // Synthwave dusk: plum sky, hot pink and amber sprites, cyan fighter with glow.
  "sunset-drive": {
    bg: "#1a0b2e",
    star: "#ff9de2",
    bee: "#ffd23f",
    butterfly: "#ff4fa3",
    boss: "#ff7a1a",
    bossHit: "#ffe9a8",
    fighter: "#5ff2ff",
    captured: "#b794ff",
    shot: "#5ff2ff",
    enemyShot: "#ff4fa3",
    beam: "#ffd23f",
    text: "#ffd23f",
    glow: 10,
  },
  // Chalk on a slate-green board.
  chalkboard: {
    bg: "#1f3a2e",
    star: "#f2f0e6",
    bee: "#f2f0e6",
    butterfly: "#f2a7b8",
    boss: "#f4d35e",
    bossHit: "#ffffff",
    fighter: "#9ad1f5",
    captured: "#f2a7b8",
    shot: "#9ad1f5",
    enemyShot: "#f4d35e",
    beam: "#9ad1f5",
    text: "#f2f0e6",
    glow: 0,
  },
} satisfies Record<string, DogfightPalette>;

export type GalacticDogfightSkin = keyof typeof SKINS;
