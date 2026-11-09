# Measuring frame time (SPEC 12)

How to repeat the frame-time measurement for the six real games: `asteroids`, `tetris`, `arkanoid`, `snake`, `glowmaw`, `frogger`.

## Setup

1. `npm run build` (static export into `out/`). Do not measure with `npm run dev`: dev mode adds overhead.
2. Serve `out/` with any static server that maps a folder to `index.html`. `python -m http.server` is not reliable on this Windows machine; a 20-line Node server works (`http.createServer`, serve `index.html` for directories).
3. Open `http://localhost:<port>/games/<id>/play/` with Playwright. A run starts by itself when the page loads.
4. Captures, if any, go to `.pwScreencaps/`.

## Procedure

For each scenario (game, viewport, optional CPU throttle):

1. Set the viewport (1280x800 for desktop, 375x812 for touch UI).
2. Load the play page, wait 1.5 s for the run to start.
3. Set the CPU throttle with CDP (`Emulation.setCPUThrottlingRate`, rate 1 or 4) after the page has loaded, and reset it to 1 afterwards.
4. Start the recorder in the page (below), then press `ArrowLeft` / `ArrowRight` alternately every 500 ms for 10 s. This keeps the frog safe on the start row while lanes, timer and the frog hop animation run. The other games get the same key pattern.
5. Read the result: `avgFrameMs`, `p95FrameMs`, `longFrames` (deltas above 33 ms), `taskMsPerFrame` (main-thread task time per frame, CDP `Performance.getMetrics` `TaskDuration`), plus script, layout and style time per frame.

The first second of rAF deltas is dropped.

## Recorder snippet

```js
// runs in the page; resolves with the rAF deltas in ms after 10 s
new Promise((res) => {
  const d = [];
  let last = 0;
  const t0 = performance.now();
  const f = (ts) => {
    if (last) d.push(ts - last);
    last = ts;
    if (performance.now() - t0 < 10000) requestAnimationFrame(f);
    else res(d);
  };
  requestAnimationFrame(f);
});
```

Per-frame CPU: call `cdp.send("Performance.getMetrics")` before and after the 10 s window, subtract, and divide by the number of frames.

## Known limits

- Playwright's headless Chromium here paces `requestAnimationFrame` at a fixed 10 ms (100 Hz), so `avgFrameMs` reads exactly 10 whenever the frame fits in 10 ms. It cannot show GPU, compositing or vsync cost. Use `taskMsPerFrame` for main-thread cost, and compare A/B runs only.
- CSS effects that cost GPU time (`mix-blend-mode`, `mask-image` animation, full-screen SVG noise) may be invisible in this setup. If the baseline passes, confirm on the user's real browser before removing anything.
