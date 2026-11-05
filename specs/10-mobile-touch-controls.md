# SPEC 10 — Mobile touch controls

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 07, SPEC 08, SPEC 09
> **Date:** 2026-11-05
> **Objective:** Make the four real games (Asteroids, Tetris, Arkanoid, Snake) playable on a phone with touch controls: swipe for Snake, drag and tap for Arkanoid, and an on-screen button pad under the CRT for Tetris and Asteroids.

## Why this spec exists

Every real game reads only the keyboard (`keydown` / `keyup` on `window`), and Arkanoid also reads `mousemove` / `mousedown` on the canvas. A phone has none of these, so today the four real games cannot be played on mobile. Touch devices do not fire `mousemove` while dragging, so Arkanoid needs pointer events, not just a button pad.

The approach keeps the engines almost untouched:

- The button pad and the Snake swipe feed the existing keyboard handlers by dispatching synthetic `KeyboardEvent`s (with the same `code` values the engines already read) on `window`. Asteroids, Tetris and Snake engines need no input change.
- Arkanoid's mouse listeners become pointer listeners, which cover mouse, touch and pen.
- Haptics: engines only report event names through a new optional `onHaptic` callback (Arkanoid reuses `onSound("brick")`); `lib/haptics.ts` owns the patterns and the platform decides when to vibrate.

## Scope

**In:**

- Touch support for the 4 real games: `asteroids`, `tetris`, `arkanoid`, `snake`. Fake-simulation games are not touched (they have no input).
- Control style per game:
  - **Snake:** swipe on the canvas. A swipe of at least 24 px (screen pixels) in the dominant axis, measured from `pointerdown` to the current `pointermove`, triggers one direction change (`ArrowUp` / `ArrowDown` / `ArrowLeft` / `ArrowRight`); the origin resets after each trigger so a continuous finger path can turn several times.
  - **Arkanoid:** dragging a finger over the canvas moves the paddle (same mapping as `mouseX` today: `(clientX - rect.left) * (W / rect.width)`); a tap launches the ball.
  - **Tetris:** on-screen pad under the CRT with buttons `◀` `▶` (move), `▼` (soft drop), `⟳` (rotate), `DROP` (hard drop), `HOLD`, `SLOW` (slow fall, held).
  - **Asteroids:** on-screen pad with `◀` `▶` (rotate), `THRUST` (held), `FIRE`.
