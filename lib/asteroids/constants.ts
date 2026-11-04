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
