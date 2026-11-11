"use client";

import { useEffect, useRef, type RefObject } from "react";

export interface BackgroundMusic {
  src: string;
  volume: number;
  /** Optional second track (e.g. boss fights). Both tracks are preloaded; `useAlt` swaps them. */
  alt?: { src: string; volume: number };
}

interface MusicState {
  /** The track plays only while this is true (and not muted). */
  active: boolean;
  /** Muting pauses the audio, so a muted page plays nothing. */
  muted: boolean;
  /** When this value changes the track restarts from 0 (e.g. the run id on PLAY AGAIN). */
  restartKey?: number;
  /** Play the `alt` track instead of the main one. The main track is paused, not stopped. */
  useAlt?: boolean;
}

function createAudio(src: string, volume: number): HTMLAudioElement {
  const audio = new Audio();
  audio.loop = true;
  audio.volume = volume;
  audio.preload = "auto";
  audio.src = src;
  return audio;
}

// Plays or pauses one element. The browser may reject play() before the first user
// gesture: the rejection is ignored and the track is retried once on the first key
// press or click.
function usePlayback(
  audioRef: RefObject<HTMLAudioElement | null>,
  shouldPlay: boolean,
  trackKey: string | undefined,
): void {
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
  }, [audioRef, shouldPlay, trackKey]);
}

// Looping background track for a game, with an optional second track. One
// HTMLAudioElement per track per mount, released on unmount.
export function useBackgroundMusic(
  music: BackgroundMusic | undefined,
  { active, muted, restartKey, useAlt = false }: MusicState,
): void {
  const mainRef = useRef<HTMLAudioElement | null>(null);
  const altRef = useRef<HTMLAudioElement | null>(null);
  const src = music?.src;
  const volume = music?.volume;
  const altSrc = music?.alt?.src;
  const altVolume = music?.alt?.volume;

  // Create the elements and release them on cleanup. Strict Mode runs this twice in dev
  // (mount, cleanup, mount): the cleanup stops the first element completely.
  useEffect(() => {
    if (src === undefined || volume === undefined) return;
    const audio = createAudio(src, volume);
    mainRef.current = audio;
    return () => {
      audio.pause();
      audio.src = "";
      mainRef.current = null;
    };
  }, [src, volume]);

  useEffect(() => {
    if (altSrc === undefined || altVolume === undefined) return;
    const audio = createAudio(altSrc, altVolume);
    altRef.current = audio;
    return () => {
      audio.pause();
      audio.src = "";
      altRef.current = null;
    };
  }, [altSrc, altVolume]);

  // Back to the beginning on a new run. Declared before the play effects so it runs first.
  useEffect(() => {
    if (mainRef.current) mainRef.current.currentTime = 0;
    if (altRef.current) altRef.current.currentTime = 0;
  }, [restartKey, src, volume, altSrc, altVolume]);

  // The alt track starts from the top every time it is switched on.
  useEffect(() => {
    if (useAlt && altRef.current) altRef.current.currentTime = 0;
  }, [useAlt]);

  const playing = active && !muted;
  usePlayback(mainRef, playing && !useAlt, `${src}|${volume}`);
  usePlayback(altRef, playing && useAlt, `${altSrc}|${altVolume}`);
}
