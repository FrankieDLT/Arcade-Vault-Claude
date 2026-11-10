import {
  BEAM_RAMP,
  BEAM_SPREAD,
  BEAM_TOP_HALF,
  BREATH_AMP,
  BREATH_PERIOD,
  CHALLENGE_EVERY,
  CHALLENGE_FIRST,
  ENEMY_H,
  ENEMY_W,
  H,
  MAX_SCORE,
  PARAMS_CAP_STAGE,
  PITCH_X,
  PITCH_Y,
  PLAYER_Y,
  SCORES,
  SLOT_X0,
  SLOT_Y0,
  STAR_COUNT,
  SWAY_AMP,
  SWAY_PERIOD,
  W,
} from "./constants";
import type { Beam, Enemy, Rect, Star } from "./entities";

export const clampScore = (score: number): number =>
  Math.max(0, Math.min(MAX_SCORE, Math.floor(score)));

export interface StageParams {
  diveInterval: number; // seconds between dive attempts
  maxDivers: number;
  shotSpeed: number; // px/s
  maxShots: number; // enemy shots on screen
  diveSpeedFactor: number;
  shootDuringEntry: boolean;
}

/** Difficulty for a stage; it stops growing at stage 31. */
export function stageParams(stage: number): StageParams {
  const n = Math.max(1, Math.min(PARAMS_CAP_STAGE, Math.floor(stage))) - 1;
  return {
    diveInterval: Math.max(0.8, 2.6 - 0.15 * n),
    maxDivers: Math.min(6, 2 + Math.floor(n / 2)),
    shotSpeed: Math.min(380, 220 + 12 * n),
    maxShots: Math.min(6, 3 + Math.floor(n / 4)),
    diveSpeedFactor: Math.min(1.6, 1 + 0.03 * n),
    shootDuringEntry: stage >= 4,
  };
}

/** Stages 3, 7, 11, ... */
export const isChallengingStage = (stage: number): boolean =>
  stage >= CHALLENGE_FIRST && (stage - CHALLENGE_FIRST) % CHALLENGE_EVERY === 0;

/** Slot center for the current sway and breathing (`breath` is the pitch scale, 1 = rest). */
export function slotPosition(
  col: number,
  row: number,
  swayT: number,
  breath: number,
): { x: number; y: number } {
  const cx = SLOT_X0 + ((10 - 1) * PITCH_X) / 2;
  const cy = SLOT_Y0 + (2 * PITCH_Y);
  const bx = SLOT_X0 + col * PITCH_X;
  const by = SLOT_Y0 + row * PITCH_Y;
  const sway = SWAY_AMP * Math.sin((2 * Math.PI * swayT) / SWAY_PERIOD);
  return { x: cx + (bx - cx) * breath + sway, y: cy + (by - cy) * breath };
}

/** Pitch scale of the formation: 1 at rest, +-BREATH_AMP when fully breathing (`amp` 0..1). */
export const breathScale = (swayT: number, amp: number): number =>
  1 + BREATH_AMP * amp * Math.sin((2 * Math.PI * swayT) / BREATH_PERIOD);

export const bossComboPoints = (escorts: number): number =>
  escorts >= 2
    ? SCORES.boss.diveEscort2
    : escorts === 1
      ? SCORES.boss.diveEscort1
      : SCORES.boss.dive;

/** Stage badge values, largest first (50, 30, 20, 10, 5, 1), capped so they fit the corner. */
export function badgesFor(stage: number): number[] {
  const out: number[] = [];
  let left = Math.max(1, Math.floor(stage));
  for (const v of [50, 30, 20, 10, 5, 1]) {
    while (left >= v) {
      out.push(v);
      left -= v;
    }
  }
  return out.slice(0, 8);
}

export const rectsOverlap = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const enemyRect = (e: Enemy): Rect => ({
  x: e.x - ENEMY_W / 2,
  y: e.y - ENEMY_H / 2,
  w: ENEMY_W,
  h: ENEMY_H,
});

/** Cone of the tractor beam for its current length: apex under the Boss, widening downward. */
export function beamGeometry(beam: Beam): { y0: number; y1: number; hw0: number; hw1: number } {
  const y0 = beam.y + 14;
  const full = PLAYER_Y + 22 - y0;
  const y1 = y0 + full * Math.min(1, beam.t / BEAM_RAMP);
  return {
    y0,
    y1,
    hw0: BEAM_TOP_HALF,
    hw1: BEAM_TOP_HALF + (y1 - y0) * BEAM_SPREAD,
  };
}

/** True when column `x` (at the fighter row) is inside a beam that has reached full length. */
export function inBeam(x: number, beam: Beam): boolean {
  if (beam.t < BEAM_RAMP) return false;
  const g = beamGeometry(beam);
  const half = BEAM_TOP_HALF + (PLAYER_Y - g.y0) * BEAM_SPREAD;
  return Math.abs(x - beam.x) <= half;
}

export function createStars(): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      speed: 20 + Math.random() * 70,
      phase: Math.random() * Math.PI * 2,
    });
  }
  return stars;
}
