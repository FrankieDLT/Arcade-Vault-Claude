import {
  HIT_RADIUS,
  KIND_SPEED,
  MAX_ROUND,
  MAX_SCORE,
  TOUCH_HIT_BONUS,
  type TargetKind,
} from "./constants";

export const clampScore = (n: number): number =>
  Math.max(0, Math.min(MAX_SCORE, Math.round(n)));

export const clampRound = (n: number): number =>
  Math.max(1, Math.min(MAX_ROUND, Math.floor(n)));

/** Hits needed to clear a round: 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, ... */
export function quota(round: number): number {
  return Math.min(10, 6 + Math.floor((round - 1) / 2));
}

/** 1 target per wave in rounds 1 and 2, 2 from round 3. */
export function targetsPerWave(round: number): 1 | 2 {
  return round >= 3 ? 2 : 1;
}

/** px/s: base `min(420, 160 + 20 * (round - 1))` times the kind multiplier. */
export function targetSpeed(round: number, kind: TargetKind): number {
  return Math.min(420, 160 + 20 * (round - 1)) * KIND_SPEED[kind];
}

/** Seconds a target stays on screen before it escapes. */
export function flightTime(round: number): number {
  return Math.max(3.5, 6 - 0.3 * (round - 1));
}

/** Chance of each quota target kind. `decoy` is spawned apart (see `decoyInWave`). */
export function kindWeights(round: number): Record<TargetKind, number> {
  const quick = round >= 3 ? 0.2 : 0;
  const rare = round >= 2 ? 0.05 : 0;
  return { common: 1 - quick - rare, quick, rare, decoy: 0 };
}

export function pickKind(
  round: number,
  roll: number,
): Exclude<TargetKind, "decoy"> {
  const w = kindWeights(round);
  if (roll < w.rare) return "rare";
  if (roll < w.rare + w.quick) return "quick";
  return "common";
}

/** From round 4, one decoy in 1 of every 3 waves. */
export function decoyInWave(round: number, roll: number): boolean {
  return round >= 4 && roll < 1 / 3;
}

export function hitRadius(pointerType: string): number {
  return pointerType === "mouse" || pointerType === ""
    ? HIT_RADIUS
    : HIT_RADIUS + TOUCH_HIT_BONUS;
}

export const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);
