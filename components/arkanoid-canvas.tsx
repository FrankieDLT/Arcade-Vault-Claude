"use client";

import { useEffect, useRef } from "react";
import { ArkanoidEngine, type ArkanoidSkin } from "@/lib/arkanoid/engine";
import { H, SKINS, W } from "@/lib/arkanoid/constants";

interface ArkanoidCanvasProps {
  paused: boolean;
  /** Increment to end the run immediately (0 = not requested). */
  endSignal: number;
  onScore: (score: number) => void;
  onLives?: (lives: number) => void;
  onLevel?: (level: number) => void;
  onSound?: (sound: string) => void;
  /** Receives "tap" when a finger (touch or pen, not the mouse) touches the canvas. */
  onHaptic?: (name: string) => void;
  onGameOver: (finalScore: number) => void;
  /** Any string; unknown ids fall back to "retro". */
  skin?: string;
  /** A change of `id` asks the engine to jump to `level` (level select). */
  levelRequest?: { level: number; id: number };
}

const toSkin = (skin: string | undefined): ArkanoidSkin =>
  skin !== undefined && Object.hasOwn(SKINS, skin)
    ? (skin as ArkanoidSkin)
    : "retro";

export function ArkanoidCanvas({
  paused,
  endSignal,
  onScore,
  onLives,
  onLevel,
  onSound,
  onHaptic,
  onGameOver,
  skin,
  levelRequest,
}: ArkanoidCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<ArkanoidEngine | null>(null);
  // Latest callbacks and skin, so the engine is created once and never rebuilt on re-render.
  const callbacksRef = useRef({
    onScore,
    onLives,
    onLevel,
    onSound,
    onHaptic,
    onGameOver,
  });
  const skinRef = useRef(toSkin(skin));

  useEffect(() => {
    callbacksRef.current = {
      onScore,
      onLives,
      onLevel,
      onSound,
      onHaptic,
      onGameOver,
    };
    skinRef.current = toSkin(skin);
  });

  // A finger on the canvas is the launch tap / drag start: ask the platform for a tap haptic.
  // The engine is not involved; the mouse never vibrates.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") callbacksRef.current.onHaptic?.("tap");
    };
    canvas.addEventListener("pointerdown", onDown);
    return () => canvas.removeEventListener("pointerdown", onDown);
  }, []);

  // Create, start and destroy the engine. Strict Mode runs this twice in dev
  // (mount, cleanup, mount): the cleanup destroys the first engine completely.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new ArkanoidEngine(
      canvas,
      {
        onScore: (s) => callbacksRef.current.onScore(s),
        onLives: (l) => callbacksRef.current.onLives?.(l),
        onLevel: (l) => callbacksRef.current.onLevel?.(l),
        onSound: (s) => callbacksRef.current.onSound?.(s),
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

  useEffect(() => {
    if (levelRequest) engineRef.current?.setLevel(levelRequest.level);
  }, [levelRequest]);

  return (
    <canvas
      ref={canvasRef}
      className="arkanoid-canvas"
      width={W}
      height={H}
      role="img"
      aria-label="Arkanoid game field"
    />
  );
}
