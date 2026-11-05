import { withBasePath } from "@/lib/base-path";
import type { ComponentType } from "react";
import { AsteroidsCanvas } from "@/components/asteroids-canvas";
import { ArkanoidCanvas } from "@/components/arkanoid-canvas";
import { SnakeCanvas } from "@/components/snake-canvas";
import { TetrisCanvas } from "@/components/tetris-canvas";
import type { TetrisTheme } from "@/lib/tetris/constants";

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
  /** A change of `id` asks the engine to jump to `level` (level select in the PAUSED overlay). */
  levelRequest?: { level: number; id: number };
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
    music: { src: withBasePath("/game-assets/tetris/korobeiniki.mp3"), volume: 0.2 },
    appearance: {
      skins: [
        { id: "retro", label: "RETRO" },
        { id: "neon", label: "NEON" },
        { id: "pastel", label: "PASTEL" },
        { id: "pixel", label: "PIXEL ART" },
      ],
      themes: true,
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
      ],
      themes: false,
    },
  },
};

export const getGameDefinition = (
  gameId: string,
): GameDefinition | undefined =>
  Object.hasOwn(GAME_REGISTRY, gameId) ? GAME_REGISTRY[gameId] : undefined;
