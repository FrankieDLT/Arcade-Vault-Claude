"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { usePathname } from "next/navigation";
import { useGamepad } from "@/components/gamepad-provider";
import { useTouchUi } from "@/components/use-touch-ui";
import { GAMEPAD_SKINS } from "@/lib/gamepad";

/**
 * Top-bar menu for the on-screen gamepad: an ON / OFF switch and the skin list.
 * Below 768px the pad is always on, so the switch is shown ON and locked.
 */
export function GamepadMenu() {
  const pathname = usePathname();
  const touchUi = useTouchUi();
  const { enabled, skin, setEnabled, setSkin } = useGamepad();
  // The menu is open for the route it was opened on: a route change closes it.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const skinRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const panelId = useId();
  const on = touchUi || enabled;

  const close = (refocus = false) => {
    setOpenPath(null);
    if (refocus) buttonRef.current?.focus();
  };

  // Outside click closes.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpenPath(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const moveSkin = (e: ReactKeyboardEvent, index: number) => {
    const step =
      e.key === "ArrowDown" || e.key === "ArrowRight"
        ? 1
        : e.key === "ArrowUp" || e.key === "ArrowLeft"
          ? -1
          : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + GAMEPAD_SKINS.length) % GAMEPAD_SKINS.length;
    setSkin(GAMEPAD_SKINS[next].id);
    skinRefs.current[next]?.focus();
  };

  return (
    <div
      ref={rootRef}
      className="gp-menu"
      // Keys typed in the menu must not reach the game listening on window.
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          close(true);
        }
        if (e.key !== "Tab") e.stopPropagation();
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="btn ghost gp-menu-btn"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="GamePad"
        onClick={() => setOpenPath(open ? null : pathname)}
      >
        <svg
          className="gp-menu-icon"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M7 6h10a5 5 0 0 1 4.9 4l.9 5.2A2.8 2.8 0 0 1 18.2 17L16.6 15H7.4L5.8 17A2.8 2.8 0 0 1 1.2 15.2L2.1 10A5 5 0 0 1 7 6Zm.5 2.5v1.5H6v1.5h1.5V13H9v-1.5h1.5V10H9V8.5H7.5Zm9 .5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm2.5 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
          />
        </svg>
        <span className="gp-menu-label">GamePad ▾</span>
      </button>

      {open && (
        <div id={panelId} className="gp-menu-panel">
          <div className="gp-switch-row">
            <span id={`${panelId}-sw`} className="gp-menu-title">
              Gamepad
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-labelledby={`${panelId}-sw`}
              aria-describedby={touchUi ? `${panelId}-note` : undefined}
              className={`gp-switch${on ? " is-on" : ""}`}
              disabled={touchUi}
              onClick={() => setEnabled(!enabled)}
            >
              <span className="gp-switch-knob" />
              <span className="gp-switch-text">{on ? "ON" : "OFF"}</span>
            </button>
          </div>
          {touchUi && (
            <p id={`${panelId}-note`} className="gp-menu-note">
              Always on for touch screens
            </p>
          )}

          <div className="gp-menu-title gp-skins-title" id={`${panelId}-sk`}>
            Skin
          </div>
          <div role="radiogroup" aria-labelledby={`${panelId}-sk`}>
            {GAMEPAD_SKINS.map((s, i) => (
              <button
                key={s.id}
                ref={(el) => {
                  skinRefs.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={skin === s.id}
                tabIndex={skin === s.id ? 0 : -1}
                className={`gp-skin-opt${skin === s.id ? " is-active" : ""}`}
                onClick={() => setSkin(s.id)}
                onKeyDown={(e) => moveSkin(e, i)}
              >
                <span className="gp-skin-dot" aria-hidden="true" />
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
