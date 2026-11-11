"use client";

import { useEffect, useRef } from "react";
import { StreetJumperEngine } from "@/lib/street-jumper/engine";
import { H, SKINS, W, type SkinId } from "@/lib/street-jumper/constants";

interface StreetJumperCanvasProps {
  paused: boolean;
  /** Increment to end the run immediately (0 = not requested). */
  endSignal: number;
  onScore: (score: number) => void;
  onLives?: (lives: number) => void;
  onLevel?: (level: number) => void;
  onGameOver: (finalScore: number) => void;
  onHaptic?: (name: string) => void;
  /** Any string; unknown ids fall back to "retro". */
  skin?: string;
}

const toSkin = (skin: string | undefined): SkinId =>
  skin !== undefined && Object.hasOwn(SKINS, skin) ? (skin as SkinId) : "retro";

export function StreetJumperCanvas({
  paused,
  endSignal,
  onScore,
  onLives,
  onLevel,
  onGameOver,
  onHaptic,
  skin,
}: StreetJumperCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<StreetJumperEngine | null>(null);
  // Latest callbacks and skin, so the engine is created once and never rebuilt on re-render.
  const callbacksRef = useRef({
    onScore,
    onLives,
    onLevel,
    onGameOver,
    onHaptic,
  });
  const skinRef = useRef(toSkin(skin));

  useEffect(() => {
    callbacksRef.current = { onScore, onLives, onLevel, onGameOver, onHaptic };
    skinRef.current = toSkin(skin);
  });

  // Create, start and destroy the engine. Strict Mode runs this twice in dev
  // (mount, cleanup, mount): the cleanup destroys the first engine completely.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new StreetJumperEngine(
      canvas,
      {
        onScore: (s) => callbacksRef.current.onScore(s),
        onLives: (l) => callbacksRef.current.onLives?.(l),
        onLevel: (l) => callbacksRef.current.onLevel?.(l),
        onGameOver: (s) => callbacksRef.current.onGameOver(s),
        onHaptic: (n) => callbacksRef.current.onHaptic?.(n),
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
      className="street-jumper-canvas"
      width={W}
      height={H}
      role="img"
      aria-label="Street Jumper game field"
    />
  );
}