- New client component `components/touch-pad.tsx`: renders a list of buttons from a config; a button press dispatches `keydown` and a release dispatches `keyup` for its `code` on `window` (once per press, no auto-repeat events). Release also fires on `pointercancel`, `pointerleave` and when the page is hidden.
- New hook `components/use-swipe-controls.ts` that attaches the swipe detector to the canvas wrapper element of Snake and dispatches the synthetic arrow `keydown`.
- Registry: `GameDefinition` gets an optional `touch?: { pad?: TouchButton[]; swipe?: boolean }`. `TouchButton = { code: string; label: string; hold?: boolean; area: "left" | "right" }`. Only `tetris`, `asteroids` (pad) and `snake` (swipe) set it; Arkanoid's drag lives in its engine.
- `GamePlayer` renders `<TouchPad>` under the CRT for entries with `touch.pad`, only at viewport width below 768px (CSS media query `(max-width: 767px)`; the pad is `display: none` otherwise). The pad is disabled while the run is paused or over.
- Arkanoid engine: replace `mousemove` / `mousedown` with `pointermove` / `pointerdown` listeners (same handlers, typed `PointerEvent`); the canvas gets `touch-action: none`. Mouse behavior on desktop is unchanged.
- `touch-action: none` on the canvas of Snake, Arkanoid, Tetris and Asteroids, and on the pad buttons, so the page does not scroll or zoom while playing.
- Controls hint: on viewports below 768px the keyboard `controls-hint` is replaced by a short touch hint per game (for example `SWIPE · STEER` for Snake). The registry gets an optional `touch.hint: { keys: string[]; label: string }[]` for this.
- Visible CSS for the pad (`.touch-pad`, `.touch-btn`) in `app/globals.css`, designed with `/frontend-design` per `CLAUDE.md`. Buttons are at least 56 px tall, thumb-reachable, with a pressed state; the style matches the CRT / arcade look.
- Haptic feedback through `navigator.vibrate`, wrapped in a new framework-free helper `lib/haptics.ts` (`haptic(kind)`), which does nothing when `navigator.vibrate` is missing (for example iOS Safari) or when the user has `prefers-reduced-motion: reduce`. Events that vibrate:
  - Input events, driven by the platform:
    - `tap`, 10 ms: a pad button press (not on release), a Snake swipe turn, an Arkanoid launch tap.
    - `gameover`, pattern `[40, 60, 120]` ms: when `GamePlayer` receives `onGameOver`.
  - Engine events, user decision. Each engine reports them through a new optional `onHaptic(name)` callback, fired only from `update` (never while paused or after game over):
    - Arkanoid: `brick`, 15 ms, when a brick breaks. It reuses the existing `onSound("brick")` event, so the Arkanoid engine needs no extra callback; `bounce` does not vibrate (too frequent).
    - Tetris: `clear`, 25 ms, when 1 to 3 lines clear; `tetris`, pattern `[30, 40, 60]`, when 4 lines clear. New `onHaptic` callback in `lib/tetris/engine.ts`.
    - Asteroids: `split`, 20 ms, when an asteroid splits or is destroyed. New `onHaptic` callback in `lib/asteroids/engine.ts`.
    - Snake: `fruit`, 15 ms, when a regular fruit is eaten; `bonus`, pattern `[20, 30, 40]`, when the golden fruit is eaten. New `onHaptic` callback in `lib/snake/engine.ts`.
  - The vibration patterns live in one table in `lib/haptics.ts`. The `GameCanvasProps` type gets an optional `onHaptic?: (name: string) => void`, passed by `GamePlayer` to every real game canvas.
  - Haptics only fire from touch input, the game-over event and engine events while the on-screen touch UI is active (viewport below 768px and `navigator.vibrate` present), so desktop play never vibrates.
- Haptics on/off toggle: a `HAPTICS ON` / `HAPTICS OFF` button under the CRT, next to the mute and appearance buttons, in the same style. It is independent of the music / sound mute. It is rendered only on viewports below 768px and only when `navigator.vibrate` exists (checked in an effect after mount, so there is no hydration mismatch); on iOS Safari it never appears. Default is ON. State is in memory only (never `localStorage`), like mute and skin, and survives PLAY AGAIN but not a page reload.
- Update `CLAUDE.md` and `references/GAMES.md` (controls per game) with the touch controls and haptics.
- Verify at 375px and 390px width with Playwright using a touch-enabled context. Captures go to `.pwScreencaps/`.

**Out of scope (for future specs):**

- Touch controls for the 8 catalog-only games (no input to map).
- Persisting the haptics toggle between visits, and per-event intensity settings.
- Haptics for other engine events (power-ups, life lost, level up, ball bounce).
- A full-screen play mode, forced landscape or orientation lock.
- Customizable control layouts, left-handed mode, or control size settings.
- Gamepad support.
- A pad on viewports 768px and wider (tablets in landscape and touch laptops get no pad; Snake swipe and Arkanoid drag still work there because they are pointer-based).
- High-DPI scaling or a responsive playfield size change beyond what the CRT frame already does.
- Multi-touch gestures such as pinch zoom handling beyond blocking default browser actions.
- Changes to scoring, the GAME OVER flow, skins or music.
- Automated tests (no test runner is configured).

## Data model

Registry additions (`components/game-registry.tsx`):

