# SPEC 12 — Game performance (Frogger first, all real games measured)

> **Status:** Approved
> **Depends on:** SPEC 05, SPEC 07, SPEC 08, SPEC 09, SPEC 10, SPEC 11 (and the Glowmaw and Frogger games, specified under `references/gameJam/`)
> **Date:** 2026-11-09
> **Objective:** Measure frame time in all six real games, find why Frogger drops frames (and whether the other games share the cause), and fix it so the average frame time stays under 16.7 ms at 1280px, cutting page-wide or CRT visual effects only where the measurement shows they are the cause.

## Why this spec exists

Playing Frogger shows low FPS and stutter. The same causes may hit the other games, because every game runs inside the same page shell. A first read of the code shows these candidates, none yet proven:

- Page-wide layers in `app/layout.tsx`: `.av-bg` (scrolling grid with `mask-image`, animated forever with `gridscroll`, plus a `mix-blend-mode: overlay` scanline layer) and `.av-noise` (a full-screen SVG `feTurbulence` image). They sit behind the game page and repaint or recomposite while the canvas redraws.
- CRT overlays in `app/globals.css`: `.crt-screen::after` uses `mix-blend-mode: multiply` and `.crt-screen::before` is a full radial gradient, both stacked on the canvas, so the browser blends the canvas on every frame.
- Frogger engine (`lib/frogger/engine.ts`): `draw()` repaints the whole background and every lane on every frame, even though the river, road and goal rows are static between lane movements.
- React: `GamePlayer` re-renders on every score, lives and level change, and runs the touch UI hooks. Cost is probably small, but it is not measured.

Rule for the whole spec: **no fix lands before a number says it is needed.** Step 1 measures, later steps fix only what the data blames.

## Scope

**In:**

- A repeatable Playwright measurement for the six real games (`asteroids`, `tetris`, `arkanoid`, `snake`, `glowmaw`, `frogger`) at 1280px, and for Frogger also at 375px (touch UI, pad on). It records average frame time, 95th percentile frame time and count of frames over 33 ms during a 10 second run, from `requestAnimationFrame` timestamps injected by Playwright (`browser_run_code_unsafe` or `browser_evaluate`). The script lives in `references/perf/measure-fps.md` as steps plus the snippet, not as app code.
- A baseline table, then an A/B table, in `references/perf/perf-log.md` (new file): one row per game and per experiment, with the numbers.
- Isolation experiments, each measured on Frogger and one other game (Tetris): (a) hide `.av-bg` and `.av-noise`; (b) hide the `.crt-screen::before` and `::after` overlays; (c) both; (d) neither (baseline).
- Fixes, in this order, each re-measured and kept only if it improves the numbers:
  1. Shared CSS causes the experiments prove: remove or simplify the effect, or disable it on `/games/<id>/play` only. The user allowed cutting the CRT scanline blend and vignette over the canvas, and the page-wide background (grid, noise, overlay scanlines). Prefer the least visible change: first remove `mix-blend-mode` and `mask-image` animation, then pause the grid animation on play pages, then drop the layer.
  2. Frogger engine: cache static drawing in an offscreen canvas (per skin, rebuilt in `setSkin()`), and avoid per-frame allocations in `draw()`, `advanceLanes` and `hitsVehicle` that the profile shows.
  3. The same engine-side fixes in any other game whose measurement misses the target and whose profile points to repeatable work, limited to that game's `lib/<game>/` folder.
  4. React: only if the trace shows long tasks from `GamePlayer` re-renders, memoize or isolate the HUD. Otherwise leave it.
- Skin independence: game performance and game output must be the same regardless of the selected skin. No fix may depend on, or change the result of, a particular skin. This is verified for every skin of every game whose files are touched, and always for all 7 Frogger skins (see the acceptance criteria).
- Update `CLAUDE.md` (the shared causes found and the rule that follows from them) and `references/GAMES.md` only if a game's behavior contract changes (it should not).
- Captures go to `.pwScreencaps/`.

**Out of scope (for future specs):**

- New visual redesign of the background or the CRT. This spec only removes or reduces.
- Moving rendering to WebGL, `OffscreenCanvas` in a worker, or `desiredFrameRate` style frame limiters.
- Changing game rules, speeds, scoring, skins, audio or the GAME OVER flow. Frame-rate independence of every engine is checked (a lower FPS must not change game speed) but not re-implemented.
- Bundle size, load time, Lighthouse scores and the non-game pages (`/`, `/library`, `/hall-of-fame`, `/about`).
- A permanent on-screen FPS counter or telemetry.
- Automated tests (no test runner is configured).

