"use client";

import { useEffect, useRef } from "react";
import { AsteroidsEngine } from "@/lib/asteroids/engine";
import { H, W } from "@/lib/asteroids/constants";

interface AsteroidsCanvasProps {
  paused: boolean;
  /** Increment to end the run immediately (0 = not requested). */
  endSignal: number;
  onScore: (score: number) => void;
  onLives?: (lives: number) => void;
  onLevel?: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export function AsteroidsCanvas({
  paused,
  endSignal,
  onScore,
  onLives,
  onLevel,
  onGameOver,
}: AsteroidsCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AsteroidsEngine | null>(null);
  // Latest callbacks, so the engine is created once and never rebuilt on re-render.
  const callbacksRef = useRef({ onScore, onLives, onLevel, onGameOver });

  useEffect(() => {
    callbacksRef.current = { onScore, onLives, onLevel, onGameOver };
  });

  // Create, start and destroy the engine. Strict Mode runs this twice in dev
  // (mount, cleanup, mount): the cleanup destroys the first engine completely.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new AsteroidsEngine(canvas, {
      onScore: (s) => callbacksRef.current.onScore(s),
      onLives: (l) => callbacksRef.current.onLives?.(l),
      onLevel: (l) => callbacksRef.current.onLevel?.(l),
      onGameOver: (s) => callbacksRef.current.onGameOver(s),
    });
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

  return (
    <canvas
      ref={canvasRef}
      className="asteroids-canvas"
      width={W}
      height={H}
      role="img"
      aria-label="Asteroids game field"
    />
  );
}
