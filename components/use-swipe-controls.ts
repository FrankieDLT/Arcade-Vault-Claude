import { useEffect, useRef, type RefObject } from "react";

/** Minimum finger travel, in screen pixels, for one direction change. */
export const SWIPE_THRESHOLD = 24;

interface SwipeOptions {
  /** False = ignore swipes (paused). */
  enabled?: boolean;
  /** Called once per direction change sent to the engine. */
  onSwipe?: () => void;
}

/**
 * Turns finger swipes on `ref` into synthetic arrow-key presses on `window`, so the engine keeps
 * reading the keyboard only. A swipe is measured from the last origin to the current finger position;
 * the origin resets after each trigger, so one continuous path can turn several times.
 * Touch and pen only: a mouse drag on desktop does nothing.
 */
export function useSwipeControls(
  ref: RefObject<HTMLElement | null>,
  { enabled = true, onSwipe }: SwipeOptions = {},
) {
  // Latest options without re-attaching the listeners on every render.
  const optionsRef = useRef({ enabled, onSwipe });
  useEffect(() => {
    optionsRef.current = { enabled, onSwipe };
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.style.touchAction = "none";
    let pointerId: number | null = null;
    let originX = 0;
    let originY = 0;

    const send = (code: string) => {
      for (const type of ["keydown", "keyup"] as const) {
        window.dispatchEvent(
          new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true }),
        );
      }
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" || pointerId !== null) return;
      pointerId = e.pointerId;
      originX = e.clientX;
      originY = e.clientY;
      el.setPointerCapture(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      const dx = e.clientX - originX;
      const dy = e.clientY - originY;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;
      originX = e.clientX;
      originY = e.clientY;
      if (!optionsRef.current.enabled) return;
      const code =
        Math.abs(dx) >= Math.abs(dy)
          ? dx > 0
            ? "ArrowRight"
            : "ArrowLeft"
          : dy > 0
            ? "ArrowDown"
            : "ArrowUp";
      send(code);
      optionsRef.current.onSwipe?.();
    };

    const onEnd = (e: PointerEvent) => {
      if (e.pointerId === pointerId) pointerId = null;
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onEnd);
    el.addEventListener("pointercancel", onEnd);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onEnd);
      el.removeEventListener("pointercancel", onEnd);
      el.style.touchAction = "";
    };
  }, [ref]);
}