## Data model

No new data. No new types, tables or `localStorage` keys. Two new documents: `references/perf/measure-fps.md` and `references/perf/perf-log.md`.

Metrics recorded per run (documented in the perf log, not code):

| Metric       | Definition                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------- |
| `avgFrameMs` | Mean of `rAF` timestamp deltas over the 10 s window, first 1 s dropped                          |
| `p95FrameMs` | 95th percentile of the same deltas                                                              |
| `longFrames` | Number of deltas above 33 ms                                                                    |
| `scenario`   | game id, viewport, experiment id (`baseline`, `no-bg`, `no-crt-fx`, `no-bg-no-crt-fx`, `fix-N`) |

## Implementation plan

Before any UI change, invoke `/frontend-design` as `CLAUDE.md` requires, because step 3 touches visuals.

1. **Measure script and baseline.** Write `references/perf/measure-fps.md`. Run it for the six games at 1280px and for Frogger at 375px, on a clean `npm run build` served from `out/` (not `npm run dev`, which adds overhead). Start each run, wait 1 s, record 10 s, with a fixed key pattern for Frogger (hop up, wait, hop) so lanes and frog are active. Write the baseline table in `references/perf/perf-log.md`. No source change. Machine, browser version and CPU throttling (none, plus a 4x run for Frogger) are written at the top of the log.
2. **Isolation experiments.** Inject CSS in Playwright (`display: none` on the layers) for experiments (a), (b), (c) on Frogger and Tetris. Record the numbers. Conclude in the log which layer, if any, costs more than 2 ms per frame. No source change.
3. **Shared CSS fix.** Apply the smallest change the data supports in `app/globals.css` and, only if needed, `app/layout.tsx`. Candidates in order: drop `mix-blend-mode` from `.av-bg::after` and `.crt-screen::after` (use a plain translucent layer), stop animating `.av-bg::before` on play pages, remove `.av-noise` on play pages, remove the vignette gradient. Re-measure all six games. Skip this step with a written note if experiment (c) shows no gain.
4. **Frogger engine fix.** Profile Frogger with the Chrome performance trace through Playwright or the `rAF` delta script plus `performance.now()` marks around `update` and `draw`. Fix what shows up: offscreen cache of the static background (rebuilt on `setSkin()` and when goals change), no object or array allocation inside the loop, no `Array.find` per frame in `ride()` if it shows. Keep the engine contract (callbacks fire only on change, no module state, framework-free, no assets). Re-measure.
5. **Other engines.** For each of the other five games above target after step 3, repeat the profile and apply the same class of fix inside its `lib/<game>/` only. Games already within target are not touched.
6. **React check.** Record scripting time per frame from the trace on Frogger. If `GamePlayer` re-renders appear in long tasks, isolate the HUD. If not, write "no change" in the log.
7. **Regression walkthrough.** Playwright at 1280px and 375px: every real game starts, scores, pauses, resumes, ends, and PLAY AGAIN works. Skin switch still redraws at once, also while paused (Frogger, and the other games for any engine touched). Touch pad still works at 375px. Check the look of the page and the CRT in a screenshot before and after (`.pwScreencaps/`). Skin check: for every Frogger skin (and every skin of any other engine touched), record the canvas hash at fixed checkpoints with `requestAnimationFrame` frozen and a fixed `dt`, before and after the change, and measure frame time per skin.
8. **Docs and final numbers.** Fill the final column of the perf log. Update `CLAUDE.md` with the shared causes and the rule. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `references/perf/measure-fps.md` exists and another person can follow it to repeat a measurement.
- [ ] `references/perf/perf-log.md` has a baseline row for each of the six real games at 1280px and for Frogger at 375px, with `avgFrameMs`, `p95FrameMs` and `longFrames`.
- [ ] The log has isolation results for `no-bg`, `no-crt-fx` and `no-bg-no-crt-fx` on Frogger and Tetris, and states which layer(s) are the cause or that none is.
- [ ] After the fixes, Frogger at 1280px has `avgFrameMs` below 16.7 and `longFrames` at most 1 percent of frames in the 10 s window; the log shows the before and after numbers.
- [ ] After the fixes, each of the other five real games at 1280px has `avgFrameMs` below 16.7, or the log explains why (for example the display is capped) and no regression versus baseline.
- [ ] Frogger at 375px has `p95FrameMs` no worse than baseline and `longFrames` below 5 percent.
- [ ] Every visual effect removed or reduced is named in the log, with the measured gain that justified it. No effect is removed without a number.
- [ ] No change to game speed: the time Frogger takes for a car to cross the screen (lane speed in cells per second) is the same at 60 Hz and under 4x CPU throttling within 5 percent of game time, because `update` uses `dt`.
- [ ] All six real games still start, score, pause, resume, end and restart (PLAY AGAIN) at 1280px; skin switching still redraws at once, also while paused.
- [ ] Touch pad and haptics at 375px behave as in SPEC 10 and SPEC 11.
- [ ] Performance is the same regardless of skin: for every skin of Frogger (7) and of any other game whose files are touched, the average frame time under the same conditions differs by no more than 10 percent between skins and stays below 16.7 ms, and the log shows the per-skin numbers. Runs must use the same scroll position and viewport (clicking `SKIN` in Playwright scrolls the page and changes the cost, so scroll or size the viewport first).
- [ ] The output is the same regardless of the fix: with `requestAnimationFrame` frozen and a fixed `dt`, the canvas hash of every skin at each checkpoint is identical before and after the change.
- [ ] Any engine file touched keeps its contract in `CLAUDE.md`: framework-free, no module-level state, callbacks fire only on change.
- [ ] No new dependency, no new `localStorage` key, no change to `lib/scores-db.ts` or the Supabase schema.
- [ ] `npm run lint` and `npm run build` finish without errors, and a reload of `/games/frogger/play/` shows no hydration warning.

