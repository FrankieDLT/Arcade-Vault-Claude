// Robo Vault constants. Framework-free: no react or next imports.

export const W = 768;
export const H = 576;
export const TILE = 48;
export const VIEW_COLS = 16;
export const VIEW_ROWS = 12;

// Physics (px, seconds). Max jump ~152 px (3 tiles), run-jump gap ~3.9 tiles.
export const GRAVITY = 1800;
export const RUN_SPEED = 220;
export const JUMP_V = -740;
export const JUMP_CUT_V = -300; // vy is clamped to this when jump is released early
export const MAX_FALL = 900;
export const HERO_W = 30;
export const HERO_H = 42;
export const HERO_HP = 14;
/** Hitbox height while crouching (9 sprite rows x 3). */
export const CROUCH_H = 27;
export const MAX_STEP = 8;
export const MAX_DT = 0.05;

export const START_LIVES = 3;
export const MAX_LIVES = 5;
export const EXTRA_LIFE_EVERY = 20_000;
export const MAX_SCORE = 10_000_000;

export const BOSS_HP = 20;
export const BOSS_HP_REMATCH = 10;
export const SAM_HP = 30;
export const WEAPON_ENERGY = 28;

/** Each defeated Master makes the hero take this fraction less damage (stacks). */
export const DAMAGE_REDUCTION_PER_MASTER = 0.1;

export const DAMAGE = { buster: 1, other: 2, weak: 5 } as const;

export const SCORES = {
  enemy: 100,
  master: 2000,
  castleRoom: 1500,
  sam: 10_000,
  weaknessBonus: 1.5,
} as const;

export type WeaponId = "buster" | "frost" | "ember" | "gale" | "tide";
export type MasterId = "frostbyte" | "embercore" | "galeforce" | "tidebreaker";
export type StageId =
  | MasterId
  | "castle1"
  | "castle2"
  | "castle3"
  | "sam";

export interface MasterInfo {
  id: MasterId;
  name: string;
  weapon: Exclude<WeaponId, "buster">;
  /** The weapon that does 5 damage to this Master. */
  weakTo: Exclude<WeaponId, "buster">;
}

/** Index in this array = bit index in the password. Weakness cycle: frost > ember > gale > tide > frost. */
export const MASTERS: readonly MasterInfo[] = [
  { id: "frostbyte", name: "FROSTBYTE", weapon: "frost", weakTo: "tide" },
  { id: "embercore", name: "EMBERCORE", weapon: "ember", weakTo: "frost" },
  { id: "galeforce", name: "GALEFORCE", weapon: "gale", weakTo: "ember" },
  { id: "tidebreaker", name: "TIDEBREAKER", weapon: "tide", weakTo: "gale" },
];

export interface WeaponInfo {
  name: string;
  cost: number;
  color: string;
}

export const WEAPONS: Record<WeaponId, WeaponInfo> = {
  buster: { name: "BUSTER", cost: 0, color: "#f5ff00" },
  frost: { name: "FROST SHARD", cost: 1, color: "#9fe8ff" },
  ember: { name: "EMBER ORB", cost: 1, color: "#ff8a2a" },
  gale: { name: "GALE CUTTER", cost: 1, color: "#b8ff9a" },
  tide: { name: "TIDE BURST", cost: 2, color: "#3aa0ff" },
};

export const WEAPON_ORDER: readonly WeaponId[] = [
  "buster",
  "frost",
  "ember",
  "gale",
  "tide",
];

// Skins are CSS filters on the finished canvas (same idea as the Arkanoid sheet).
export type RoboVaultSkinId =
  | "retro"
  | "neon"
  | "pastel"
  | "gothic"
  | "negative"
  | "lcd-handheld"
  | "sepia-reel";

export interface RoboVaultSkin {
  /** CSS filter string applied to the canvas element ("none" = original art). */
  filter: string;
}

export const DEFAULT_SKIN: RoboVaultSkinId = "retro";

export const SKINS: Record<RoboVaultSkinId, RoboVaultSkin> = {
  retro: { filter: "none" },
  neon: { filter: "saturate(1.8) contrast(1.15) brightness(1.05)" },
  pastel: { filter: "saturate(0.55) brightness(1.2) contrast(0.85)" },
  gothic: {
    filter:
      "sepia(0.5) hue-rotate(310deg) saturate(1.1) contrast(1.2) brightness(0.9)",
  },
  negative: {
    filter:
      "invert(1) hue-rotate(200deg) contrast(1.4) saturate(1.2) brightness(0.85)",
  },
  "lcd-handheld": {
    filter:
      "grayscale(1) sepia(1) hue-rotate(40deg) saturate(1.6) contrast(1.1)",
  },
  "sepia-reel": { filter: "sepia(1) contrast(1.1) brightness(0.95)" },
};

