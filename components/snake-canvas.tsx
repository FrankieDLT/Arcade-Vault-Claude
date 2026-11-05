"use client";

import { useEffect, useRef } from "react";
import { SnakeEngine, type SnakeSkin } from "@/lib/snake/engine";
import { H, SKINS, W } from "@/lib/snake/constants";

interface SnakeCanvasProps {
  paused: boolean;
  /** Increment to end the run immediately (0 = not requested). */
  endSignal: number;
  onScore: (score: number) => void;
  /** Receives the snake length (the platform HUD shows it in the lines slot). */
  onLines?: (length: number) => void;
  onGameOver: (finalScore: number) => void;
  /** Any string; unknown ids fall back to "retro". */
  skin?: string;
}

const toSkin = (skin: string | undefined): SnakeSkin =>
  skin !== undefined && Object.hasOwn(SKINS, skin)
    ? (skin as SnakeSkin)
    : "retro";

export function SnakeCanvas({
  paused,
  endSignal,
  onScore,
  onLines,
  onGameOver,
  skin,
}: SnakeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SnakeEngine | null>(null);
  // Latest callbacks and skin, so the engine is created once and never rebuilt on re-render.
  const callbacksRef = useRef({ onScore, onLines, onGameOver });
  const skinRef = useRef(toSkin(skin));

  useEffect(() => {
    callbacksRef.current = { onScore, onLines, onGameOver };
    skinRef.current = toSkin(skin);
  });

  // Create, start and destroy the engine. Strict Mode runs this twice in dev
  // (mount, cleanup, mount): the cleanup destroys the first engine completely.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new SnakeEngine(
      canvas,
      {
        onScore: (s) => callbacksRef.current.onScore(s),
        onLength: (l) => callbacksRef.current.onLines?.(l),
        onGameOver: (s) => callbacksRef.current.onGameOver(s),
      },
      { skin: skinRef.current },
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
    engineRef.current?.setSkin(toSkin(skin));
  }, [skin]);

  return (
    <canvas
      ref={canvasRef}
      className="snake-canvas"
      width={W}
      height={H}
      role="img"
      aria-label="Snake game field"
    />
  );
}
