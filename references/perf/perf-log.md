# Performance log (SPEC 12)

## Environment

- Date: 2026-11-09
- Browser: Playwright Chromium, Chrome/156.0.0.0, Windows 11, headless-style pacing
- CPU: 24 logical cores, devicePixelRatio 1
- Build: `npm run build` static export, served from `out/` on a local Node server
- Run: 10 s window after a 1.5 s wait, `ArrowLeft` / `ArrowRight` every 500 ms
- Throttling: none (x1) and 4x CPU (x4) via CDP `Emulation.setCPUThrottlingRate`

How to repeat: `references/perf/measure-fps.md`.

## Step 1: baseline

`avgFrameMs`, `p95FrameMs` and `longFrames` come from `requestAnimationFrame` deltas. `taskMs` is main-thread task time per frame (CDP `TaskDuration`), `scriptMs` the JavaScript part of it.

| Game      | Viewport | CPU | avgFrameMs | p95FrameMs | longFrames | frames | taskMs | scriptMs |
| --------- | -------- | --- | ---------- | ---------- | ---------- | ------ | ------ | -------- |
| asteroids | 1280     | x1  | 10.00      | 10.1       | 0          | 1001   | 0.31   | 0.05     |
| tetris    | 1280     | x1  | 10.00      | 10.1       | 0          | 1000   | 0.34   | 0.05     |
| arkanoid  | 1280     | x1  | 10.00      | 10.1       | 0          | 1000   | 0.45   | 0.13     |
| snake     | 1280     | x1  | 10.00      | 10.1       | 0          | 1000   | 0.21   | 0.01     |
| glowmaw   | 1280     | x1  | 10.00      | 10.1       | 0          | 1000   | 0.39   | 0.09     |
| frogger   | 1280     | x1  | 10.00      | 10.1       | 0          | 1000   | 0.35   | 0.12     |
| frogger   | 1280     | x4  | 10.00      | 10.1       | 0          | 1000   | 1.75   | 0.67     |
| tetris    | 1280     | x4  | 10.00      | 10.1       | 0          | 1000   | 1.41   | 0.31     |
| frogger   | 375      | x1  | 10.00      | 10.1       | 0          | 1000   | 0.44   | 0.15     |
| frogger   | 375      | x4  | 10.00      | 10.1       | 0          | 1000   | 1.68   | 0.68     |

Layout time per frame was 0 in every run and style recalculation 0.02 to 0.11 ms.

## Step 1 reading

- Every row reads exactly 10.00 ms. That is the fixed rAF pacing of this headless Chromium (100 Hz), not a measured cost. Nothing exceeded 33 ms, so no frame was dropped.
- Main-thread work is small: 0.21 to 0.45 ms per frame at x1 and under 1.8 ms at x4. Frogger (0.35 ms) is in the same range as the other games, so no engine here stands out, and Frogger's JavaScript (`scriptMs` 0.12) is not heavy.
- The baseline therefore does **not** reproduce the reported low FPS. The suspected costs (blend modes, `mask-image` animation, full-screen noise, CRT overlays) are GPU and compositing work, and this setup cannot see it.
- Consequence for the plan: the SPEC 12 risk row applies. Step 2 experiments would compare identical 10.00 ms values and prove nothing. Real browser, GPU and OS details from the user are needed before any fix.

## Step 2: isolation experiments

### Why the setup changed

Step 1 in headless Playwright could not see GPU and compositing cost. Step 2 uses headed Chrome and Edge (the two most used browsers, both installed here) through `playwright-core`, 1280x800, 10 s window, same key pattern. Three configurations:

- `chrome-gpu` and `edge-gpu`: normal hardware rendering.
- `chrome-software`: Chrome with `--disable-gpu --disable-gpu-compositing`. This stands in for a low-end or integrated GPU, where full-screen blending is paid on the CPU. It is the only configuration that reproduced the reported stutter.

The experiments inject CSS after load: (a) `no-bg` hides `.av-bg` and `.av-noise`; (b) `no-crt-fx` hides `.crt-screen::before` and `::after`; (c) both.

### Results (avgFrameMs, fps, longFrames of ~940 at 10 ms)

