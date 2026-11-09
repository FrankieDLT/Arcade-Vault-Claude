import { withBasePath } from "@/lib/base-path";
import type { ComponentType } from "react";
import { AsteroidsCanvas } from "@/components/asteroids-canvas";
import { ArkanoidCanvas } from "@/components/arkanoid-canvas";
import { GlowmawCanvas } from "@/components/glowmaw-canvas";
import { SnakeCanvas } from "@/components/snake-canvas";
import { TetrisCanvas } from "@/components/tetris-canvas";
import type { TetrisTheme } from "@/lib/tetris/constants";
import type { PadSlot } from "@/lib/gamepad";

/** Props every game canvas accepts; a canvas ignores the ones its engine does not have. */
export interface GameCanvasProps {
  paused: boolean;
  /** Increment to end the run immediately (0 = not requested). */
  endSignal: number;
  onScore: (score: number) => void;
  onGameOver: (finalScore: number) => void;
  onLives?: (lives: number) => void;
  onLevel?: (level: number) => void;
  onLines?: (lines: number) => void;
  /** Skin id from `appearance.skins`; each canvas narrows it with a guard and falls back to its default. */
  skin?: string;
  theme?: TetrisTheme;
  /** Sound events from the engine; the platform plays them. */
  onSound?: (sound: string) => void;
  /** Haptic events from the engine ("clear", "tetris", "split", "fruit", "bonus"); the platform vibrates. */
  onHaptic?: (name: string) => void;
  /** A change of `id` asks the engine to jump to `level` (level select in the PAUSED overlay). */
  levelRequest?: { level: number; id: number };
}

export interface TouchButton {
  /** KeyboardEvent.code the engine already reads, e.g. "ArrowLeft", "Space", "KeyS". */
  code: string;
  label: string;
  /** Key stays down while the finger is down (move, thrust, soft drop, slow fall). Taps fire down then up. */
  hold?: boolean;
  /** Where the active skin draws this control. */
  slot: PadSlot;
}

export interface GameDefinition {
  Canvas: ComponentType<GameCanvasProps>;
  /** Controls hint under the CRT. */
  controls: { keys: string[]; label: string }[];
  /** HUD stats the engine reports. LIVES and LINES share one HUD slot. */
  stats: { lives: boolean; lines: boolean; level: boolean };
  /** Label of the lines slot when `stats.lines` is on (default "Lines"). */
  linesLabel?: string;
  /** Optional background track. Absent = no audio and no mute button. */
  music?: { src: string; volume: number };
  /** Optional SKIN / THEME buttons under the CRT. They only change what the canvas draws. */
  appearance?: { skins: { id: string; label: string }[]; themes: boolean };
  /** Optional sound effects, played by the platform on engine `onSound` events. */
  sfx?: { sounds: Record<string, string>; volume: number };
  /** Optional level selector in the PAUSED overlay. */
  levelSelect?: { min: number; max: number };
  /** Optional touch controls (phones). The pad and the hint show below 768px only. */
  touch?: {
    pad?: TouchButton[];
    swipe?: boolean;
    /** Replaces `controls` in the hint under the CRT on viewports below 768px. */
    hint: { keys: string[]; label: string }[];
  };
}

