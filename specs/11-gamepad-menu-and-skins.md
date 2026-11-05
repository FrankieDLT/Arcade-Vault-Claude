# SPEC 11 — GamePad menu and gamepad skins

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 07, SPEC 10
> **Date:** 2026-11-05
> **Objective:** Add a "GamePad" menu to the main nav bar, visible only on a game's play page, that turns the on-screen gamepad on or off (locked on below 768px) and switches its skin between neon (default, replaces the current pad), retro, 80s arcade and wood, with layouts that mimic the references in `references/gamepad-assets/`.

## Why this spec exists

SPEC 10 shipped an on-screen pad that exists only below 768px, as a row of plain rectangular buttons, with no way to hide it or change its look. This spec makes the pad a user-facing option at every width and gives it a visual identity per skin. The input path does not change: the pad still dispatches synthetic `keydown` / `keyup` on `window` with the `code` values the engines already read, so no engine is touched.

The references in `references/gamepad-assets/` are:

- `gamepad.html` + `gamepad-neon.png`: the neon pad (D-pad on the left, round cyan `B` and magenta `A` on the right, dark panel with a teal glow). This becomes the default skin.
- `gamepadRetro.png`: a console pad icon (light grey body, dark blue cross D-pad, small center pill, red and blue round buttons).
- `gamepad80s.png`: an arcade stick with a red flame panel, a ball-top joystick on the left, six round buttons in a cluster on the right and two small buttons on top.
- `gamepadWood.png`: an arcade stick on a walnut panel with maple stripes, a ball-top joystick, six round buttons in a cluster and two blue buttons on top.

## Scope

**In:**

- New menu `GamePad` in the main nav bar (`components/nav.tsx`), rendered only when the current route is `/games/<id>/play` **and** the game's registry entry has `touch.pad` (today `tetris` and `asteroids`). It is a button in the top bar at every width that opens a dropdown with:
  - An ON / OFF switch for the gamepad.
  - A list of the 4 skins as single-choice options (`Neon`, `Retro`, `80s Arcade`, `Wood`), the active one marked.
- Visibility rule for the pad:
  - Below 768px (`TOUCH_UI_QUERY`, the same query SPEC 10 uses): the pad is always shown. The switch is rendered as ON and disabled, with the helper text `Always on for touch screens`.
  - At 768px and wider: the pad is **hidden by default**. Turning the switch ON shows it under the CRT; OFF hides it again.
  - The width rule is evaluated live (`matchMedia` through `useSyncExternalStore`), so resizing across 768px switches behavior without a reload.
- Four skins, ids `neon`, `retro`, `arcade-80s`, `wood`. `neon` is the default and **replaces** the current `.touch-pad` / `.touch-btn` look. Skins change art and arrangement only; the actions each game exposes do not change per skin.
- A shared **slot model** so one game config renders in every skin (see Data model). Games map actions to slots; each skin decides where each slot is drawn.
- The arcade skins (`arcade-80s`, `wood`) draw a joystick for the four direction slots: a ball that follows the finger inside a circular base and sends held arrow keys by direction (8-way, diagonals hold two keys, dead zone at the center). The D-pad skins (`neon`, `retro`) draw a cross of four buttons.
- Cosmetic buttons: the arcade skins draw six round buttons plus two small ones, as in the references. Buttons without an action for the current game are drawn dimmed, are not focusable and receive no pointer events.
- All art is CSS (gradients, borders, shadows, SVG for icons), designed with `/frontend-design` per `CLAUDE.md`. The PNGs are references only and are **not** copied to `public/`.
- State lives in a new client context `GamepadProvider` mounted in `app/layout.tsx` next to `SessionProvider`, so `Nav` (which sits outside the page tree) and `GamePlayer` share it. State is `{ enabled: boolean; skin: GamepadSkinId }`, in memory only.
- `GamePlayer` renders `TouchPad` when `definition.touch.pad` exists **and** the effective visibility is true (touch UI, or `enabled` at wide widths). The pad stays disabled while paused or over (SPEC 10 behavior).
- The touch hint, the `HAPTICS ON/OFF` button and every other SPEC 10 rule keep their `max-width: 767px` condition. At wide widths with the pad ON, the keyboard hint keeps showing (the pad is an addition, not a replacement).
- Update `CLAUDE.md` (GamePad menu, provider, skins, slot model, the 768px rule) and `references/GAMES.md` (pad mapping per game).
- Verify with Playwright at 1280px, 768px, 767px and 375px. Captures go to `.pwScreencaps/`.

