"use client";

import { useEffect, useRef } from "react";
import {
  VampireHunterEngine,
  type VampireHunterSound,
} from "@/lib/vampire-hunter/engine";
import { H, W } from "@/lib/vampire-hunter/constants";

interface VampireHunterCanvasProps {
  paused: boolean;
  /** Increment to end the run immediately (0 = not requested). */
  endSignal: number;
  onScore: (score: number) => void;
  onLives?: (lives: number) => void;
  onLevel?: (level: number) => void;
  onGameOver: (finalScore: number) => void;
  /** Engine sounds (whip, hit, relic, ...); the platform plays them. */
  onSound?: (sound: string) => void;
  /** Haptic events from the engine ("death", "clear"); the platform vibrates. */
  onHaptic?: (name: string) => void;
  /** Which music track to play: "boss" during boss fights, otherwise "stage". */
  onMusic?: (track: "stage" | "boss") => void;
  /** A Credit Coin was collected. */
  onCreditDrop?: () => void;
  /** False for guests: the engine makes no coin roll. Read at every roll. */
  canDropCredit?: () => boolean;
}

export function VampireHunterCanvas({
  paused,
  endSignal,
  onScore,
  onLives,
  onLevel,
  onGameOver,
  onSound,
  onHaptic,
  onMusic,
  onCreditDrop,
  canDropCredit,
}: VampireHunterCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<VampireHunterEngine | null>(null);
  // Latest callbacks, so the engine is created once and never rebuilt on re-render.
  const callbacksRef = useRef({
    onScore,
    onLives,
    onLevel,
    onGameOver,
    onSound,
    onHaptic,
    onMusic,
    onCreditDrop,
    canDropCredit,
  });

  useEffect(() => {
    callbacksRef.current = {
      onScore,
      onLives,
      onLevel,
      onGameOver,
      onSound,
      onHaptic,
      onMusic,
      onCreditDrop,
      canDropCredit,
    };
  });

  // Create, start and destroy the engine. Strict Mode runs this twice in dev
  // (mount, cleanup, mount): the cleanup destroys the first engine completely.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new VampireHunterEngine(canvas, {
      onScore: (s) => callbacksRef.current.onScore(s),
      onLives: (l) => callbacksRef.current.onLives?.(l),
      onLevel: (l) => callbacksRef.current.onLevel?.(l),
      onGameOver: (s) => callbacksRef.current.onGameOver(s),
      onSound: (n: VampireHunterSound) => callbacksRef.current.onSound?.(n),
      onHaptic: (n) => callbacksRef.current.onHaptic?.(n),
      onMusic: (t) => callbacksRef.current.onMusic?.(t),
      onCreditDrop: () => callbacksRef.current.onCreditDrop?.(),
      canDropCredit: () => callbacksRef.current.canDropCredit?.() === true,
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
      className="vampire-hunter-canvas"
      width={W}
      height={H}
      role="img"
      aria-label="Marcy the Vampire Hunter game field"
    />
  );
}
