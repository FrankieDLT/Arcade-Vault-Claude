/**
 * Haptic feedback through `navigator.vibrate`. Framework-free: no react or next imports, no storage.
 * The platform decides when to call `haptic()`; engines only report event names.
 * `navigator.vibrate` does not exist on iOS Safari, where every call is a no-op.
 */

export type HapticKind =
  | "tap"
  | "gameover"
  | "brick"
  | "clear"
  | "tetris"
  | "split"
  | "fruit"
  | "bonus"
  | "pearl"
  | "death";

/** Vibration patterns in ms (a number = one pulse; an array alternates vibrate / pause). */
export const HAPTIC_PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 10,
  gameover: [40, 60, 120],
  brick: 15,
  clear: 25,
  tetris: [30, 40, 60],
  split: 20,
  fruit: 15,
  bonus: [20, 30, 40],
  pearl: 20,
  death: [30, 40, 30],
};

/** True when the browser can vibrate. Safe on the server (returns false). */
export function canVibrate(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Vibrates with the pattern of `kind`. Does nothing without `navigator.vibrate` or with reduced motion; never throws. */
export function haptic(kind: HapticKind): void {
  try {
    if (!canVibrate() || prefersReducedMotion()) return;
    const pattern = HAPTIC_PATTERNS[kind];
    if (pattern === undefined) return;
    navigator.vibrate(pattern);
  } catch {
    // A browser may refuse vibration (no user gesture yet, permissions policy): ignore.
  }
}