// Games without an entry keep the fake simulation in GamePlayer.
export const GAME_REGISTRY: Record<string, GameDefinition> = {
  asteroids: {
    Canvas: AsteroidsCanvas,
    controls: [
      { keys: ["←", "→"], label: "ROTATE" },
      { keys: ["↑"], label: "THRUST" },
      { keys: ["SPACE"], label: "FIRE" },
    ],
    stats: { lives: true, lines: false, level: true },
    appearance: {
      skins: [
        { id: "retro", label: "RETRO" },
        { id: "neon", label: "NEON" },
        { id: "pastel", label: "PASTEL" },
        { id: "gothic", label: "GOTHIC" },
        { id: "negative", label: "NEGATIVE" },
        { id: "amber-crt", label: "AMBER CRT" },
        { id: "deep-sea", label: "DEEP SEA" },
      ],
      themes: false,
    },
    touch: {
      pad: [
        { code: "ArrowLeft", label: "◀", hold: true, slot: "left" },
        { code: "ArrowRight", label: "▶", hold: true, slot: "right" },
        { code: "ArrowUp", label: "▲", hold: true, slot: "up" },
        { code: "ArrowUp", label: "THRUST", hold: true, slot: "b" },
        { code: "Space", label: "FIRE", hold: true, slot: "a" },
      ],
      hint: [
        { keys: ["◀", "▶"], label: "ROTATE" },
        { keys: ["THRUST"], label: "HOLD TO FLY" },
        { keys: ["FIRE"], label: "SHOOT" },
      ],
    },
  },
  tetris: {
    Canvas: TetrisCanvas,
    controls: [
      { keys: ["←", "→"], label: "MOVE" },
      { keys: ["↑", "X"], label: "ROTATE" },
      { keys: ["↓"], label: "SOFT DROP" },
      { keys: ["SPACE"], label: "HARD DROP" },
      { keys: ["S"], label: "HOLD" },
      { keys: ["C"], label: "SLOW FALL" },
    ],
    stats: { lives: false, lines: true, level: true },
    music: {
      src: withBasePath("/game-assets/tetris/korobeiniki.mp3"),
      volume: 0.2,
    },
    appearance: {
      skins: [
        { id: "retro", label: "RETRO" },
        { id: "neon", label: "NEON" },
        { id: "pastel", label: "PASTEL" },
        { id: "gothic", label: "GOTHIC" },
        { id: "negative", label: "NEGATIVE" },
        { id: "woodshop", label: "WOODSHOP" },
        { id: "ice-cavern", label: "ICE CAVERN" },
        { id: "pixel", label: "PIXEL ART" },
      ],
      themes: true,
    },
    touch: {
      pad: [
        { code: "ArrowLeft", label: "◀", hold: true, slot: "left" },
        { code: "ArrowRight", label: "▶", hold: true, slot: "right" },
        { code: "ArrowDown", label: "▼", hold: true, slot: "down" },
        { code: "ArrowUp", label: "⟳", slot: "up" },
        { code: "ArrowUp", label: "⟳", slot: "a" },
        { code: "Space", label: "DROP", slot: "b" },
        { code: "KeyS", label: "HOLD", slot: "x" },
        { code: "KeyC", label: "SLOW", hold: true, slot: "y" },
      ],
      hint: [
        { keys: ["◀", "▶", "▼"], label: "MOVE" },
        { keys: ["⟳"], label: "ROTATE" },
        { keys: ["DROP"], label: "HARD DROP" },
      ],
    },
  },
  arkanoid: {
    Canvas: ArkanoidCanvas,
    controls: [
      { keys: ["←", "→"], label: "MOVE" },
      { keys: ["MOUSE"], label: "PADDLE" },
      { keys: ["SPACE", "CLICK"], label: "LAUNCH" },
    ],
    stats: { lives: true, lines: false, level: true },
    appearance: {
      skins: [
        { id: "retro", label: "RETRO" },
        { id: "pastel", label: "PASTEL" },
        { id: "neon", label: "NEON" },
      ],
      themes: false,
    },
    sfx: {
      sounds: {
        bounce: withBasePath("/game-assets/arkanoid/ball-bounce.mp3"),
        brick: withBasePath("/game-assets/arkanoid/break-sound.mp3"),
      },
      volume: 1,
    },
    levelSelect: { min: 1, max: 99 },
    touch: {
      hint: [
        { keys: ["DRAG"], label: "MOVE" },
        { keys: ["TAP"], label: "LAUNCH" },
      ],
    },
  },
  snake: {
    Canvas: SnakeCanvas,
    controls: [
      { keys: ["←", "↑", "→", "↓"], label: "STEER" },
      { keys: ["W", "A", "S", "D"], label: "STEER" },
    ],
    stats: { lives: false, lines: true, level: false },
    linesLabel: "Length",
    appearance: {
      skins: [
        { id: "retro", label: "RETRO" },
        { id: "neon", label: "NEON" },
        { id: "pastel", label: "PASTEL" },
        { id: "gothic", label: "GOTHIC" },
        { id: "negative", label: "NEGATIVE" },
        { id: "lcd-brick", label: "LCD BRICK" },
        { id: "magma", label: "MAGMA" },
      ],
      themes: false,
    },
    touch: {
      swipe: true,
      hint: [{ keys: ["SWIPE"], label: "STEER" }],
    },
  },
  glowmaw: {
    Canvas: GlowmawCanvas,
    controls: [
      { keys: ["←", "↑", "→", "↓"], label: "MOVE" },
      { keys: ["W", "A", "S", "D"], label: "MOVE" },
    ],
    stats: { lives: true, lines: false, level: true },
    appearance: {
      skins: [
        { id: "abyss", label: "ABYSS" },
        { id: "retro", label: "RETRO" },
        { id: "neon", label: "NEON" },
        { id: "pastel", label: "PASTEL" },
        { id: "gothic", label: "GOTHIC" },
        { id: "negative", label: "NEGATIVE" },
        { id: "coral", label: "CORAL" },
        { id: "sunken-ruin", label: "SUNKEN RUIN" },
        { id: "paper-lantern", label: "PAPER LANTERN" },
      ],
      themes: false,
    },
    levelSelect: { min: 1, max: 99 },
    touch: {
      pad: [
        { code: "ArrowLeft", label: "◀", slot: "left" },
        { code: "ArrowRight", label: "▶", slot: "right" },
        { code: "ArrowUp", label: "▲", slot: "up" },
        { code: "ArrowDown", label: "▼", slot: "down" },
      ],
      hint: [{ keys: ["◀", "▲", "▼", "▶"], label: "STEER" }],
    },
  },
};

export const getGameDefinition = (
  gameId: string,
): GameDefinition | undefined =>
  Object.hasOwn(GAME_REGISTRY, gameId) ? GAME_REGISTRY[gameId] : undefined;
