// Marcy the Vampire Hunter constants. Framework-free: no react or next imports.

export const W = 768;
export const H = 576;
export const TILE = 48;
export const VIEW_COLS = 16;
export const VIEW_ROWS = 12;

export const MAX_STEP = 8;
export const MAX_DT = 0.05;

export const START_LIVES = 3;
export const MAX_LIVES = 5;
export const EXTRA_LIFE_EVERY = 20_000;
export const MAX_SCORE = 10_000_000;

/** Level cap of the main castle, and the cap once Count Faust is defeated. */
export const MAX_LEVEL_MAIN = 50;
export const MAX_LEVEL = 63;
/** Equipment tier cap of the main castle, and the cap after Count Faust. */
export const MAX_TIER_MAIN = 10;
export const MAX_TIER = 15;

// Credit Coin (SPEC 23). The committed value is 0.001.
export const CREDIT_DROP_CHANCE = 0.001;
export const CREDIT_COIN_LIFETIME = 12;
export const CREDIT_COIN_BLINK = 3;

// Password: a 12x12 dot grid (144 bits). Own mask, permutation and CRC polynomial.
export const GRID_COLS = 12;
export const GRID_SIZE = 144;
export const PAYLOAD_BITS = 132;
export const CRC_BITS = 12;
/** x^12 + x^6 + x^4 + x + 1 (low 12 bits). */
export const CRC_POLY = 0x053;
/** 144 mask bits (36 hex digits, bit 0 = last digit's lowest bit). */
export const MASK_HEX = "b3a6d1f09c42e785a1d3706fb2c84e19d5a7";
/** Fixed bijection: word bit i sits on grid cell PERM[i] (53 is coprime to 144). */
export const PERM: number[] = Array.from({ length: GRID_SIZE }, (_, i) => (i * 53 + 17) % GRID_SIZE);
/** Mask as a bit array, MASK[i] = bit i of MASK_HEX. */
export const MASK: number[] = (() => {
  const out: number[] = new Array(GRID_SIZE).fill(0);
  for (let i = 0; i < GRID_SIZE; i++) {
    const digit = parseInt(MASK_HEX[MASK_HEX.length - 1 - (i >> 2)], 16);
    out[i] = (digit >> (i & 3)) & 1;
  }
  return out;
})();

// ---------------------------------------------------------------- physics (px, seconds)
export const GRAVITY = 1900;
export const RUN_SPEED = 230;
export const JUMP_V = -700;
export const JUMP_CUT_V = -280;
export const MAX_FALL = 900;
export const HERO_W = 30;
export const HERO_H = 60;
export const CROUCH_H = 39;
export const DASH_SPEED = 560;
export const DASH_TIME = 0.3;
export const DASH_COOLDOWN = 0.55;
export const DASH_H = 36;
export const GLIDE_FALL = 70;
export const MIST_TIME = 2;
export const HURT_INVULN = 1.1;
export const MP_REGEN = 1.6;

// ---------------------------------------------------------------- zones
export interface ZonePalette {
  bg: string;
  bg2: string;
  brick: string;
  brickLt: string;
  accent: string;
  glow: string;
}

export const ZONE_NAMES = [
  "Gate Court",
  "Chapel of Ash",
  "Catacombs",
  "Flooded Cellars",
  "Clockwork Tower",
  "Library of Whispers",
  "Garden of Thorns",
  "Bell Spire",
  "Blood Cistern",
  "Faust's Keep",
] as const;

export const ZONE_PALETTES: ZonePalette[] = [
  { bg: "#120d1c", bg2: "#1b1430", brick: "#4a4560", brickLt: "#6c6688", accent: "#c9a45c", glow: "#f5b13a" },
  { bg: "#1a0f0c", bg2: "#2a1812", brick: "#5c4a42", brickLt: "#806a5e", accent: "#e07a3a", glow: "#ffb066" },
  { bg: "#14130f", bg2: "#211f18", brick: "#6b6552", brickLt: "#948c72", accent: "#d8cfa8", glow: "#f2ead0" },
  { bg: "#07131a", bg2: "#0d2230", brick: "#2f4f5e", brickLt: "#4f7a8c", accent: "#52c8d8", glow: "#8ff0ff" },
  { bg: "#17120a", bg2: "#2a2010", brick: "#6a5426", brickLt: "#9a7e3c", accent: "#d9a441", glow: "#ffd36a" },
  { bg: "#140c16", bg2: "#241428", brick: "#5a3a52", brickLt: "#80587a", accent: "#b88ae0", glow: "#d8b0ff" },
  { bg: "#0a160d", bg2: "#122a18", brick: "#2f5a3a", brickLt: "#4c8a5a", accent: "#e0508a", glow: "#ff8ab8" },
  { bg: "#0e1018", bg2: "#1a1e30", brick: "#4a5270", brickLt: "#6c78a0", accent: "#9ab0e8", glow: "#cfe0ff" },
  { bg: "#1c0610", bg2: "#340a1c", brick: "#6a1c34", brickLt: "#9a2c4c", accent: "#ff3b5c", glow: "#ff8aa0" },
  { bg: "#0b0612", bg2: "#180c26", brick: "#3a2a58", brickLt: "#5c468a", accent: "#ff006e", glow: "#ff6aa8" },
];

/** Hue-inverted color (180 degree hue rotation): same lightness and saturation, opposite tint. */
function invertHex(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const sum = Math.max(r, g, b) + Math.min(r, g, b);
  return `#${[r, g, b].map((v) => (sum - v).toString(16).padStart(2, "0")).join("")}`;
}

/** Turned zone palettes: inverted counterparts of main zone palettes 2..9 and the keep (index 8 = arena). */
export const TURNED_PALETTES: ZonePalette[] = ZONE_PALETTES.slice(1).map((p) => ({
  bg: invertHex(p.bg),
  bg2: invertHex(p.bg2),
  brick: invertHex(p.brick),
  brickLt: invertHex(p.brickLt),
  accent: p.accent,
  glow: p.glow,
}));

export const TURNED_NAMES = [
  "Sunken Chapel",
  "Ossuary Sky",
  "Rising Cellars",
  "Clockwork Abyss",
  "Silent Library",
  "Gravewood Garden",
  "Deep Spire",
  "Crimson Zenith",
  "Hollow Throne",
] as const;

export const RELIC_INFO: Record<string, { name: string; text: string }> = {
  dash: { name: "DASH", text: "Short dash that passes low gaps" },
  leap: { name: "LEAP", text: "Double jump: Space again in the air" },
  lantern: { name: "LANTERN", text: "Lights dark rooms, reveals hidden doors" },
  mist: { name: "MIST", text: "Down + dash: mist form passes grates" },
  glide: { name: "GLIDE", text: "Hold Space while falling to glide" },
  sigil: { name: "SIGIL", text: "Attacks break sigil walls" },
};

export const HERO_INFO = {
  marcy: {
    name: "MARCY DELRRE",
    weapon: "WHIP",
    reach: 144,
    str: 7,
    def: 4,
    int: 8,
    lck: 8,
    special: "CRIMSON LASH",
    specialMp: 8,
    attackTime: 0.34,
  },
  frankford: {
    name: "FRANKFORD DELRRE",
    weapon: "SWORD",
    reach: 72,
    str: 9,
    def: 6,
    int: 4,
    lck: 5,
    special: "MOON SLASH",
    specialMp: 6,
    attackTime: 0.2,
  },
} as const;