```ts
export interface TouchButton {
  /** KeyboardEvent.code the engine already reads, e.g. "ArrowLeft", "Space", "KeyS". */
  code: string;
  label: string;
  /** Key stays down while the finger is down (move, thrust, soft drop, slow fall). Taps fire down then up. */
  hold?: boolean;
  area: "left" | "right";
}

export interface GameDefinition {
  // ...existing fields unchanged
  touch?: {
    pad?: TouchButton[];
    swipe?: boolean;
    /** Replaces `controls` in the hint under the CRT on viewports below 768px. */
    hint: { keys: string[]; label: string }[];
  };
}
```

Pad layouts:

| Game      | Left area (`area: "left"`)                            | Right area (`area: "right"`)                                          |
| --------- | ----------------------------------------------------- | --------------------------------------------------------------------- |
| Tetris    | `ArrowLeft` hold, `ArrowRight` hold, `ArrowDown` hold | `ArrowUp` (rotate), `Space` (DROP), `KeyS` (HOLD), `KeyC` hold (SLOW) |
| Asteroids | `ArrowLeft` hold, `ArrowRight` hold                   | `ArrowUp` hold (THRUST), `Space` hold (FIRE)                          |

Snake and Arkanoid have no pad. Snake sets `touch.swipe: true`; Arkanoid sets only `touch.hint` (`DRAG · MOVE`, `TAP · LAUNCH`).

Engine change (Arkanoid only):

```ts
// lib/arkanoid/engine.ts
this.canvas.addEventListener("pointermove", this.onPointerMove);
this.canvas.addEventListener("pointerdown", this.onPointerDown);
```

`onPointerMove` keeps the current `mouseX` math. `onPointerDown` keeps `launchBall()`. The `detachListeners` removes both.

Conventions:

- Synthetic events are `new KeyboardEvent("keydown", { code, key, bubbles: true, cancelable: true })` dispatched on `window`. The engines read `e.code` only. The engines' `preventDefault` calls are harmless on synthetic events.
- A held pad button sends exactly one `keydown` (no `repeat: true` events) and one `keyup`. Engines that already track held keys (Asteroids, Tetris, Arkanoid) keep working; the existing `e.repeat` guards are not triggered.
- Pad buttons use pointer events with `setPointerCapture`, so a finger that slides off a button still releases it cleanly. Each button tracks its own `pointerId`, so two buttons can be held at once (for example rotate + thrust).
- On `pause`, game over and unmount, every held pad button is released (`keyup`) so no key stays stuck in the engine.
- No new `localStorage` keys. No change to `lib/storage.ts`, scoring or Supabase.
- All UI text stays in English.

## Implementation plan

Before step 1, read the relevant guides in `node_modules/next/dist/docs/` as required by `AGENTS.md` only if a step touches pages or routing (this spec normally does not). Invoke `/frontend-design` for the pad and the touch hint, per `CLAUDE.md`.

