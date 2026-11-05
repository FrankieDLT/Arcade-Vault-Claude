// Playfield size in game coordinates. The canvas is scaled by CSS, never resized.
export const W = 800;
export const H = 600;

// Indexed by asteroid size 1, 2, 3 (index 0 unused).
export const RADII = [0, 16, 30, 50] as const;
export const SPEEDS = [0, 85, 55, 32] as const; // base speed per size
export const POINTS = [0, 100, 50, 20] as const; // points per size

export const POWERUP_CHANCE = 0.1; // chance that a destroyed asteroid drops a power-up
export const HYPER_DURATION = 10; // seconds
export const SHIELD_DURATION = 5; // seconds
export const SLOW_DURATION = 5; // seconds
export const SLOW_FACTOR = 0.5; // asteroid speed multiplier while SlowMo is active
export const TRIPLE_DURATION = 10; // seconds
export const SPREAD = Math.PI / 6; // 30° between the bullets of the triple shot

export type PowerUpType = "bomb" | "hyper" | "shield" | "slow" | "triple";

export interface PowerUpSpec {
  label: string;
  color: string | null; // null = rainbow
  weight: number; // relative weight in the drop roll
  ttl: number; // seconds on screen
  radius: number;
  font: number;
}

export const POWERUP_TYPES: Record<PowerUpType, PowerUpSpec> = {
  bomb: { label: "B", color: "#ff0", weight: 1, ttl: 8, radius: 12, font: 16 },
  hyper: { label: "H", color: null, weight: 1, ttl: 12, radius: 12, font: 22 },
  shield: { label: "SH", color: "#4ff", weight: 3, ttl: 10, radius: 12, font: 11 },
  slow: { label: "SM", color: "#fff", weight: 3, ttl: 8, radius: 14, font: 12 },
  triple: { label: "3", color: "#0ff", weight: 3, ttl: 12, radius: 14, font: 18 },
};

export interface SkinPalette {
  bg: string;
  rock: string;
  ship: string;
  bullet: string;
  shield: string;
  flame: string;
  /** "r,g,b" of the explosion sparks. */
  particle: string;
  /** "r,g,b" of the bomb flash. */
  flash: string;
  /** Glow radius (shadowBlur) for ship, rocks, bullets and power-ups; 0 = none. */
  glow: number;
  /** Saturation / lightness (%) of the HyperMode rainbow. */
  rainbowS: number;
  rainbowL: number;
  /** Power-up ring and label colors; null = rainbow. */
  powerUp: Record<PowerUpType, string | null>;
  /** Canvas timer texts (HyperMode uses the rainbow). */
  tripleText: string;
  slowText: string;
}

// Visual palettes only; gameplay never reads them.
export const SKINS = {
  retro: {
    bg: "#000000", rock: "#ffffff", ship: "#ffffff", bullet: "#ffffff", shield: "#44ffff",
    flame: "rgba(255, 130, 0, 0.85)", particle: "255,255,255", flash: "255,255,255",
    glow: 0, rainbowS: 100, rainbowL: 60,
    powerUp: { bomb: "#ffff00", hyper: null, shield: "#44ffff", slow: "#ffffff", triple: "#00ffff" },
    tripleText: "#00ffff", slowText: "#ffffff",
  },
  neon: {
    bg: "#05020f", rock: "#00f5ff", ship: "#00ff88", bullet: "#f5ff00", shield: "#ff006e",
    flame: "rgba(245, 255, 0, 0.9)", particle: "255,0,110", flash: "0,245,255",
    glow: 12, rainbowS: 100, rainbowL: 70,
    powerUp: { bomb: "#ff006e", hyper: null, shield: "#00f5ff", slow: "#f5ff00", triple: "#00ff88" },
    tripleText: "#00ff88", slowText: "#f5ff00",
  },
  pastel: {
    bg: "#2b2a40", rock: "#bde0fe", ship: "#ffc8dd", bullet: "#fff1c1", shield: "#b9fbc0",
    flame: "rgba(255, 214, 165, 0.9)", particle: "255,200,221", flash: "255,241,193",
    glow: 0, rainbowS: 70, rainbowL: 78,
    powerUp: { bomb: "#ffd6a5", hyper: null, shield: "#b9fbc0", slow: "#e4c1f9", triple: "#a0e7e5" },
    tripleText: "#a0e7e5", slowText: "#e4c1f9",
  },
  gothic: {
    bg: "#0a0709", rock: "#a7a9b4", ship: "#efe6d0", bullet: "#ff3b4e", shield: "#b36bf0",
    flame: "rgba(224, 30, 55, 0.9)", particle: "167,169,180", flash: "224,30,55",
    glow: 0, rainbowS: 55, rainbowL: 68,
    powerUp: { bomb: "#ff3b4e", hyper: null, shield: "#b36bf0", slow: "#a7a9b4", triple: "#efe6d0" },
    tripleText: "#b36bf0", slowText: "#a7a9b4",
  },
  "amber-crt": {
    bg: "#120a00", rock: "#ffb000", ship: "#ffd36b", bullet: "#ff7a1a", shield: "#c98a2b",
    flame: "rgba(255, 122, 26, 0.9)", particle: "255,176,0", flash: "255,176,0",
    glow: 6, rainbowS: 100, rainbowL: 78,
    powerUp: { bomb: "#ff7a1a", hyper: null, shield: "#c98a2b", slow: "#ffd36b", triple: "#ffb000" },
    tripleText: "#ffb000", slowText: "#ffd36b",
  },
  "deep-sea": {
    bg: "#03141f", rock: "#5ff2e0", ship: "#8fd3ff", bullet: "#ffd166", shield: "#ff7b72",
    flame: "rgba(255, 209, 102, 0.9)", particle: "95,242,224", flash: "143,211,255",
    glow: 4, rainbowS: 90, rainbowL: 78,
    powerUp: { bomb: "#ffd166", hyper: null, shield: "#ff7b72", slow: "#8fd3ff", triple: "#5ff2e0" },
    tripleText: "#5ff2e0", slowText: "#8fd3ff",
  },
  // Computed inverse of retro (each RGB channel = 255 - channel), still readable on white.
  negative: {
    bg: "#ffffff", rock: "#000000", ship: "#000000", bullet: "#000000", shield: "#bb0000",
    flame: "rgba(0, 125, 255, 0.85)", particle: "0,0,0", flash: "0,0,0",
    glow: 0, rainbowS: 100, rainbowL: 22,
    powerUp: { bomb: "#0000ff", hyper: null, shield: "#bb0000", slow: "#000000", triple: "#cc0000" },
    tripleText: "#cc0000", slowText: "#000000",
  },
} as const satisfies Record<string, SkinPalette>;

export type AsteroidsSkin = keyof typeof SKINS;

// Insertion order matters: the weighted drop roll walks this list.
export const POWERUP_KEYS = Object.keys(POWERUP_TYPES) as PowerUpType[];

// Big-asteroid outline traced from the reference art, centered and normalized
// so the farthest vertex has radius 1.
export const BIG_VARIANT: ReadonlyArray<readonly [number, number]> = (() => {
  const pts: Array<[number, number]> = [
    [188, 63], [265, 87], [251, 171], [331, 195], [308, 282],
    [238, 279], [205, 335], [107, 288], [62, 206], [83, 119],
  ];
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const max = Math.max(...pts.map((p) => Math.hypot(p[0] - cx, p[1] - cy)));
  return pts.map(([x, y]): readonly [number, number] => [(x - cx) / max, (y - cy) / max]);
})();