export interface Palette {
  skyTop: string;
  skyBottom: string;
  far: string; // distant silhouette rects
  tileTop: string;
  tile: string;
  tileDark: string;
  hazard: string;
  accent: string; // enemy tint
  accent2: string;
}

export const PALETTES: Record<StageId, Palette> = {
  frostbyte: {
    skyTop: "#0a1830",
    skyBottom: "#1d4466",
    far: "#14304e",
    tileTop: "#e8fbff",
    tile: "#6fb4d8",
    tileDark: "#2f6f99",
    hazard: "#d8f6ff",
    accent: "#58c8f0",
    accent2: "#ffffff",
  },
  embercore: {
    skyTop: "#1c0806",
    skyBottom: "#5a1a08",
    far: "#33100a",
    tileTop: "#ffb04a",
    tile: "#8a3a1c",
    tileDark: "#4a1a0c",
    hazard: "#ff5a1a",
    accent: "#ff7a2a",
    accent2: "#ffd24a",
  },
  galeforce: {
    skyTop: "#2a6fc4",
    skyBottom: "#a8dcff",
    far: "#6fa8e0",
    tileTop: "#f2fff0",
    tile: "#8fd0a0",
    tileDark: "#4a9a68",
    hazard: "#ffffff",
    accent: "#7ee08a",
    accent2: "#f2fff0",
  },
  tidebreaker: {
    skyTop: "#04162a",
    skyBottom: "#0b3a52",
    far: "#08283e",
    tileTop: "#5ad0c0",
    tile: "#1f6a78",
    tileDark: "#0e3a48",
    hazard: "#c8f060",
    accent: "#3aa0ff",
    accent2: "#9fe8ff",
  },
  castle1: {
    skyTop: "#10061c",
    skyBottom: "#2a0f3a",
    far: "#1c0c2a",
    tileTop: "#c08aff",
    tile: "#5a3a80",
    tileDark: "#2c1a44",
    hazard: "#ff3b6b",
    accent: "#ff3b6b",
    accent2: "#ffd24a",
  },
  castle2: {
    skyTop: "#0a0a14",
    skyBottom: "#1c1c34",
    far: "#12122a",
    tileTop: "#8a9ad0",
    tile: "#3a4468",
    tileDark: "#1c2240",
    hazard: "#ff3b6b",
    accent: "#8a9ad0",
    accent2: "#ffffff",
  },
  castle3: {
    skyTop: "#140808",
    skyBottom: "#341216",
    far: "#240c10",
    tileTop: "#d0a0a0",
    tile: "#6a3a44",
    tileDark: "#341a22",
    hazard: "#ff3b6b",
    accent: "#ff5a5a",
    accent2: "#ffd24a",
  },
  sam: {
    skyTop: "#0c0414",
    skyBottom: "#2a0a2e",
    far: "#1a0820",
    tileTop: "#ff6ad0",
    tile: "#5a2a64",
    tileDark: "#2a1232",
    hazard: "#ff3b6b",
    accent: "#ff6ad0",
    accent2: "#f5ff00",
  },
};

// Password scrambling (own values). MASK is XORed onto the 25-bit word; bit i of the
// result is stored in cell PERM[i] (7*i mod 25, a permutation of 0..24).
export const MASK = 0x0b5a6d3;
export const PERM: readonly number[] = [
  0, 7, 14, 21, 3, 10, 17, 24, 6, 13, 20, 2, 9, 16, 23, 5, 12, 19, 1, 8, 15,
  22, 4, 11, 18,
];
/** One non-zero 6-bit value per payload bit; the checksum is the XOR of the set bits' values. */
export const CHECK_COLS: readonly number[] = [
  0x2d, 0x1b, 0x36, 0x0f, 0x1e, 0x3c, 0x29, 0x13, 0x26, 0x0d, 0x1a, 0x34, 0x25,
  0x0b, 0x16, 0x2c, 0x19, 0x32, 0x07,
];
