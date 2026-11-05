"use client";

import { useEffect, useRef } from "react";
import {
  TetrisEngine,
  type TetrisSkin,
  type TetrisTheme,
} from "@/lib/tetris/engine";
import { H, SKIN_COLORS, W } from "@/lib/tetris/constants";

interface TetrisCanvasProps {
  paused: boolean;
  /** Increment to end the run immediately (0 = not requested). */
  endSignal: number;
  onScore: (score: number) => void;
  onLines?: (lines: number) => void;
  onLevel?: (level: number) => void;
  onGameOver: (finalScore: number) => void;
  /** Haptic events from the engine ("clear", "tetris"); the platform vibrates. */
  onHaptic?: (name: string) => void;
  /** Block style id; unknown ids are ignored. Later changes apply live, without restarting the run. */
  skin?: string;
  /** Canvas colors; later changes apply live, without restarting the run. */
  theme?: TetrisTheme;
}

const toSkin = (skin: string | undefined): TetrisSkin | undefined =>
  skin !== undefined && Object.hasOwn(SKIN_COLORS, skin)
    ? (skin as TetrisSkin)
    : undefined;

export function TetrisCanvas({
  paused,
  endSignal,
  onScore,
  onLines,
  onLevel,
  onGameOver,
  onHaptic,
  skin,
  theme,
}: TetrisCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<TetrisEngine | null>(null);
  // Latest callbacks and appearance, so the engine is created once and never rebuilt on re-render.
  const callbacksRef = useRef({
    onScore,
    onLines,
    onLevel,
    onGameOver,
    onHaptic,
  });
  const appearanceRef = useRef({ skin: toSkin(skin), theme });

  useEffect(() => {
    callbacksRef.current = { onScore, onLines, onLevel, onGameOver, onHaptic };
    appearanceRef.current = { skin: toSkin(skin), theme };
  });

  // Create, start and destroy the engine. Strict Mode runs this twice in dev
  // (mount, cleanup, mount): the cleanup destroys the first engine completely.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new TetrisEngine(
      canvas,
      {
        onScore: (s) => callbacksRef.current.onScore(s),
        onLines: (l) => callbacksRef.current.onLines?.(l),
        onLevel: (l) => callbacksRef.current.onLevel?.(l),
        onGameOver: (s) => callbacksRef.current.onGameOver(s),
        onHaptic: (n) => callbacksRef.current.onHaptic?.(n),
      },
      appearanceRef.current,
    );
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (paused) engine.pause();
    else engine.resume();
  }, [paused]);

  useEffect(() => {
    if (endSignal > 0) engineRef.current?.end();
  }, [endSignal]);

  useEffect(() => {
    const next = toSkin(skin);
    if (next) engineRef.current?.setSkin(next);
  }, [skin]);

  useEffect(() => {
    if (theme) engineRef.current?.setTheme(theme);
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      className="tetris-canvas"
      width={W}
      height={H}
      role="img"
      aria-label="Tetris playfield"
    />
  );
}
