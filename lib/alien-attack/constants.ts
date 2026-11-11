// Alien Attack constants. Coordinates: origin top-left, y grows down, units are canvas pixels and seconds.

export const W = 800;
export const H = 600;

export const COLS = 11;
export const ROWS = 5;
export const INVADER_W = 32; // hit box; the sprite (11 cells x 3 px) is drawn from the same left edge
export const INVADER_H = 24;
export const PITCH_X = 48; // distance between invader columns
export const PITCH_Y = 40; // distance between invader rows
export const STEP_X = 16; // px the fleet moves per march step
export const STEP_DOWN = 24; // px the fleet drops at each edge
export const FLEET_MARGIN = 20; // gap kept between the fleet and the side walls

export const CANNON_W = 44;
export const CANNON_H = 22;
export const CANNON_Y = 540; // top edge of the cannon, also the "landing" line for invaders
export const GROUND_Y = CANNON_Y + CANNON_H + 6; // ground line, bombs vanish here
export const CANNON_SPEED = 360; // px/s

export const SHOT_W = 4;
export const SHOT_H = 14;
export const SHOT_SPEED = 600; // px/s
export const BOMB_W = 6;
export const BOMB_H = 14;
export const BOMB_SPEED = 240; // px/s
export const MAX_BOMBS = 3;

export const START_LIVES = 3;
export const RESPAWN_DELAY = 1.2; // seconds the cannon is out after a hit
export const ROW_POINTS = [30, 20, 20, 10, 10]; // by row, row 0 is the top row
export const WAVE_BONUS = 100; // times the level of the wave just cleared

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 99;

export const MAX_DT = 0.05; // seconds; longer frames are clamped
export const MAX_STEP = 8; // px; shots and bombs never move more than this per sub-step
export const MAX_SCORE = 10_000_000;

export interface InvadersPalette {
  bg: string;
  ground: string;
  rowTop: string; // row 0 (30 points)
  rowMid: string; // rows 1 and 2 (20 points)
  rowBot: string; // rows 3 and 4 (10 points)
  cannon: string;
  shot: string;
  bomb: string;
  glow: number; // shadowBlur on the cannon and shots only, 0 = none
}

export const SKINS = {
  retro: {
    bg: "#000000",
    ground: "rgba(255,255,255,0.6)",
    rowTop: "#ffffff",
    rowMid: "#ffffff",
    rowBot: "#ffffff",
    cannon: "#ffffff",
    shot: "#ffffff",
    bomb: "#ffffff",
    glow: 0,
  },
  // Page tokens --yellow --magenta --cyan --green on near-black; glow on cannon and shots only.
  neon: {
    bg: "#05020f",
    ground: "rgba(0,245,255,0.6)",
    rowTop: "#f5ff00",
    rowMid: "#ff006e",
    rowBot: "#00f5ff",
    cannon: "#00ff88",
    shot: "#00ff88",
    bomb: "#f5ff00",
    glow: 14,
  },
  pastel: {
    bg: "#f3ecf7",
    ground: "rgba(90,74,99,0.65)",
    rowTop: "#7c4fc0",
    rowMid: "#c4486a",
    rowBot: "#2f8f7a",
    cannon: "#5a4a63",
    shot: "#5a4a63",
    bomb: "#c4486a",
    glow: 0,
  },
  gothic: {
    bg: "#0d0a0e",
    ground: "rgba(168,168,176,0.6)", // tarnished silver
    rowTop: "#b9a4ff", // violet
    rowMid: "#cf2442", // deep crimson
    rowBot: "#e8e0cc", // bone
    cannon: "#e8e0cc",
    shot: "#e8e0cc",
    bomb: "#cf2442",
    glow: 0,
  },
  // Computed inverse of retro, channel by channel (255 - c).
  negative: {
    bg: "#ffffff",
    ground: "rgba(0,0,0,0.6)",
    rowTop: "#000000",
    rowMid: "#000000",
    rowBot: "#000000",
    cannon: "#000000",
    shot: "#000000",
    bomb: "#000000",
    glow: 0,
  },
  // Drafting-table schematic: pale ink on deep blue.
  blueprint: {
    bg: "#0b2a5b",
    ground: "rgba(232,241,255,0.6)",
    rowTop: "#ffd166",
    rowMid: "#7fd0ff",
    rowBot: "#e8f1ff",
    cannon: "#ffffff",
    shot: "#ffffff",
    bomb: "#ff9f68",
    glow: 0,
  },
  // Old newspaper: ink and two spot colors on yellowed paper.
  newsprint: {
    bg: "#e9e1cf",
    ground: "rgba(27,26,23,0.6)",
    rowTop: "#b3261e",
    rowMid: "#1f3f8a",
    rowBot: "#1b1a17",
    cannon: "#1b1a17",
    shot: "#1b1a17",
    bomb: "#b3261e",
    glow: 0,
  },
} satisfies Record<string, InvadersPalette>;

export type AlienAttackSkin = keyof typeof SKINS;