1. **Registry types.** Add `TouchButton` and `touch?` to `GameDefinition` in `components/game-registry.tsx`, with no entries yet. `npm run lint` and `npm run build` pass; no behavior change.
2. **Touch pad component.** Create `components/touch-pad.tsx` (buttons from a `TouchButton[]`, pointer capture, synthetic `keydown` / `keyup`, release on cancel / leave / hidden / unmount) and `.touch-pad` / `.touch-btn` styles in `app/globals.css`, hidden at 768px and wider. Not wired to any game yet. `npm run build` passes.
3. **Haptics helper.** Create `lib/haptics.ts` with a pattern table and `haptic(name)` for `tap`, `gameover`, `brick`, `clear`, `tetris`, `split`, `fruit` and `bonus`: feature-detects `navigator.vibrate`, respects `prefers-reduced-motion`, never throws. `npm run build` passes; imports nothing from `react` or `next`.
4. **Wire the pad into `GamePlayer`.** Render `<TouchPad>` under the CRT for entries with `touch.pad`; disable it while paused or over; swap the keyboard hint for `touch.hint` below 768px. Own the `hapticsOn` state and render the `HAPTICS ON/OFF` button (below 768px, only if `navigator.vibrate` exists). Call `haptic("tap")` on each pad press and `haptic("gameover")` in the `onGameOver` handler, both skipped when `hapticsOn` is false. Check the button toggles and stops vibration. 5. **Engine haptic events.** Add the optional `onHaptic` callback to `GameCanvasProps` and to the Asteroids, Tetris and Snake engines and canvas wrappers (fired from `update`, once per event, never when paused or finished); map Arkanoid's `onSound("brick")` to `haptic("brick")` in `GamePlayer`. `GamePlayer` passes `onHaptic` to the canvas, routed through `hapticsOn`. Check each game at 375px with `navigator.vibrate` stubbed. Add the `tetris` and `asteroids` `touch` entries. Check at 375px: pad shows, Tetris moves / rotates / drops / holds, Asteroids rotates / thrusts / fires.
5. **Snake swipe.** Create `components/use-swipe-controls.ts` (threshold 24 px, dominant axis, origin reset after each trigger, `touch-action: none` on the target) and use it in the Snake canvas wrapper. Add the `snake` `touch` entry. Check: swipes steer, a short tap does nothing, a continuous zigzag swipe turns twice.
6. **Arkanoid pointer events.** In `lib/arkanoid/engine.ts` switch `mousemove` / `mousedown` to `pointermove` / `pointerdown`; set `touch-action: none` on the canvas; add the `arkanoid` `touch.hint` entry. Check: touch drag moves the paddle, tap launches, desktop mouse still works.
7. **Page scroll and zoom guard.** Confirm `touch-action: none` on every real-game canvas and pad button; the page does not scroll, pull-to-refresh or double-tap zoom during play. Fix any gap.
8. **Verification walkthrough.** With Playwright in a touch-enabled mobile context (`.pwScreencaps/` only): play each of the 4 games at 375px and 390px, pause and resume with a button held, trigger game over and SAVE SCORE with the on-screen keyboard open (`W` `A` `S` `D` must not trigger game keys while the input is focused). Re-check desktop (1280px): no pad, keyboard and mouse unchanged.
9. **Docs.** Update `CLAUDE.md` (touch field in the registry, `TouchPad`, `useSwipeControls`, Arkanoid pointer events, `lib/haptics.ts` and its iOS limitation, the 768px rule) and `references/GAMES.md` (controls per game). Run `npm run lint` and `npm run build`.

## Acceptance criteria

Generic:

- [ ] `npm run lint` and `npm run build` finish without errors.
- [ ] At 1280px width no touch pad is rendered visibly (`display: none`) and the keyboard hint shows; Asteroids, Tetris, Arkanoid and Snake play exactly as before with keyboard and mouse.
- [ ] At 375px width the touch hint replaces the keyboard hint for each real game.
- [ ] At 375px width there is no horizontal scroll on `/games/<id>/play` for the 4 real games, and the canvas keeps its ratio inside the CRT frame.
- [ ] While playing on a touch device, swiping or dragging on the canvas or pad does not scroll the page and a double tap does not zoom.
- [ ] PAUSE, RESUME, END, GAME OVER, SAVE SCORE and PLAY AGAIN work with touch on all 4 games.
- [ ] Pausing while a pad button is held releases the key: after RESUME the ship / piece does not keep moving.
- [ ] The pad is disabled (no input reaches the engine) while paused and after game over.
- [ ] Leaving the page (EXIT) while a pad button is held leaves no stuck key and no leftover listener from `TouchPad` or `useSwipeControls`.
- [ ] Typing a name in the GAME OVER input with the on-screen keyboard does not trigger game keys.
- [ ] No new `localStorage` keys; `lib/storage.ts` is unchanged; the Asteroids, Tetris and Snake engines change only by the optional `onHaptic` callback (no input change), and existing callbacks fire as before.
- [ ] `lib/` still imports nothing from `react` or `next`.
- [ ] All new UI text is English.
- [ ] Reloading `/games/tetris/play` at 375px shows no React hydration warning (the pad does not depend on `window` during render).

Game-specific:

