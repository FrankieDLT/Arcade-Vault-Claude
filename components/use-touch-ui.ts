"use client";

import { useSyncExternalStore } from "react";

/** The touch UI (pad, touch hint, haptics) is active below this width. Keep in sync with the CSS media query. */
export const TOUCH_UI_QUERY = "(max-width: 767px)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(TOUCH_UI_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const getSnapshot = () => window.matchMedia(TOUCH_UI_QUERY).matches;
// False on the server and during hydration, then the real value: no hydration mismatch.
const getServerSnapshot = () => false;

/** True below 768px. Updates live when the window crosses the breakpoint. */
export function useTouchUi(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
