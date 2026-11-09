# Mobile port log

| date | game | style | pad buttons | haptics | note |
| ---- | ---- | ----- | ----------- | ------- | ---- |
| 2026-11-09 | glowmaw | pad (directions only) | up, down, left, right (ArrowUp/Down/Left/Right, tap) | pearl 20, death [30,40,30], clear 25 | Real-device check pending. Cross in neon/retro skins, joystick in arcade-80s/wood. Direction is remembered by the engine, no hold needed. Final death vibrates `death` then `gameover` after the death animation. |
| 2026-11-09 | frogger | pad (directions only) | up, down, left, right (ArrowUp/Down/Left/Right, tap) | death [30,40,30], clear 25 | Real-device check pending. One hop per keydown; engine ignores repeat so pad auto-repeat is harmless. Final death vibrates `death` then `gameover`. Playwright smoke: loads, hops score +10, no console errors; blind first-row hops die often (traffic density, not a confirmed bug). |