**Out of scope (for future specs):**

- Persisting the on/off choice or the skin between visits (no `localStorage`, no cookie). It resets on reload. User decision.
- A pad for Snake or Arkanoid, and for catalog-only games. The menu is not shown on their play pages.
- Per-game or per-user layout customization, left-handed mode, resizing the pad, button remapping.
- Shipping the reference PNGs or any third-party art, branding or logos (for example the Mortal Kombat panel).
- Real gamepad (Gamepad API) support.
- A pad on pages other than `/games/<id>/play`.
- Changing the 768px breakpoint, haptic patterns, engines, skins of the games, scoring or the GAME OVER flow.
- Automated tests (no test runner is configured).

## Data model

New file `lib/gamepad.ts` (framework-free, no `react` or `next` imports):

```ts
export type GamepadSkinId = "neon" | "retro" | "arcade-80s" | "wood";

export interface GamepadSkin {
  id: GamepadSkinId;
  label: string; // "Neon", "Retro", "80s Arcade", "Wood"
}

export const GAMEPAD_SKINS: GamepadSkin[] = [
  { id: "neon", label: "Neon" },
  { id: "retro", label: "Retro" },
  { id: "arcade-80s", label: "80s Arcade" },
  { id: "wood", label: "Wood" },
];

export const DEFAULT_GAMEPAD_SKIN: GamepadSkinId = "neon";

/** Positions every skin knows how to draw. */
export type PadSlot =
  | "up"
  | "down"
  | "left"
  | "right" // D-pad cross or joystick directions
  | "a"
  | "b" // main round buttons
  | "x"
  | "y"; // small buttons (center pills / top buttons)
```

Registry change (`components/game-registry.tsx`): `TouchButton` drops `area` and gains `slot`:

```ts
export interface TouchButton {
  code: string; // KeyboardEvent.code the engine already reads
  label: string; // text or icon shown on the button (also the accessible name)
  hold?: boolean; // key stays down while the finger is down
  slot: PadSlot;
}
```

Context (`components/gamepad-provider.tsx`):

```ts
interface GamepadState {
  enabled: boolean; // wide screens only; ignored below 768px
  skin: GamepadSkinId; // default "neon"
  setEnabled(v: boolean): void;
  setSkin(id: GamepadSkinId): void;
}
```

Pad mapping per game (D-pad / joystick directions are held keys, as the keyboard sends them):

| Slot    | Tetris                | Asteroids               |
| ------- | --------------------- | ----------------------- |
| `left`  | `ArrowLeft` hold, ◀   | `ArrowLeft` hold, ◀     |
| `right` | `ArrowRight` hold, ▶  | `ArrowRight` hold, ▶    |
| `down`  | `ArrowDown` hold, ▼   | none (drawn dimmed)     |
| `up`    | `ArrowUp`, ⟳ (rotate) | `ArrowUp` hold (thrust) |
| `a`     | `ArrowUp`, ⟳ (rotate) | `Space` hold, FIRE      |
| `b`     | `Space`, DROP         | `ArrowUp` hold, THRUST  |
| `x`     | `KeyS`, HOLD          | none (drawn dimmed)     |
| `y`     | `KeyC` hold, SLOW     | none (drawn dimmed)     |

`up` and `a` (Tetris) and `up` and `b` (Asteroids) send the same code on purpose: the D-pad keeps the keyboard meaning and the round buttons give a thumb-friendly duplicate. A held code is tracked once (`TouchPad` keeps one entry per code), so pressing both does not double-send.

Skin layout (drawing only):

| Skin         | Direction control                 | Round buttons                          | Small buttons (`x`, `y`)                  | Look (from the reference)                                          |
| ------------ | --------------------------------- | -------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------ |
| `neon`       | 4-button cross                    | `B` cyan, `A` magenta, glowing         | two small pills in the empty panel center | Dark panel, teal glow, uses page tokens `--cyan --magenta`         |
| `retro`      | dark blue plus-shaped cross       | red `A` and blue `B`, diagonal stagger | two short pills stacked in the center     | Light grey rounded body with thick dark outline, cable stub on top |
| `arcade-80s` | ball-top joystick on a round base | 6 round buttons, cluster of 2 rows     | 2 small buttons along the top edge        | Flame red-to-orange panel, black buttons with gold rings, bevel    |
| `wood`       | ball-top joystick on a round base | 6 round buttons, cluster of 2 rows     | 2 blue buttons along the top edge         | Walnut grain with two maple stripes, black buttons, soft shadow    |

