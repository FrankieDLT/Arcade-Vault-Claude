"use client";

import { useEffect, useRef } from "react";
import { WingshotEngine } from "@/lib/wingshot/engine";
import { HEIGHT, SKINS, WIDTH, DEFAULT_SKIN } from "@/lib/wingshot/constants";

interface WingshotCanvasProps {
  paused: boolean;
  /** Increment to end the run immediately (0 = not requested). */
  endSignal: number;
  onScore: (score: number) => void;
  /** Hits in the current round (shown as "Hits"). */
  onLines?: (hits: number) => void;
  /** Round number. */
  onLevel?: (round: number) => void;
  onGameOver: (finalScore: number) => void;
  /** Engine sounds ("shot", "hit", "cheer", ...); the platform plays them. */
  onSound?: (sound: string) => void;
  /** Haptic events from the engine ("brick", "clear", "death"); the platform vibrates. */
  onHaptic?: (name: string) => void;
  /** Any string; unknown ids fall back to "retro". */
  skin?: string;
}

const toSkin = (skin: string | undefined): string =>
  skin !== undefined && Object.hasOwn(SKINS, skin) ? skin : DEFAULT_SKIN;

export function WingshotCanvas({
  paused,
  endSignal,
  onScore,
  onLines,
  onLevel,
  onGameOver,
  onSound,
  onHaptic,
  skin,
}: WingshotCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<WingshotEngine | null>(null);
  // Latest callbacks and skin, so the engine is created once and never rebuilt on re-render.
  const callbacksRef = useRef({
    onScore,
    onLines,
    onLevel,
    onGameOver,
    onSound,
    onHaptic,
  });
  const skinRef = useRef(toSkin(skin));

  useEffect(() => {
    callbacksRef.current = {
      onScore,
      onLines,
      onLevel,
      onGameOver,
      onSound,
      onHaptic,
    };
    skinRef.current = toSkin(skin);
  });

  // A finger on the canvas is a shot: ask the platform for a tap haptic (never the mouse).
  // Capture phase runs before the engine's own listener, so a hit's "brick" pulse replaces the tap.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") callbacksRef.current.onHaptic?.("tap");
    };
    canvas.addEventListener("pointerdown", onDown, true);
    return () => canvas.removeEventListener("pointerdown", onDown, true);
  }, []);

  // Create, start and destroy the engine. Strict Mode runs this twice in dev
  // (mount, cleanup, mount): the cleanup destroys the first engine completely.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new WingshotEngine(
      canvas,
      {
        onScore: (s) => callbacksRef.current.onScore(s),
        onLines: (h) => callbacksRef.current.onLines?.(h),
        onLevel: (r) => callbacksRef.current.onLevel?.(r),
        onGameOver: (s) => callbacksRef.current.onGameOver(s),
        onSound: (n) => callbacksRef.current.onSound?.(n),
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
      className="wingshot-canvas"
      width={WIDTH}
      height={HEIGHT}
      role="img"
      aria-label="Wingshot game field. Click or tap a target to shoot."
    />
  );
}
