"use client";

import { useEffect, useRef } from "react";
import { RoboVaultEngine, type RoboVaultSound } from "@/lib/robo-vault/engine";
import { H, SKINS, W, type RoboVaultSkinId } from "@/lib/robo-vault/constants";

interface RoboVaultCanvasProps {
  paused: boolean;
  /** Increment to end the run immediately (0 = not requested). */
  endSignal: number;
  onScore: (score: number) => void;
  onLives?: (lives: number) => void;
  onLevel?: (level: number) => void;
  onGameOver: (finalScore: number) => void;
  /** Engine sounds (shoot, jump, hit, ...); the platform plays them. */
  onSound?: (sound: string) => void;
  /** Haptic events from the engine ("death", "clear"); the platform vibrates. */
  onHaptic?: (name: string) => void;
  /** A boss was defeated; the platform awards a credit. */
  onBossDefeated?: (boss: string) => void;
  /** Which music track to play: "boss" during boss fights, otherwise "stage". */
  onMusic?: (track: "stage" | "boss") => void;
  /** Any string; unknown ids fall back to "retro". */
  skin?: string;
}

const toSkin = (skin: string | undefined): RoboVaultSkinId =>
  skin !== undefined && Object.hasOwn(SKINS, skin)
    ? (skin as RoboVaultSkinId)
    : "retro";

export function RoboVaultCanvas({
  paused,
  endSignal,
  onScore,
  onLives,
  onLevel,
  onGameOver,
  onSound,
  onHaptic,
  onMusic,
  onBossDefeated,
  skin,
}: RoboVaultCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RoboVaultEngine | null>(null);
  // Latest callbacks, so the engine is created once and never rebuilt on re-render.
  const callbacksRef = useRef({
    onScore,
    onLives,
    onLevel,
    onGameOver,
    onSound,
    onHaptic,
    onMusic,
    onBossDefeated,
  });
  const skinRef = useRef(toSkin(skin));

  useEffect(() => {
    callbacksRef.current = {
      onScore,
      onLives,
      onLevel,
      onGameOver,
      onSound,
      onHaptic,
      onMusic,
      onBossDefeated,
    };
    skinRef.current = toSkin(skin);
  });

  // Create, start and destroy the engine. Strict Mode runs this twice in dev
  // (mount, cleanup, mount): the cleanup destroys the first engine completely.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new RoboVaultEngine(
      canvas,
      {
        onScore: (s) => callbacksRef.current.onScore(s),
        onLives: (l) => callbacksRef.current.onLives?.(l),
        onLevel: (l) => callbacksRef.current.onLevel?.(l),
        onGameOver: (s) => callbacksRef.current.onGameOver(s),
        onSound: (n: RoboVaultSound) => callbacksRef.current.onSound?.(n),
        onHaptic: (n) => callbacksRef.current.onHaptic?.(n),
        onMusic: (t) => callbacksRef.current.onMusic?.(t),
        onBossDefeated: (b) => callbacksRef.current.onBossDefeated?.(b),
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
      className="robo-vault-canvas"
      width={W}
      height={H}
      role="img"
      aria-label="Robo Vault game field"
    />
  );
}