In the arcade skins only `a` and `b` of the six cluster buttons are live; the other four are cosmetic. Slots with no action for the current game (`down` in Asteroids, `x` and `y` in Asteroids) are drawn dimmed and inert.

Conventions:

- Synthetic events, pointer capture, one `pointerId` per control and release-on-pause / cancel / hidden / unmount all stay as SPEC 10 defines them. The joystick is one more control: it holds up to two direction codes and releases both on pointer up, cancel, lost capture, `disabled`, hidden page, blur and unmount.
- CSS: skin class on the pad root (`.touch-pad.skin-neon`, `.skin-retro`, `.skin-arcade-80s`, `.skin-wood`). The old `display: none` at 768px and wider is removed from `app/globals.css`; visibility is decided in React. Every pad control keeps `touch-action: none`, `user-select: none` and `-webkit-touch-callout: none`.
- Minimum hit area: 56 px tall for every live button at 375px (SPEC 10 rule), including joystick base and D-pad arms.
- At 768px and wider the pad has a max width of about 520px and is centered under the CRT.
- All UI text is English. No new `localStorage` keys; `lib/storage.ts` is unchanged.

## Implementation plan

Before step 1, invoke `/frontend-design` for the menu and the four skins, per `CLAUDE.md`. Read `node_modules/next/dist/docs/` only if a step touches routing (it should not).

1. **Types and constants.** Create `lib/gamepad.ts` with `GamepadSkinId`, `GAMEPAD_SKINS`, `DEFAULT_GAMEPAD_SKIN`, `PadSlot`. Add `slot` to `TouchButton` and migrate the `tetris` and `asteroids` `pad` entries from `area` to `slot` using the mapping table; remove `area`. `TouchPad` still renders the old layout by grouping slots into the two former areas, so nothing visible changes. `npm run lint` and `npm run build` pass.
2. **Provider.** Create `components/gamepad-provider.tsx` (state `enabled` default `false`, `skin` default `neon`, in memory) and mount it in `app/layout.tsx` around the page tree. Add a `useTouchUi()` hook (the `matchMedia` + `useSyncExternalStore` logic that `game-player.tsx` already has, exported from one place and reused there). No visible change.
3. **Pad visibility in `GamePlayer`.** Render `TouchPad` when `definition.touch.pad` exists and (`touchUi || enabled`). Remove the CSS `display: none` at 768px and wider. At 1280px the pad is now hidden by default (not rendered); at 375px it is unchanged. Skin is not applied yet.
4. **Neon skin.** Rework `components/touch-pad.tsx` into a slot-based layout and add `.skin-neon` styles (cross, `B` / `A`, center pills, glow), replacing the old `.touch-btn` look. Pass `skin` to `TouchPad` from the provider. Check Tetris and Asteroids at 375px and at 1280px with the switch forced on: all keys still work.
5. **GamePad menu.** Create `components/gamepad-menu.tsx` (button + dropdown: switch and skin list, closes on outside click, `Esc` and route change, `aria-expanded`, keyboard operable) and render it in `Nav` only on `/games/<id>/play` for games whose registry entry has `touch.pad`. Below 768px the switch is ON and disabled with the helper text. Check: menu absent on `/`, `/library`, `/games/<id>` and on Snake / Arkanoid play pages.
6. **Retro skin.** Add `.skin-retro` styles and markup variant (plus-shaped cross, diagonal `A` / `B`, stacked pills). Skin list in the menu switches it live, also mid-run, without remounting the canvas or dropping held keys.
7. **Joystick control.** Add the joystick control to `TouchPad` (pointer capture, angle to direction, dead zone, up to two held arrow codes, release on every SPEC 10 event). Used by the two arcade skins only. Check: dragging to a corner holds two arrows; lifting releases both; pause releases.
8. **Arcade 80s skin.** Add `.skin-arcade-80s` (flame panel, joystick, six buttons with `a` and `b` live, two small top buttons).
9. **Wood skin.** Add `.skin-wood` (walnut grain and maple stripes in CSS, joystick, six buttons, two blue top buttons).
10. **Verification walkthrough.** Playwright at 1280, 768, 767 and 375px, captures in `.pwScreencaps/`: menu visibility per route, switch behavior per width, all 4 skins on Tetris and Asteroids, joystick, held key release on pause, no hydration warning on reload of `/games/tetris/play`, desktop keyboard play unchanged with the pad on and off.
11. **Docs.** Update `CLAUDE.md` and `references/GAMES.md`. Run `npm run lint` and `npm run build`.