- [ ] Snake: a swipe of at least 24 px steers the snake in the dominant axis; a swipe under 24 px does nothing; a swipe opposite to the current heading is ignored by the engine as today; there is no pad.
- [ ] Snake: one continuous finger path with two direction changes produces two turns on consecutive ticks.
- [ ] Arkanoid: dragging a finger across the canvas moves the paddle to the finger's horizontal position; a tap launches the ball; there is no pad.
- [ ] Arkanoid: on desktop the mouse still moves the paddle and a click still launches.
- [ ] Tetris: `◀` `▶` move the piece, holding them keeps moving it as the keyboard does; `⟳` rotates; `DROP` hard-drops once per tap; `HOLD` swaps once per tap; `SLOW` slows the fall while held; `▼` soft-drops while held.
- [ ] Asteroids: `◀` `▶` rotate while held; `THRUST` accelerates while held; `FIRE` shoots; rotate + thrust can be held at the same time (two fingers).
- [ ] Each pad button is at least 56 px tall at 375px width and shows a visible pressed state.

Haptics:

- [ ] Pressing a pad button calls `navigator.vibrate(10)` once per press and nothing on release (checked by stubbing `navigator.vibrate` in Playwright).
- [ ] A Snake swipe turn and an Arkanoid launch tap each call `navigator.vibrate(10)` once.
- [ ] GAME OVER calls `navigator.vibrate([40, 60, 120])` once per run.
- [ ] Breaking an Arkanoid brick calls `navigator.vibrate(15)` once; a ball bounce does not vibrate.
- [ ] Tetris: clearing 1 to 3 lines calls `navigator.vibrate(25)` once; clearing 4 lines calls `navigator.vibrate([30, 40, 60])` once.
- [ ] Asteroids: an asteroid split calls `navigator.vibrate(20)` once.
- [ ] Snake: eating a regular fruit calls `navigator.vibrate(15)` once; eating the golden fruit calls `navigator.vibrate([20, 30, 40])` once.
- [ ] No engine haptic fires while the game is paused or after game over.
- [ ] At 375px with `navigator.vibrate` present, the `HAPTICS ON` button shows under the CRT; clicking it switches to `HAPTICS OFF` and no call to `navigator.vibrate` happens afterwards (taps, engine events, game over); clicking again restores it.
- [ ] The haptics toggle is independent of the music / sound mute button.
- [ ] The haptics toggle is not rendered at 1280px width or when `navigator.vibrate` is undefined, and nothing is stored in `localStorage`.
- [ ] The toggle state survives PLAY AGAIN and resets on page reload.
- [ ] With `prefers-reduced-motion: reduce`, `navigator.vibrate` is never called.
- [ ] Keyboard and mouse input on desktop never call `navigator.vibrate`.
- [ ] When `navigator.vibrate` is undefined, no error is thrown and the games play normally.
- [ ] `lib/haptics.ts` imports nothing from `react` or `next` and adds no `localStorage` key.

## Decisions

