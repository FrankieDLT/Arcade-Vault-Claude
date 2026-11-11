// Marcy the Vampire Hunter helpers. Pure functions, no react or next imports.
import {
  CREDIT_DROP_CHANCE,
  HERO_INFO,
  MAX_LEVEL,
  MAX_LEVEL_MAIN,
  MAX_SCORE,
  TILE,
} from "./constants";
import { tierBonus } from "./items";
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
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** XP needed to go from `level` to `level + 1`. Steeper above level 50. */
export function xpToNext(level: number): number {
  const l = Math.max(1, level);
  const base = 30 + 18 * l + 1.5 * l * l;
  return Math.round(l > MAX_LEVEL_MAIN ? base * (1.6 + (l - MAX_LEVEL_MAIN) * 0.12) : base);
}

export interface Stats {
  maxHp: number;
  maxMp: number;
  str: number;
  def: number;
  int: number;
  lck: number;
  /** Attack power per hit. */
  atk: number;
}

export function computeStats(p: Progress): Stats {
  const h = HERO_INFO[p.hero];
  const lvl = Math.min(MAX_LEVEL, Math.max(1, p.level));
  const crests = p.crests.filter(Boolean).length + p.turned.crests.filter(Boolean).length;
  const eq = p.equipment;
  const str = h.str + Math.floor(lvl * 1.2) + tierBonus(eq.weapon) * 3;
  const def = h.def + Math.floor(lvl * 0.8) + (tierBonus(eq.head) + tierBonus(eq.body) + tierBonus(eq.cloak)) * 2;
  const int = h.int + lvl + tierBonus(eq.ring);
  const lck = h.lck + Math.floor(lvl * 0.5) + tierBonus(eq.ring);
  return {
    maxHp: 80 + lvl * 10 + crests * 20 + tierBonus(eq.body) * 4,
    maxMp: 24 + lvl * 2 + Math.floor(int / 2),
    str,
    def,
    int,
    lck,
    atk: str + 4,
  };
}

/** Damage dealt: attack scaled by 100 / (100 + defense), at least 1. */
export function damage(attack: number, defense: number): number {
  return Math.max(1, Math.round((attack * 100) / (100 + Math.max(0, defense))));
}

/** True with probability CREDIT_DROP_CHANCE. One roll per drop opportunity (SPEC 23). */
export function rollCreditDrop(random: () => number = Math.random): boolean {
  return random() < CREDIT_DROP_CHANCE;
}

/** Tile char at (col,row). Beyond the sides is wall, above and below is open. */
export function tileAt(grid: string[], col: number, row: number): string {
  if (row < 0 || row >= grid.length) return " ";
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

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