## Acceptance criteria

Menu:

- [ ] The nav bar shows a `GamePad` button on `/games/tetris/play/` and `/games/asteroids/play/`, and does not show it on `/`, `/library`, `/games/tetris`, `/hall-of-fame`, `/about`, `/auth`, `/games/snake/play/` or `/games/arkanoid/play/`.
- [ ] Clicking `GamePad` opens a dropdown with an ON / OFF switch and 4 skin options; the active skin is marked; `Esc`, an outside click and a route change close it.
- [ ] The menu is reachable and operable with the keyboard (Tab, Enter / Space, arrow keys in the skin list).
- [ ] At 375px the switch is rendered ON and disabled, the helper text `Always on for touch screens` shows, and the pad is visible.
- [ ] At 1280px the pad is not rendered on first load; turning the switch ON renders it under the CRT; turning it OFF removes it.
- [ ] Resizing the window from 1280px to 767px shows the pad even if the switch is OFF; resizing back hides it again; no reload needed.
- [ ] At 768px exactly the touch rules are off (switch usable, pad hidden by default); at 767px they are on.
- [ ] The selected skin and the switch are lost on page reload (nothing in `localStorage`, `sessionStorage` or cookies); the default after reload is `neon`.
- [ ] Changing the skin while a run is active does not restart the game, does not drop the score and does not leave a held key stuck.

Skins and layout:

- [ ] The default skin is `neon` and no trace of the old rectangular `.touch-btn` look remains.
- [ ] `neon` shows a 4-button cross, round `B` (cyan) and `A` (magenta) and two center pills; `retro` shows a plus-shaped cross, red and blue round buttons and a center pill pair; `arcade-80s` and `wood` show a joystick, six round buttons and two small top buttons.
- [ ] Each skin renders for both Tetris and Asteroids with the actions in the mapping table; unmapped slots are dimmed, not focusable and ignore pointer input.
- [ ] Tetris with the pad: `left` / `right` move, `down` soft-drops while held, `up` and `a` rotate, `b` hard-drops once per tap, `x` holds once per tap, `y` slows the fall while held.
- [ ] Asteroids with the pad: `left` / `right` rotate while held, `up` and `b` thrust while held, `a` fires, rotate + thrust can be held together.
- [ ] Pressing `up` and `a` (Tetris) together sends one `keydown` for `ArrowUp`, not two, and one `keyup` when the last of the two is released.
- [ ] Joystick: dragging toward a diagonal holds two arrow keys; returning to the center releases both; lifting the finger releases all held keys.
- [ ] Every live control is at least 56 px tall at 375px width, and shows a visible pressed state in every skin.
- [ ] No horizontal scroll on `/games/<id>/play` at 375px with any skin.
- [ ] The pad is disabled while paused and after game over, and a held control is released when it becomes disabled.

Regressions and rules:

- [ ] Keyboard and mouse play at 1280px is unchanged with the pad OFF and ON.
- [ ] At 1280px with the pad ON the keyboard controls hint still shows and the `HAPTICS` button does not appear.
- [ ] At 375px the touch hint, the haptics toggle and the haptic patterns behave as in SPEC 10.
- [ ] Reloading `/games/tetris/play/` at 375px and at 1280px shows no React hydration warning.
- [ ] No engine file under `lib/asteroids/`, `lib/tetris/`, `lib/arkanoid/` or `lib/snake/` is changed.
- [ ] `lib/gamepad.ts` and `lib/` still import nothing from `react` or `next`.
- [ ] The reference PNGs are not copied to `public/` and the built site contains no third-party gamepad art.
- [ ] All new UI text is English.
- [ ] `npm run lint` and `npm run build` finish without errors.

## Decisions