- **Yes:** touch controls for all 4 real games, each with its best-fit style (swipe, drag, pad). User decision. Fake games have no input, so they are skipped.
- **Yes:** drive the existing keyboard handlers with synthetic `KeyboardEvent`s from the pad and the swipe. Keeps three engines free of input changes and avoids a second input path to maintain.
- **Yes:** Arkanoid moves from mouse events to pointer events. Touch drags do not fire `mousemove`, so a synthetic-key pad would only give clumsy left / right movement; pointer events give direct paddle positioning and keep the mouse working.
- **Yes:** portrait layout with controls under the CRT, no forced rotation. User decision.
- **Yes:** the pad shows only below 768px viewport width (CSS media query). User decision. Consequence: a tablet in landscape gets no pad for Tetris and Asteroids; accepted.
- **No:** `(pointer: coarse)` detection. Considered; user chose the width rule.
- **Yes:** haptic feedback, added by user request after the first draft. Patterns live in `lib/haptics.ts`; the platform decides when they play.
- **Yes:** haptics for engine events (brick hit, line clear, asteroid split, fruit eaten), added by user request. Engines only report a name through an optional `onHaptic`; they never call `navigator.vibrate` themselves, so they stay framework-free and silent. Arkanoid reuses `onSound("brick")`.
- **Yes:** a `HAPTICS ON/OFF` toggle, added by user request. Separate from the sound mute (different senses and different devices), in memory only like mute and skin, and hidden when vibration is unsupported so iPhone players do not see a dead button.
- **No:** persisting the toggle. Consistent with mute, skin and theme, which are in memory only.
- **Yes:** `prefers-reduced-motion: reduce` disables haptics regardless of the toggle.
- **No:** full-screen mode, landscape layout, left-handed layout, gamepad. Not requested; each can be its own spec.
- **No:** a pad for Snake and Arkanoid. Swipe and drag are more natural there and keep the screen uncluttered.
- **Yes:** swipe threshold 24 px with origin reset after each trigger, so quick consecutive turns work.
- **Yes:** pad buttons use pointer capture and per-button `pointerId`, so multi-touch (rotate + thrust) works and a finger sliding off a button still releases it.

## Risks

| Risk                                                                                                                  | Mitigation                                                                                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `navigator.vibrate` does not exist on iOS Safari and some browsers, so iPhone players get no haptics.                 | `haptic()` feature-detects and silently does nothing; the game stays fully playable; documented in `CLAUDE.md`.                                                                                                                    |
| Vibration on every pad press can annoy players.                                                                       | Only 10 ms pulses, on press only; the `HAPTICS OFF` toggle or `prefers-reduced-motion` disables it. Engine events are short and sparse (no bounce haptic).                                                                         |
| A held pad key stays down when the page is paused, hidden, loses focus or unmounts, so the ship keeps thrusting.      | `TouchPad` releases every held key on `pointercancel`, `pointerleave`, `visibilitychange` (hidden), pause, game over and unmount; criterion checks it.                                                                             |
| Engines ignore keys while paused, so a `keyup` sent during pause could be lost and leave a key stuck in the engine.   | The engines already clear held keys on `pause()`, `blur` and hidden visibility; `TouchPad` still sends `keyup` on release. A criterion checks resume after a held pause.                                                           |
| Synthetic events dispatched on `window` also reach the GAME OVER name input (`W` `A` `S` `D`).                        | The pad is disabled after game over and while paused, and the engines already remove or ignore key listeners then; the walkthrough types a name on a phone.                                                                        |
| iOS Safari still scrolls, bounces or zooms on touch despite `touch-action: none`.                                     | Apply `touch-action: none` on canvas and buttons, and `user-select: none` / `-webkit-touch-callout: none` on the pad; step 6 verifies; if needed call `preventDefault` in non-passive `touchmove` handlers on those elements only. |
| Tetris hold-to-repeat may not match touch (auto-repeat is handled by the engine's key state, not by `repeat` events). | Step 3 checks that holding `◀` `▶` repeats like the keyboard; if the engine relies on OS key repeat, tune the engine's move delay in a follow-up.                                                                                  |
| Tablets in landscape (768px and wider) get no pad for Tetris and Asteroids.                                           | Accepted by user decision; the width threshold is one CSS value and one constant, easy to change in a later spec.                                                                                                                  |
| Switching Arkanoid to pointer events changes mouse behavior on desktop.                                               | Same handlers and math; criterion checks mouse move and click on desktop.                                                                                                                                                          |
| Chrome DevTools or Playwright touch emulation differs from real devices.                                              | Walkthrough uses a touch-enabled context; real-device check is listed as a manual follow-up for the user.                                                                                                                          |

## What is **not** in this spec

- Touch controls for the 8 catalog-only games.
- Persisted haptics setting, other engine-event haptics, full-screen mode, landscape layout, orientation lock.
- Customizable or left-handed layouts, gamepad support.
- A pad on viewports 768px and wider.
- Changes to scoring, skins, music, sound effects or the GAME OVER flow.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
