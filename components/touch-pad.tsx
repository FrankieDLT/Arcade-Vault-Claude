"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { TouchButton } from "@/components/game-registry";

interface TouchPadProps {
  buttons: TouchButton[];
  /** True while the run is paused or over: no input reaches the engine and held keys are released. */
  disabled?: boolean;
  /** Called once per button press (not on release). The platform uses it for haptics. */
  onPress?: (code: string) => void;
}

/** `KeyboardEvent.key` for the codes the pad sends. The engines read `code` only. */
function keyFor(code: string): string {
  if (code === "Space") return " ";
  if (code.startsWith("Key")) return code.slice(3).toLowerCase();
  return code;
}

function sendKey(type: "keydown" | "keyup", code: string) {
  window.dispatchEvent(
    new KeyboardEvent(type, {
      code,
      key: keyFor(code),
      bubbles: true,
      cancelable: true,
    }),
  );
}

/**
 * On-screen button pad. Each press sends one synthetic `keydown` on `window`, each release one `keyup`,
 * so the engines keep reading the keyboard only. Hidden by CSS at 768px and wider.
 */
export function TouchPad({
  buttons,
  disabled = false,
  onPress,
}: TouchPadProps) {
  // pointerId holding each code; one entry per held button.
  const heldRef = useRef(new Map<string, number>());
  const [down, setDown] = useState<ReadonlySet<string>>(new Set());

  const release = useCallback((code: string) => {
    if (!heldRef.current.delete(code)) return;
    sendKey("keyup", code);
    setDown((prev) => {
      const next = new Set(prev);
      next.delete(code);
      return next;
    });
  }, []);

  const releaseAll = useCallback(() => {
    for (const code of [...heldRef.current.keys()]) release(code);
  }, [release]);

  // Release everything when the pad is disabled (pause / game over).
  useEffect(() => {
    if (disabled) releaseAll();
  }, [disabled, releaseAll]);

  // Release on hidden page, lost focus and unmount.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") releaseAll();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("blur", releaseAll);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("blur", releaseAll);
      releaseAll();
    };
  }, [releaseAll]);

  const handleDown = (
    e: ReactPointerEvent<HTMLButtonElement>,
    code: string,
  ) => {
    if (disabled || heldRef.current.has(code)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    heldRef.current.set(code, e.pointerId);
    setDown((prev) => new Set(prev).add(code));
    sendKey("keydown", code);
    onPress?.(code);
  };

  const handleUp = (e: ReactPointerEvent<HTMLButtonElement>, code: string) => {
    // Only the pointer that pressed this button may release it.
    if (heldRef.current.get(code) === e.pointerId) release(code);
  };

  const renderArea = (area: TouchButton["area"]) => (
    <div className={`touch-area touch-area-${area}`}>
      {buttons
        .filter((b) => b.area === area)
        .map((b) => (
          <button
            key={b.code}
            type="button"
            className={`touch-btn${down.has(b.code) ? " is-down" : ""}${b.hold ? " is-hold" : ""}`}
            disabled={disabled}
            data-code={b.code}
            onPointerDown={(e) => handleDown(e, b.code)}
            onPointerUp={(e) => handleUp(e, b.code)}
            onPointerCancel={(e) => handleUp(e, b.code)}
            onPointerLeave={(e) => handleUp(e, b.code)}
            onLostPointerCapture={(e) => handleUp(e, b.code)}
            onContextMenu={(e) => e.preventDefault()}
          >
            {b.label}
          </button>
        ))}
    </div>
  );

  return (
    <div className="touch-pad" role="group" aria-label="Touch controls">
      {renderArea("left")}
      {renderArea("right")}
    </div>
  );
}
