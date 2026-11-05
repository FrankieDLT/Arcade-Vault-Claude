# Analysis checklist

Use in phase 2 of `/add-game`. Fill the inventory from the code, not from the README. Note every README/code mismatch for the spec's Risks.

## Inventory of the source game

| Item              | What to record                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| Entry files       | HTML file, the script it loads, stylesheets, merge leftovers ignored                                            |
| Canvas            | Number of canvases, id, width x height (logical size), aspect ratio, extra canvases (next piece, minimap)       |
| Loop              | rAF or interval, `dt` units, `dt` cap, fixed or variable step                                                   |
| State             | Every top-level variable and where it resets (`init`, `reset`, `newGame`)                                       |
| Entities          | Each entity, its fields, `update` and `draw` logic, how it is created and removed                               |
| Constants         | Every tuned number (speeds, radii, timers, chances, sizes, drag). Copy values unchanged                         |
| Scoring           | Points table and formulas (combos, level multipliers, bonus). Max reachable score vs 10,000,000                 |
| Lives / levels    | Starting lives, how a life is lost, level rule, difficulty ramp, what carries between levels                    |
| Power-ups / modes | Each one: trigger, effect, duration, weight                                                                     |
| Game over         | Condition, what the game shows and does, restart key                                                            |
| Input             | Keys (`e.key` or `e.code`), mouse, touch, which keys call `preventDefault`, hold vs press, auto-repeat handling |
| Pause             | Existing pause key or menu and what it freezes                                                                  |
| Text              | Every user-facing string and its language (translate to English)                                                |
| Persistence       | Every `localStorage`/`sessionStorage` key and what it holds                                                     |
| Audio             | Files, when played, autoplay workaround                                                                         |
| Images            | Sprites, spritesheet loader, frame tables, filters/skins                                                        |
| DOM UI            | HUD elements, overlays, buttons, themes in HTML/CSS that the platform replaces                                  |
| Dependencies      | Anything global shared between files (for example `SPRITES`)                                                    |
| Own docs          | README, CLAUDE.md, its `specs/`: anything that records intent not visible in code                               |

## Source feature to platform handling

| In the source game                          | In Arcade Vault                                                                                                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Score / lines / level text on canvas or DOM | Platform HUD through engine callbacks (`onScore`, `onLives`, `onLevel`, or a mapped stat)                                                                                            |
| Lives icons                                 | Platform HUD hearts; no lives in the game: ask the user (hide or map)                                                                                                                |
| GAME OVER screen, final score               | Platform GAME OVER modal after `onGameOver(finalScore)`                                                                                                                              |
| Restart key (Space, Enter, R)               | Removed; PLAY AGAIN remounts the canvas                                                                                                                                              |
| Pause key / menu                            | Platform PAUSE button calls `pause()`/`resume()`; the source pause key may stay only if the user keeps it, and then it must not desync the platform's `paused` state (default: drop) |
| Own high score in `localStorage`            | Removed; SAVE SCORE writes to Supabase `scores` through `insertScore`                                                                                                                |
| Theme / skin / settings in `localStorage`   | Dropped by default; if kept, no new keys, so it must live in memory only                                                                                                             |
| Spanish text                                | English                                                                                                                                                                              |
| Sounds                                      | Out of scope unless the user opts in; if opted in, assets go to `public/game-assets/<id>/` and audio starts after first user input                                                   |
| Images / spritesheets                       | Copied to `public/game-assets/<id>/`, loaded by the engine, draw waits until loaded                                                                                                  |
| Extra canvas (next piece)                   | Drawn inside the main canvas, or a second canvas owned by the engine: ask the user                                                                                                   |
| Global variables                            | Engine instance fields                                                                                                                                                               |
| `document.addEventListener`                 | `window` listeners added in `start()`, removed in `destroy()`                                                                                                                        |
| Module-level `let` shared by functions      | Class fields; entities receive `ctx` and options as arguments                                                                                                                        |
| `Math.random` seeded generators             | Copy the generator unchanged; seed lives in the engine                                                                                                                               |
| Page `<title>`, favicon, body styles        | Dropped                                                                                                                                                                              |

## Placeholder matching

Compare the game against each catalog entry by genre (`cat`), title and `long` text. Known matches in the current catalog:

- Tetris-like -> `drop` (cover `cover-tetro`)
- Arkanoid / breakout -> `brick-buster` (cover `cover-bricks`)
- Asteroids -> `rocks` is a placeholder, but `asteroids` already exists (SPEC 05)

Re-check against the live `lib/games.ts`; this list can be outdated.

## Notes on the starter games (verify against the code)

- `02-asteroids`: already ported by SPEC 05 and SPEC 06. Use as the reference pattern.
- `03-tetris`: vanilla JS, one global script, 2 canvases (board and 120x120 next piece), Spanish UI, `localStorage` keys for records, theme and skin, themes and skins to decide on.
- `04-arkanoid`: 640x480 canvas, `dt` capped at 1/30 s, spritesheet (`assets/spritesheet.js`, `.png`) and 2 sounds, mouse click input, seeded level generator, power-ups, pause menu with level select, skins, own high score key, its own `specs/` folder with design intent.

## Score sanity

- Score must be an integer in 0 to 10,000,000 (`scores` CHECK constraint).
- Name length is limited to 10 by the platform, not by the game.
- Games with no score (pure survival time) need a defined score: ask the user.
