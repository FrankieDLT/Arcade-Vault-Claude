"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { TouchButton } from "@/components/game-registry";
import {
  DEFAULT_GAMEPAD_SKIN,
  type GamepadSkinId,
  type PadSlot,
  usesJoystick,
} from "@/lib/gamepad";

interface TouchPadProps {
  buttons: TouchButton[];
  /** Look of the pad. Layout and art are CSS (`.touch-pad.skin-<id>`); the actions never change. */
  skin?: GamepadSkinId;
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

function sendKey(type: "keydown" | "keyup", code: string, repeat = false) {
  window.dispatchEvent(
    new KeyboardEvent(type, {
      code,
      key: keyFor(code),
      repeat,
      bubbles: true,
      cancelable: true,
    }),
  );
}

/** Held direction repeat, Block Rain Guideline timing at 60 Hz: DAS 10 frames, ARR 2 frames. */
const REPEAT_DELAY_MS = 167;
const REPEAT_INTERVAL_MS = 33;

/** Controls whose held codes auto-repeat: the four direction slots and the joystick. */
const REPEAT_IDS = new Set<string>(["up", "down", "left", "right", "stick"]);

interface RepeatTimer {
  timeout?: number;
  interval?: number;
}

/** What a slot shows when the game gives it no action (drawn dimmed and inert). */
const SLOT_GLYPH: Record<PadSlot, string> = {
  up: "▲",
  down: "▼",
  left: "◀",
  right: "▶",
  a: "A",
  b: "B",
  x: "",
  y: "",
};

const ROUND_SLOTS: PadSlot[] = ["a", "b"];
const PILL_SLOTS: PadSlot[] = ["x", "y"];

/** Joystick id in the held map. */
const STICK = "stick";
/** Directions held per 45 degree sector, clockwise from "right" (screen y grows downwards). */
const STICK_SECTORS: PadSlot[][] = [
  ["right"],
  ["down", "right"],
  ["down"],
  ["down", "left"],
  ["left"],
  ["up", "left"],
  ["up"],
  ["up", "right"],
];
/** Below this share of the base radius the stick is centered: nothing is held. */
const STICK_DEAD_ZONE = 0.28;
/** The ball travels at most this share of the base radius. */
const STICK_TRAVEL = 0.5;

/** One pointer holding one control: the codes it keeps down. */
interface Held {
  pointerId: number;
  codes: string[];
}

/**
 * On-screen pad. Each press sends one synthetic `keydown` on `window`, each release one `keyup`,
 * so the engines keep reading the keyboard only. The platform decides when the pad is rendered.
 * A code held by two controls (for example D-pad up and round A) gets one `keydown`, and its
 * `keyup` comes when the last of them is released.
 */
export function TouchPad({
  buttons,
  skin = DEFAULT_GAMEPAD_SKIN,
  disabled = false,
  onPress,
}: TouchPadProps) {
  const heldRef = useRef(new Map<string, Held>());
  const [down, setDown] = useState<ReadonlySet<string>>(new Set());
  const [ball, setBall] = useState({ x: 0, y: 0 });
  const stickPointer = useRef<number | null>(null);
  const repeatRef = useRef(new Map<string, RepeatTimer>());
  const joystick = usesJoystick(skin);

  const bySlot = useMemo(() => {
    const map = new Map<PadSlot, TouchButton>();
    for (const b of buttons) map.set(b.slot, b);
    return map;
  }, [buttons]);

  /** Sets the codes a control keeps down (empty = released) and sends only the key edges. */
  const setControl = useCallback(
    (id: string, pointerId: number, codes: string[]) => {
      const held = heldRef.current;
      const prev = held.get(id)?.codes ?? [];
      const heldElsewhere = (code: string) =>
        [...held].some(([other, h]) => other !== id && h.codes.includes(code));
      const timers = repeatRef.current;
      const repeats = REPEAT_IDS.has(id);
      for (const code of prev) {
        if (!codes.includes(code)) {
          const t = timers.get(`${id}:${code}`);
          if (t) {
            window.clearTimeout(t.timeout);
            window.clearInterval(t.interval);
            timers.delete(`${id}:${code}`);
          }
          if (!heldElsewhere(code)) sendKey("keyup", code);
        }
      }
      for (const code of codes) {
        if (prev.includes(code)) continue;
        if (!heldElsewhere(code)) sendKey("keydown", code);
        if (repeats) {
          const key = `${id}:${code}`;
          const t: RepeatTimer = {};
          t.timeout = window.setTimeout(() => {
            t.interval = window.setInterval(
              () => sendKey("keydown", code, true),
              REPEAT_INTERVAL_MS,
            );
          }, REPEAT_DELAY_MS);
          timers.set(key, t);
        }
      }
      if (codes.length) held.set(id, { pointerId, codes });
      else held.delete(id);
      if (id === STICK && !codes.length) setBall({ x: 0, y: 0 });
      setDown((s) => {
        if (s.has(id) === codes.length > 0) return s;
        const next = new Set(s);
        if (codes.length) next.add(id);
        else next.delete(id);
        return next;
      });
    },
    [],
  );

  const releaseAll = useCallback(() => {
    for (const id of [...heldRef.current.keys()]) setControl(id, 0, []);
  }, [setControl]);

  // Release everything when the pad is disabled (pause / game over).
  useEffect(() => {
    if (disabled) releaseAll();
  }, [disabled, releaseAll]);

  // The cross and the joystick are different controls: let go of everything when the kind changes.
  useEffect(() => {
    releaseAll();
  }, [joystick, releaseAll]);

  // Release on hidden page, lost focus and unmount.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") releaseAll();
    };
    const timers = repeatRef.current;
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("blur", releaseAll);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("blur", releaseAll);
      releaseAll();
      for (const t of timers.values()) {
        window.clearTimeout(t.timeout);
        window.clearInterval(t.interval);
      }
      timers.clear();
    };
  }, [releaseAll]);

  const handleDown = (
    e: ReactPointerEvent<HTMLButtonElement>,
    b: TouchButton,
  ) => {
    if (disabled || heldRef.current.has(b.slot)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setControl(b.slot, e.pointerId, [b.code]);
    onPress?.(b.code);
  };

  const handleUp = (
    e: ReactPointerEvent<HTMLButtonElement>,
    b: TouchButton,
  ) => {
    // Only the pointer that pressed this control may release it.
    if (heldRef.current.get(b.slot)?.pointerId !== e.pointerId) return;
    setControl(b.slot, e.pointerId, []);
    // A mouse click leaves focus on the button; Space (hard drop) would click it again.
    if (e.pointerType === "mouse") e.currentTarget.blur();
  };

  /** Held direction codes for a pointer position on the stick base, and where the ball goes. */
  const readStick = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const radius = rect.width / 2;
    const dx = e.clientX - (rect.left + radius);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const dist = Math.hypot(dx, dy);
    const scale = dist > 0 ? Math.min(dist, radius * STICK_TRAVEL) / dist : 0;
    const pos = { x: dx * scale, y: dy * scale };
    if (dist < radius * STICK_DEAD_ZONE) return { codes: [], pos };
    const sector =
      ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
    const codes: string[] = [];
    for (const slot of STICK_SECTORS[sector]) {
      const code = bySlot.get(slot)?.code;
      if (code && !codes.includes(code)) codes.push(code);
    }
    return { codes, pos };
  };

  const stickDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || heldRef.current.has(STICK)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const { codes, pos } = readStick(e);
    stickPointer.current = e.pointerId;
    setBall(pos);
    setControl(STICK, e.pointerId, codes);
    if (codes.length) onPress?.(codes[0]);
  };

  const stickMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (stickPointer.current !== e.pointerId || disabled) return;
    const { codes, pos } = readStick(e);
    setBall(pos);
    setControl(STICK, e.pointerId, codes);
  };

  const stickUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (stickPointer.current !== e.pointerId) return;
    stickPointer.current = null;
    setControl(STICK, e.pointerId, []);
    setBall({ x: 0, y: 0 });
  };

  /** A control that only decorates the panel (arcade skins): no action, no focus, no pointer events. */
  const renderDeco = (n: number) => (
    <span key={n} className={`tp-key tp-deco tp-d${n}`} aria-hidden="true">
      <span className="tp-face" />
    </span>
  );

  const renderKey = (slot: PadSlot) => {
    const b = bySlot.get(slot);
    const cls = `tp-key tp-${slot}`;
    const round = ROUND_SLOTS.includes(slot);
    const pill = PILL_SLOTS.includes(slot);
    // No action in this game: drawn, but dimmed, not focusable and deaf to pointers.
    if (!b) {
      return (
        <span key={slot} className={`${cls} is-inert`} aria-hidden="true">
          <span className="tp-face">{SLOT_GLYPH[slot]}</span>
        </span>
      );
    }
    return (
      <button
        key={slot}
        type="button"
        className={`${cls}${down.has(slot) ? " is-down" : ""}`}
        disabled={disabled}
        aria-label={b.label}
        data-code={b.code}
        onPointerDown={(e) => handleDown(e, b)}
        onPointerUp={(e) => handleUp(e, b)}
        onPointerCancel={(e) => handleUp(e, b)}
        onPointerLeave={(e) => handleUp(e, b)}
        onLostPointerCapture={(e) => handleUp(e, b)}
        onMouseDown={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="tp-face" aria-hidden="true">
          {round ? (
            <>
              <span className="tp-letter">{SLOT_GLYPH[slot]}</span>
              <span className="tp-cap">{b.label}</span>
            </>
          ) : pill ? (
            b.label
          ) : (
            b.label
          )}
        </span>
      </button>
    );
  };

  return (
    <div
      className={`touch-pad skin-${skin}`}
      role="group"
      aria-label="Touch controls"
    >
      {joystick ? (
        <div className="tp-dir">
          <div
            className={`tp-stick${down.has(STICK) ? " is-down" : ""}${disabled ? " is-disabled" : ""}`}
            role="group"
            aria-label="Joystick"
            onPointerDown={stickDown}
            onPointerMove={stickMove}
            onPointerUp={stickUp}
            onPointerCancel={stickUp}
            onLostPointerCapture={stickUp}
            onContextMenu={(e) => e.preventDefault()}
          >
            <span className="tp-stick-well" aria-hidden="true" />
            <span
              className="tp-ball"
              aria-hidden="true"
              style={{ transform: `translate(${ball.x}px, ${ball.y}px)` }}
            />
          </div>
        </div>
      ) : (
        <div className="tp-dpad">
          {renderKey("up")}
          {renderKey("left")}
          <span className="tp-hub" aria-hidden="true" />
          {renderKey("right")}
          {renderKey("down")}
        </div>
      )}
      <div className="tp-actions">
        {joystick && [1, 2, 3, 4].map(renderDeco)}
        {renderKey("a")}
        {renderKey("b")}
      </div>
      <div className="tp-pills">
        {renderKey("x")}
        {renderKey("y")}
      </div>
    </div>
  );
}
