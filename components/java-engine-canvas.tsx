"use client";

import { useEffect, useRef, useState } from "react";
import { loadJavaEngine } from "@/lib/java-bridge/loader";
import type {
  JavaCallbacks,
  JavaEngineHandle,
  JavaEngineOptions,
} from "@/lib/java-bridge/types";

export interface JavaEngineCanvasProps<P> {
  /** Key of window.ArcadeVaultJava, the same id the Java Main registers. */
  gameId: string;
  /** URL of the compiled script, already passed through withBasePath(). */
  src: string;
  width: number;
  height: number;
  /** Per-game canvas class (absolute fill, touch-action: none). */
  className: string;
  ariaLabel: string;
  /** Passed to Java at creation and again on every change (skin). */
  palette: P;
  paused: boolean;
  /** Increment to end the run immediately (0 = not requested). */
  endSignal: number;
  onScore: (score: number) => void;
  onGameOver: (finalScore: number) => void;
  onLives?: (lives: number) => void;
  onLevel?: (level: number) => void;
  onLines?: (lines: number) => void;
  onSound?: (name: string) => void;
  onHaptic?: (name: string) => void;
  onMusic?: (track: "stage" | "boss") => void;
  /** A change of `id` calls handle.setLevel(level), if the Java handle declares it. */
  levelRequest?: { level: number; id: number };
  /** Read once, at creation, in the options object. */
  mode?: string;
  /** At creation in the options object, then handle.setDifficulty on change. */
  difficulty?: string;
}

/**
 * Generic canvas wrapper for any Java engine compiled with TeaVM. It owns the lifecycle the
 * TypeScript wrappers own (engine created once, destroyed on cleanup, latest callbacks) plus
 * what async loading adds: unmount before the script loads, the latest props applied right
 * after creation, and a load-error message.
 */
export function JavaEngineCanvas<P>(props: JavaEngineCanvasProps<P>) {
  const { gameId, src, width, height, className, ariaLabel } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<JavaEngineHandle<P> | null>(null);
  const [failed, setFailed] = useState(false);

  // Latest props, read by the creation effect (it runs once) and by the callbacks.
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  const appliedLevelId = useRef(0);
  const sentDifficulty = useRef<string | undefined>(undefined);

  // Create, start and destroy the engine. Strict Mode runs this twice in dev (mount, cleanup,
  // mount): `cancelled` stops the first run from creating an engine after its cleanup.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let handle: JavaEngineHandle<P> | null = null;

    const callbacks: JavaCallbacks = {
      onScore: (v) => latest.current.onScore(v),
      onLives: (v) => latest.current.onLives?.(v),
      onLevel: (v) => latest.current.onLevel?.(v),
      onLines: (v) => latest.current.onLines?.(v),
      onGameOver: (v) => latest.current.onGameOver(v),
      onSound: (n) => latest.current.onSound?.(n),
      onHaptic: (n) => latest.current.onHaptic?.(n),
      onMusic: (t) => latest.current.onMusic?.(t === "boss" ? "boss" : "stage"),
    };

    loadJavaEngine<P>(gameId, src)
      .then((factory) => {
        if (cancelled) return;
        const now = latest.current;
        const options: JavaEngineOptions = {};
        if (now.mode !== undefined) options.mode = now.mode;
        if (now.difficulty !== undefined) options.difficulty = now.difficulty;
        sentDifficulty.current = now.difficulty;
        handle = factory(canvas, callbacks, now.palette, options);
        handleRef.current = handle;
        handle.start();
        if (now.paused) handle.pause(); // pause pressed while the script was loading
        if (now.levelRequest) {
          appliedLevelId.current = now.levelRequest.id;
          handle.setLevel?.(now.levelRequest.level);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error(`Java game "${gameId}" failed to start`, error);
        setFailed(true);
      });

    return () => {
      cancelled = true;
      handle?.destroy();
      handleRef.current = null;
    };
    // The engine is created once per mount. Everything else is read through `latest`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    if (props.paused) handle.pause();
    else handle.resume();
  }, [props.paused]);

  useEffect(() => {
    if (props.endSignal > 0) handleRef.current?.end();
  }, [props.endSignal]);

  useEffect(() => {
    handleRef.current?.setSkin(props.palette);
  }, [props.palette]);

  useEffect(() => {
    const request = props.levelRequest;
    const handle = handleRef.current;
    if (!handle || !request || request.id === appliedLevelId.current) return;
    appliedLevelId.current = request.id;
    handle.setLevel?.(request.level);
  }, [props.levelRequest]);

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle || props.difficulty === undefined) return;
    if (props.difficulty === sentDifficulty.current) return;
    sentDifficulty.current = props.difficulty;
    handle.setDifficulty?.(props.difficulty);
  }, [props.difficulty]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className={className}
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
      />
      {failed && (
        <div className="java-engine-error" role="alert">
          COULD NOT LOAD THE GAME. RELOAD THE PAGE.
        </div>
      )}
    </>
  );
}