## Decisions

- **Yes:** measure first, then fix. The causes are guesses until the numbers exist; fixing a guess risks removing a good look for no gain.
- **Yes:** scope is all six real games for measurement and shared fixes, plus Frogger's engine. User decision. Engines of other games are edited only when they miss the target.
- **Yes:** the user allows cutting the CRT scanline blend, the CRT vignette and the page-wide background (grid, noise, overlay scanlines) if they cause the problem. **No** other visual cuts (game skins, canvas art, the CRT frame and bezel stay).
- **Yes:** the target is average frame time under 16.7 ms at 1280px, measured with Playwright and recorded before and after. User decision.
- **Yes:** measure on the static export from `out/`, not `next dev`, because dev mode adds overhead that hides the real cost.
- **Yes:** the measurement lives in `references/perf/` as a document, not in app code. **No** in-app FPS counter: it would ship to production for a one-time need.
- **No:** `OffscreenCanvas` in a worker or WebGL. Too large a change for a problem that is probably one expensive CSS layer plus uncached drawing.
- **No:** a frame limiter. It would hide the problem on 120 Hz screens and change the feel.
- **Yes:** the offscreen cache of static drawing is the first engine fix to try because Frogger redraws a full static background each frame.
- **Yes:** performance must be the same regardless of skin. User decision. Skins only change palettes and sprite filters, so a fix that helps one skin must help all, and a fix that changes the pixels of one skin is rejected. It is checked with per-skin frame time and frozen-clock canvas hashes, not by eye.

## Risks

| Risk                                                                                               | Mitigation                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The slowness depends on the user's GPU or browser and does not reproduce in Playwright's Chromium. | Record browser, GPU flag and throttling in the log. Run Frogger with 4x CPU throttling to widen differences. If the baseline already passes, ask the user for their browser and OS before changing anything. |
| `rAF` deltas in headless Chromium may be capped or jittery.                                        | Launch with a headed or `--disable-gpu-vsync` style option only if the tool allows it. Compare relative A/B numbers, not absolute ones.                                                                      |
| Removing a visual layer changes the look the user likes.                                           | Capture before and after screenshots. Prefer reducing (no blend, paused animation) over deleting. Ask before deleting a layer outright if the gain is under 2 ms.                                            |
| An offscreen cache goes stale when the skin or a goal slot changes.                                | Rebuild in `setSkin()` and when `goals` changes. Check by switching skins mid-run, also paused, and by filling a goal slot.                                                                                  |
| Engine edits break the engine contract.                                                            | Step 7 walkthrough plus the contract checks in the acceptance criteria.                                                                                                                                      |
| Fixes that depend on `dt` mask a real frame-rate coupling bug in some engine.                      | The game-speed criterion checks Frogger; any engine touched gets the same check.                                                                                                                             |

## What is **not** in this spec

- A redesign of the background or CRT, WebGL, workers, frame limiters.
- Changes to game rules, scoring, skins, audio, GAME OVER or the Supabase schema.
- Performance of non-game pages, bundle size or load time.
- A permanent FPS counter or telemetry.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