- **Yes:** the pad hides by default at 768px and wider and the user turns it on from the menu. User decision: the keyboard stays the main input on desktop.
- **Yes:** below 768px the pad is forced on and the switch is locked. The menu says so, instead of hiding the switch, so the rule is visible.
- **Yes:** the breakpoint is the existing 768px (`TOUCH_UI_QUERY`). The first request said 700px, the user then chose to keep the SPEC 10 value, so the pad, hint and haptics all agree.
- **No:** persistence of the switch and skin. User decision: not in this scope; in memory only, like skin, mute and haptics today.
- **Yes:** the menu appears only for games that have `touch.pad` (Tetris, Asteroids). A menu with no effect on Snake and Arkanoid would confuse; they keep swipe and drag. Adding a pad to them is a separate spec.
- **No:** a pad for Snake or Arkanoid and a menu on fake games. User decision.
- **Yes:** the menu is a button in the top bar at every width, with a dropdown. It is not folded into the hamburger panel, so one component serves all sizes.
- **Yes:** a shared slot model (`up down left right a b x y`) so one game config renders in four skins. The alternative, a fixed button set per skin, would remove HOLD and SLOW from Tetris on some skins.
- **Yes:** the same game actions in every skin; skins change art and arrangement. User decision.
- **Yes:** neon centers the extra actions as small pills in the empty middle of the panel, since the reference only shows D-pad + `A` + `B`.
- **Yes:** `up` and `a` / `b` duplicate codes in the mapping so the D-pad keeps the keyboard meaning and round buttons stay thumb-friendly.
- **Yes:** the arcade skins use a real joystick control (angle to held arrow keys). A drawn stick that did nothing would break the "mimic the controls" goal. Cost: one new control type in `TouchPad`.
- **Yes:** four of the six arcade cluster buttons are cosmetic and inert, to match the references without inventing actions the games do not have.
- **Yes:** skins are drawn in CSS. **No:** using the PNGs as backgrounds: the 80s and wood files are photos of third-party products, the 80s one carries Mortal Kombat branding, and the photos do not scale to a touch pad.
- **Yes:** `neon` replaces the current look; the old styles are deleted, not kept as a fifth skin.
- **Yes:** the keyboard hint stays visible at wide widths when the pad is on.

## Risks

| Risk                                                                                                                      | Mitigation                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Nav` sits outside the game page, so it cannot share state with `GamePlayer` by props.                                    | A `GamepadProvider` context in `app/layout.tsx`; `Nav` reads the route and the registry (`getGameDefinition`) to decide whether to show the menu.                  |
| Hydration mismatch: the pad depends on `matchMedia`.                                                                      | Use `useSyncExternalStore` with a server snapshot of `false` (same pattern as `touchUi` today); the pad appears after hydration.                                   |
| The joystick sends two keys at once and a lost `pointerup` leaves one stuck.                                              | Pointer capture plus release on cancel, lost capture, `disabled`, blur, hidden page and unmount; the walkthrough checks a held diagonal during pause.              |
| Switching skin while a control is held changes the DOM under the finger.                                                  | Keep one `TouchPad` root and swap skin by class so the held element and its capture survive; if the markup must differ per skin, release all keys before the swap. |
| Wide screens: a mouse click on a pad button sends `keydown`, then the engine's `Space` key can re-click a focused button. | Pad buttons call `preventDefault` on pointerdown and blur after release (the game player already does this for SKIN).                                              |
| Photo-realistic skins (wood grain, flame) are hard to do in CSS and may look flat.                                        | Gradient layers and subtle SVG noise; accepted as stylized. A flat approximation is acceptable if it reads as the reference.                                       |
| Cosmetic buttons look tappable and frustrate users.                                                                       | Dimmed, inert, `aria-hidden`, `pointer-events: none`; the walkthrough checks they do nothing.                                                                      |
| The dropdown overlaps the CRT or the mobile nav at 375px.                                                                 | Anchor it to the button, max width of the viewport minus margins, and check at 375px in step 10.                                                                   |

## What is **not** in this spec

- Saving the on / off state or the skin between visits.
- A pad, or the menu, for Snake, Arkanoid or catalog-only games.
- Custom layouts, remapping, resizing, left-handed mode.
- Shipping the reference PNGs or third-party art.
- Changes to the 768px breakpoint, haptics, engines, game skins, scoring or GAME OVER.
- Gamepad API support.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
