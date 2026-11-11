"use client";

import { withBasePath } from "@/lib/base-path";
import {
  H,
  SKINS,
  W,
  toSkin,
  type SkinColors,
} from "@/lib/dot-catcher/constants";
import { JavaEngineCanvas } from "@/components/java-engine-canvas";
import type { GameCanvasProps } from "@/components/game-registry";

// The engine is Java (java/dot-catcher/), compiled to this file by `npm run build:java`.
const SCRIPT = "/game-assets/dot-catcher/dot-catcher.js";

export function DotCatcherCanvas({
  paused,
  endSignal,
  onScore,
  onGameOver,
  onLives,
  onLevel,
  onSound,
  onHaptic,
  skin,
  levelRequest,
}: GameCanvasProps) {
  return (
    <JavaEngineCanvas<SkinColors>
      gameId="dot-catcher"
      src={withBasePath(SCRIPT)}
      width={W}
      height={H}
      className="dot-catcher-canvas"
      ariaLabel="Dot Catcher game field"
      palette={SKINS[toSkin(skin)]}
      paused={paused}
      endSignal={endSignal}
      onScore={onScore}
      onGameOver={onGameOver}
      onLives={onLives}
      onLevel={onLevel}
      onSound={onSound}
      onHaptic={onHaptic}
      levelRequest={levelRequest}
    />
  );
}
