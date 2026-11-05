"use client";

import { useEffect, useRef } from "react";

export interface BackgroundMusic {
  src: string;
  volume: number;
}

interface MusicState {
  /** The track plays only while this is true (and not muted). */
  active: boolean;
  /** Muting pauses the audio, so a muted page plays nothing. */
  muted: boolean;
  /** When this value changes the track restarts from 0 (e.g. the run id on PLAY AGAIN). */
  restartKey?: number;
}

// Looping background track for a game. One HTMLAudioElement per mount, released on unmount.
export function useBackgroundMusic(
  music: BackgroundMusic | undefined,
  { active, muted, restartKey }: MusicState,
): void {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const src = music?.src;
  const volume = music?.volume;

  // Create the element and release it on cleanup. Strict Mode runs this twice in dev
  // (mount, cleanup, mount): the cleanup stops the first element completely.
  useEffect(() => {
    if (src === undefined || volume === undefined) return;
    const audio = new Audio();
    audio.loop = true;
    audio.volume = volume;
    audio.preload = "auto";
    audio.src = src;
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, [src, volume]);

  // Back to the beginning on a new run. Declared before the play effect so it runs first.
  useEffect(() => {
    if (audioRef.current) audioRef.current.currentTime = 0;
  }, [restartKey, src, volume]);

  // Play or pause. The browser may reject play() before the first user gesture: the
  // rejection is ignored and the track is retried once on the first key press or click.
  const shouldPlay = active && !muted;
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!shouldPlay) {
      audio.pause();
      return;
    }
    let cancelled = false;
    let retry: (() => void) | null = null;
    const removeRetry = () => {
      if (!retry) return;
      window.removeEventListener("keydown", retry);
      window.removeEventListener("pointerdown", retry);
      retry = null;
    };
    audio.play().catch(() => {
      if (cancelled) return;
      retry = () => {
        removeRetry();
        audio.play().catch(() => {});
      };
      window.addEventListener("keydown", retry);
      window.addEventListener("pointerdown", retry);
    });
    return () => {
      cancelled = true;
      removeRetry();
    };
  }, [shouldPlay, src, volume]);
}
