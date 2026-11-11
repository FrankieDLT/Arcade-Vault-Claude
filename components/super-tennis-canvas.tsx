"use client";

import { useEffect, useRef } from "react";
import {
  SuperTennisEngine,
  type SuperTennisDifficulty,
  type SuperTennisMode,
  type SuperTennisSkin,
} from "@/lib/super-tennis/engine";
import { CPU, H, SKINS, W } from "@/lib/super-tennis/constants";

interface SuperTennisCanvasProps {
  paused: boolean;
  /** Increment to end the run immediately (0 = not requested). */
  endSignal: number;
  /** Record score: the human's in PvE, the higher of the two in PvP. */
  onScore: (score: number) => void;
  onGameOver: (finalScore: number) => void;
  /** Engine sounds ("paddle", "goal", "gameover"); the platform plays them. */
  onSound?: (sound: string) => void;
  /** Haptic events from the engine ("death"); the platform vibrates. */
  onHaptic?: (name: string) => void;
  /** Any string; unknown ids fall back to "retro". */
  skin?: string;
  /** "pve" or "pvp". Read once, when the engine is created; unknown values fall back to "pve". */
  mode?: string;
  /** PvE difficulty id; unknown values fall back to "normal". */
  difficulty?: string;
}

const toSkin = (skin: string | undefined): SuperTennisSkin =>
  skin !== undefined && Object.hasOwn(SKINS, skin)
    ? (skin as SuperTennisSkin)
    : "retro";

const toMode = (mode: string | undefined): SuperTennisMode =>
  mode === "pvp" ? "pvp" : "pve";

const toDifficulty = (difficulty: string | undefined): SuperTennisDifficulty =>
  difficulty !== undefined && Object.hasOwn(CPU, difficulty)
    ? (difficulty as SuperTennisDifficulty)
    : "normal";

export function SuperTennisCanvas({
  paused,
  endSignal,
  onScore,
  onGameOver,
  onSound,
  onHaptic,
  skin,
  mode,
  difficulty,
}: SuperTennisCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SuperTennisEngine | null>(null);
  // Latest callbacks and options, so the engine is created once and never rebuilt on re-render.
  const callbacksRef = useRef({ onScore, onGameOver, onSound, onHaptic });
  const optionsRef = useRef({
    mode: toMode(mode),
    difficulty: toDifficulty(difficulty),
    skin: toSkin(skin),
  });

  useEffect(() => {
    callbacksRef.current = { onScore, onGameOver, onSound, onHaptic };
    optionsRef.current = {
      mode: optionsRef.current.mode, // fixed for the life of the engine
      difficulty: toDifficulty(difficulty),
      skin: toSkin(skin),
    };
  });

  // Create, start and destroy the engine. Strict Mode runs this twice in dev
  // (mount, cleanup, mount): the cleanup destroys the first engine completely.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new SuperTennisEngine(
      canvas,
      {
        onScore: (s) => callbacksRef.current.onScore(s),
        onGameOver: (s) => callbacksRef.current.onGameOver(s),
        onSound: (n) => callbacksRef.current.onSound?.(n),
        onHaptic: (n) => callbacksRef.current.onHaptic?.(n),
      },
      optionsRef.current,
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
    engineRef.current?.setDifficulty(toDifficulty(difficulty));
  }, [difficulty]);

  return (
    <canvas
      ref={canvasRef}
      className="super-tennis-canvas"
      width={W}
      height={H}
      role="img"
      aria-label="Super Tennis game field"
    />
  );
}