| Config          | Game    | baseline          | no-bg (a)         | no-crt-fx (b)     | both (c)         |
| --------------- | ------- | ----------------- | ----------------- | ----------------- | ---------------- |
| chrome-gpu      | frogger | 10.00 / 100 / 0   | 10.00 / 100 / 0   | 10.00 / 100 / 0   | 10.00 / 100 / 0  |
| chrome-gpu      | tetris  | 10.00 / 100 / 0   | 10.00 / 100 / 0   | 10.00 / 100 / 0   | 10.00 / 100 / 0  |
| edge-gpu        | frogger | 10.00 / 100 / 0   | 10.00 / 100 / 0   | 10.00 / 100 / 0   | 10.00 / 100 / 0  |
| edge-gpu        | tetris  | 10.00 / 100 / 0   | 10.00 / 100 / 0   | 10.00 / 100 / 0   | 10.00 / 100 / 0  |
| chrome-software | frogger | 38.19 / 26.2 / 148 | 16.46 / 60.8 / 0  | 23.96 / 41.7 / 7  | 10.01 / 99.9 / 0 |
| chrome-software | tetris  | 33.14 / 30.2 / 74  | 12.29 / 81.4 / 0  | 25.24 / 39.6 / 14 | 10.00 / 100 / 0  |

p95 for `chrome-software` frogger baseline is 40.1 ms and p99 is 80 ms.

### Finer split (chrome-software, frogger only)

| Hidden or changed                                   | avgFrameMs | fps  | longFrames |
| --------------------------------------------------- | ---------- | ---- | ---------- |
| nothing (baseline)                                  | 38.19      | 26.2 | 148        |
| `.av-noise`                                         | 36.62      | 27.3 | 131        |
| `.av-bg::before` (scrolling grid with `mask-image`) | 17.79      | 56.2 | 0          |
| `.av-bg::before` animation off, grid kept           | 25.19      | 39.7 | 12         |
| `.av-bg::after` (overlay-blend scanlines)           | 24.32      | 41.1 | 6          |
| `.crt-screen::after` (multiply-blend scanlines)     | 25.27      | 39.6 | 11         |
| `.crt-screen::before` (vignette gradient)           | 35.98      | 27.8 | 112        |

### Reading

- With hardware rendering both browsers sit at the 100 Hz cap with every experiment, so the effects cost nothing measurable there. The problem shows when the machine rasterizes on the CPU: integrated GPUs with hardware acceleration off or blocklisted, remote desktops, some laptops on battery.
- On that path the page-wide background costs about 22 ms per frame in Frogger (38.19 to 16.46) and the CRT overlays about 14 ms (38.19 to 23.96). Together they are about 28 ms. Tetris behaves the same way (33.14 to 12.29 and 25.24), so the cause is shared by all games, not Frogger's engine.
- Layers over 2 ms: the scrolling grid `.av-bg::before` (animated, with `mask-image`), the overlay-blend scanlines `.av-bg::after`, and the multiply-blend scanlines `.crt-screen::after`. Each costs 12 to 20 ms alone.
- Layers under 2 ms: `.av-noise` (1.6 ms) and the vignette `.crt-screen::before` (2.2 ms, borderline). They are not worth removing for speed.
- Frogger's engine already costs 0.35 ms of script per frame (Step 1). Under software rendering `no-bg-no-crt-fx` reaches 10 ms, so the engine is not the limit yet. Step 4 stays conditional on a later profile.
- Caveat: `chrome-software` is a proxy. The user's real hardware is still unknown, so the fix in Step 3 is judged by this proxy and must not change how the page looks on GPU machines more than needed.

## Step 3: shared CSS fix

Changes in `app/globals.css` (only file touched by this spec):

1. `.crt-screen::after`: removed `mix-blend-mode: multiply`. Multiply with black is plain alpha, so the picture is identical.
2. `.av-bg::after`: removed `mix-blend-mode: overlay` and lowered the line alpha from 0.03 to 0.012. On the near-black page base the overlay lifted values by about 1%, so the look stays the same.
3. `body:has(.crt-screen) .av-bg::before { animation: none }`: on a play page (`.crt-screen` exists only in `GamePlayer`) the perspective grid stays visible but stops scrolling. Other pages keep the animation.

Kept: `.av-noise`, the vignette `.crt-screen::before`, the grid itself and its `mask-image` (each under or near 2 ms, see Step 2).

