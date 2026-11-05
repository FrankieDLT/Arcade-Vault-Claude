import type { ComponentType } from "react";
import { AsteroidsCanvas } from "@/components/asteroids-canvas";
import { TetrisCanvas } from "@/components/tetris-canvas";
import type { TetrisSkin, TetrisTheme } from "@/lib/tetris/constants";

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
  skin?: TetrisSkin;
  theme?: TetrisTheme;
}

export interface GameDefinition {
  Canvas: ComponentType<GameCanvasProps>;
  /** Controls hint under the CRT. */
  controls: { keys: string[]; label: string }[];
  /** HUD stats the engine reports. LIVES and LINES share one HUD slot. */
  stats: { lives: boolean; lines: boolean; level: boolean };
  /** Optional background track. Absent = no audio and no mute button. */
  music?: { src: string; volume: number };
  /** Optional SKIN / THEME buttons under the CRT. They only change what the canvas draws. */
  appearance?: { skins: { id: TetrisSkin; label: string }[]; themes: boolean };
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
    music: { src: "/game-assets/tetris/korobeiniki.mp3", volume: 0.2 },
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
};

export const getGameDefinition = (
  gameId: string,
): GameDefinition | undefined =>
  Object.hasOwn(GAME_REGISTRY, gameId) ? GAME_REGISTRY[gameId] : undefined;
