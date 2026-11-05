"use client";

import { useCallback, useEffect, useRef } from "react";

export interface SoundEffects {
  /** Sound name -> file URL. */
  sounds: Record<string, string>;
  volume: number;
}

// Short sound effects for a game. Returns a stable `play(name)`.
// Audio objects are created lazily on the first play (after a user gesture, so the autoplay
// policy is satisfied). A clone is played each time so fast hits overlap.
export function useSoundEffects(
  sfx: SoundEffects | undefined,
  { muted }: { muted: boolean },
): (name: string) => void {
  const sfxRef = useRef(sfx);
  const mutedRef = useRef(muted);
  const audiosRef = useRef<Record<string, HTMLAudioElement>>({});

  useEffect(() => {
    sfxRef.current = sfx;
    mutedRef.current = muted;
  });

  // Drop the cached Audio objects on unmount.
  useEffect(() => {
    const audios = audiosRef.current;
    return () => {
      for (const key of Object.keys(audios)) delete audios[key];
    };
  }, []);

  return useCallback((name: string) => {
    const current = sfxRef.current;
    if (!current || mutedRef.current) return;
    const src = current.sounds[name];
    if (!src) return;
    const audios = audiosRef.current;
    let base = audios[name];
    if (!base) {
      base = new Audio(src);
      audios[name] = base;
    }
    const clone = base.cloneNode() as HTMLAudioElement;
    clone.volume = current.volume;
    clone.play().catch(() => {});
  }, []);
}