### Frame time with the fix (chrome-software, 1280x1100 so the whole CRT is visible, 10 s)

Viewport note: with an 800 px tall viewport part of the CRT is off-screen and the cost reads lower. 1100 px is the worst case and is used for the final numbers. Clicking `SKIN` in Playwright scrolls the page and moves a run from the short to the tall case, which is why a run after a skin click reads slower than the first run; it is not a skin effect (a retro run after 7 skin clicks was the same as any other skin).

| Game      | Before (old blend CSS) | After blends removed | After blends removed + grid held (final) |
| --------- | ---------------------- | -------------------- | ---------------------------------------- |
| frogger   | 42.31 ms (23.6 fps)    | 15.48 ms             | 12.70 ms (78.8 fps), p95 20.1            |
| tetris    | 42.20 ms (23.7 fps)    | 14.76 ms             | 10.16 ms (98.4 fps), p95 10.1            |
| asteroids | not run at this size   | not run              | 14.77 / 14.68 / 14.81 ms (3 runs)        |
| arkanoid  | not run at this size   | not run              | 14.17 / 14.27 ms                         |
| glowmaw   | not run at this size   | not run              | 14.68 / 15.18 ms                         |
| snake     | not run at this size   | not run              | 10.00 ms (100 fps)                       |

The first asteroids run read 17.05 ms; three repeats gave 14.7 to 14.8 ms, so that run was noise. At 1280x800 (blend fix only) all six games were at 11.9 to 14.1 ms, against 30.7 to 38.2 ms with the old CSS (asteroids 30.71, arkanoid 35.13, glowmaw 33.10, snake 14.27, frogger 38.19, tetris 33.14).

Hardware rendering (chrome-gpu, edge-gpu) was already at the 100 Hz cap with the old CSS, so there is no change there.

## Steps 4 and 5: engines

Not applied. After Step 3 every engine is under 16.7 ms and Frogger spends 0.12 ms of script per frame (Step 1). The rule of the spec is that no fix lands before a number asks for it, so `lib/frogger/` and the other `lib/<game>/` folders are untouched. If a later profile on real hardware shows draw cost, the first candidate remains an offscreen cache of Frogger's static background.

## Step 6: React

No change. Script time is 0.12 ms per frame in Frogger (0.67 ms at 4x CPU), there are no long tasks from `GamePlayer` re-renders, and layout time is 0.

## Step 7: regression walkthrough

Headed-equivalent Chrome (headless), real timers, 1280x1000 and 375x812 (touch context), all six real games. Per game: canvas present, no horizontal scroll, keyboard or pad input moves the HUD score, PAUSE freezes the canvas, a skin click while paused redraws at once (all six games have a skin button), RESUME, END opens GAME OVER, PLAY AGAIN resets the HUD to score 0 and full lives. Pad shown at 375 px for asteroids, tetris, glowmaw and frogger with a 56 px tall live button; no pad for arkanoid and snake. No console error, warning or page error other than the known `__next.*.txt` prefetch 404s, and none about hydration. All 24 checks passed.

### Same result for all skins

- Frogger, all 7 skins (retro, neon, pastel, gothic, negative, tide-poster, midnight-toll): with requestAnimationFrame frozen and a fixed dt, the canvas hash after 90 frames, after three inputs and after 120 more frames is identical before and after the CSS change (5 checkpoints x 7 skins). The canvas is not touched by the CSS, and the engine was not changed.
- Frame time per skin is the same: after a skin click all 7 skins read 18.6 to 19.6 ms in the short-viewport run, and a retro run after the same clicks read 18.8 ms. The skin has no effect on cost, so the fix helps all of them equally.
- Page look: before and after screenshots at 1280 (`.pwScreencaps/perf-before-frogger-1280.png`, `perf-after-frogger-1280.png`, plus tetris and the 375 case) look the same. Only the grid scroll stops on play pages.
- Game speed: with frozen rAF, 4 s of game time gives a pixel-identical Frogger canvas at 16, 20, 32 and 40 ms per frame, so game speed does not depend on frame rate.
- Other games: their engines are unchanged, and the canvas hashes were captured for Frogger only, since it is the only engine under test for sameness; the walkthrough shows each other game's skin switch still redraws.
