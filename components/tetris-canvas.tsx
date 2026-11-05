"use client";

import { useEffect, useRef } from "react";
import {
  TetrisEngine,
  type TetrisSkin,
  type TetrisTheme,
} from "@/lib/tetris/engine";
import { H, W } from "@/lib/tetris/constants";

interface TetrisCanvasProps {
  paused: boolean;
  /** Increment to end the run immediately (0 = not requested). */
  endSignal: number;
  onScore: (score: number) => void;
  onLines?: (lines: number) => void;
  onLevel?: (level: number) => void;
  onGameOver: (finalScore: number) => void;
  /** Block style; later changes apply live, without restarting the run. */
  skin?: TetrisSkin;
  /** Canvas colors; later changes apply live, without restarting the run. */
  theme?: TetrisTheme;
}

export function TetrisCanvas({
  paused,
  endSignal,
  onScore,
  onLines,
  onLevel,
  onGameOver,
  skin,
  theme,
}: TetrisCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<TetrisEngine | null>(null);
  // Latest callbacks and appearance, so the engine is created once and never rebuilt on re-render.
  const callbacksRef = useRef({ onScore, onLines, onLevel, onGameOver });
  const appearanceRef = useRef({ skin, theme });

  useEffect(() => {
    callbacksRef.current = { onScore, onLines, onLevel, onGameOver };
    appearanceRef.current = { skin, theme };
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
    if (skin) engineRef.current?.setSkin(skin);
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
