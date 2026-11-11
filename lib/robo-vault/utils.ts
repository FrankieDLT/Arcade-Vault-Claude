// Robo Vault helpers. Pure functions, no react or next imports.
import {
  DAMAGE,
  MASTERS,
  MAX_SCORE,
  TILE,
  type MasterId,
  type WeaponId,
} from "./constants";
import type { Progress } from "./password";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(MAX_SCORE, Math.floor(score)));
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

/** Damage of a weapon against a Master (`sam` has no weakness). */
export function weaponDamage(
  weapon: WeaponId,
  boss: MasterId | "sam" | null,
): number {
  if (weapon === "buster") return DAMAGE.buster;
  if (boss === null || boss === "sam") return DAMAGE.other;
  const info = MASTERS.find((m) => m.id === boss);
  return info && info.weakTo === weapon ? DAMAGE.weak : DAMAGE.other;
}

/** True when `weapon` is the weakness of `boss`. */
export function isWeakness(weapon: WeaponId, boss: MasterId | "sam"): boolean {
  return weaponDamage(weapon, boss) === DAMAGE.weak;
}

/** Stages cleared + 1 (1..9): Masters + castle rooms + Sam. */
export function levelOf(p: Progress): number {
  const masters = p.masters.filter(Boolean).length;
  return 1 + masters + p.castleRooms + (p.cleared ? 1 : 0);
}

export function isSolidChar(ch: string): boolean {
  return ch === "#" || ch === "I";
}

export function isHazardChar(ch: string): boolean {
  return ch === "^" || ch === "L";
}

/** Tile char at (col,row). Left and right of the map count as walls, above is air, below is a pit. */
export function tileAt(grid: string[][], col: number, row: number): string {
  if (row < 0) return ".";
  if (row >= grid.length) return ".";
  if (col < 0 || col >= grid[0].length) return "#";
  return grid[row][col];
}

export const tileCol = (x: number) => Math.floor(x / TILE);

/** Small seeded generator (mulberry32). Returns a function giving [0, 1). */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
