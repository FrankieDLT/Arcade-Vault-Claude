# CLAUDE.md

Guidance for Claude Code (claude.ai/code) in this repo.

## Project

Arcade Vault: online platform to play games and compete for high score. Spec-driven: `/spec` and `/spec-impl` (skills from `Klerith/fernando-skills`, install with `npx skills@latest add Klerith/fernando-skills`). README is Spanish. All UI text is English.

Specs in `specs/` (01 to 12, one per feature). `add-game` skill writes game specs, `/spec-impl` implements them.

## App state

Routes (App Router, `app/`): `/` home (`components/home.tsx`, data `lib/home.ts`), `/library`, `/games/[id]` (detail + leaderboard), `/games/[id]/play` (`GamePlayer`), `/hall-of-fame`, `/auth`, `/about` (About + contact form), `not-found.tsx`.

- Contact form: `components/contact-form.tsx` validates with `lib/contact.ts`, calls Supabase Edge Function `contact` (`supabase/functions/contact/index.ts`). Honeypot, rate limit, Resend sending live in the function. No Next API route: site is static export.
- Auth is mock. `components/session-provider.tsx` keeps name-only `SessionUser` in `localStorage` (`av_user`, via `lib/storage.ts`, in-memory fallback). Supabase Auth unused.
- Catalog: `GAMES` in `lib/games.ts` (14 entries). Which are real and which catalog-only: `references/GAMES.md`.

## Commands

`npm run dev`, `npm run build`, `npm start`, `npm run lint`. Prettier configured (`.prettierrc.json`). No test runner.

## Next.js warning

Next 16.4.4 / React 19.3. APIs differ from training data. Per `AGENTS.md`, read relevant guide in `node_modules/next/dist/docs/` (`01-app`, `02-pages`, `03-architecture`, `04-community`) before writing Next code. Heed deprecations. `next dev` re-adds AGENTS.md block itself.

## Configuration

- `next.config.ts`: `output: "export"` (GitHub Pages), `trailingSlash`, unoptimized images, `basePath` from `NEXT_PUBLIC_BASE_PATH` (empty locally). `cacheComponents` and `partialPrefetching` OFF: export fails with `PPR cannot be enabled in export mode`. `experimental.agentFeedback` on. No server: no route handlers, cookies, server actions, `proxy.ts`.
- Tailwind v4 via Turbopack rule (`@tailwindcss/turbopack` on `*.css`), not PostCSS.
- Path alias `@/*` = repo root, not `src/`. Routes in root `app/`.
- Performance (spec 12): full-screen CSS blends are main frame-time cost without GPU raster (30-40 ms/frame old CSS, 10-15 ms after). Do NOT add `mix-blend-mode`, animated `mask-image` or full-screen animated layers over or behind game canvas. Use plain alpha (multiply with black = alpha). Scrolling grid `.av-bg::before` held still on play pages (`body:has(.crt-screen)`). Measure with `references/perf/measure-fps.md` (software render `--disable-gpu --disable-gpu-compositing`; Playwright default headless cannot show it). Results: `references/perf/perf-log.md`. Engines unchanged.
- Supabase client: `getSupabase()` in `lib/supabase/client.ts` (lazy singleton, `createBrowserClient` from `@supabase/ssr`). Client components only. Throws naming the variable when `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` empty. Both in `.env` (see `.env.example`), inlined at build: restart `npm run dev` after edit. No server client, `proxy.ts`, service role key. Returns `SupabaseClient<Database>`; `lib/supabase/database.types.ts` is generated (MCP `generate_typescript_types`), never hand-edited.
- Database: `games` (14 rows: 9 original + `tetris`, `arkanoid`, `snake`, `glowmaw`, `frogger`, each added by an `add_<id>_game` migration) and `scores` (`game_id` FK to `games`, `name` 1-10 chars, `score` 0-10,000,000). RLS on: public select on both, anonymous insert on `scores`, no update/delete. Schema in `supabase/migrations/` (file name = applied version). Apply new ones with MCP `apply_migration`, then regenerate types.
- Catalog sync: `GAMES` in `lib/games.ts` is UI source. `games` table is manual copy. New game needs migration inserting its `games` row, else score insert fails on FK. Every real game follows this. Migration file carries the version `apply_migration` assigned, not the spec's proposal. Keep every field identical to `GAMES` entry, including `cover`.
- Score flow: `lib/scores-db.ts` has `fetchTopScores`, `fetchLatestScores`, `fetchTopScoresSince`, `insertScore` (client only). SAVE SCORE in `components/game-player.tsx` calls `insertScore` (anonymous, free-text name). No mock scores. `useTopScores` in `components/leaderboard.tsx` (used by `Leaderboard`, `HallOfFame`) returns Supabase rows + `status` (`loading` / `ready` / `error`). `BestScore` (`components/best-score.tsx`) shows top score per game (`—` when none). `LiveActivity` (`components/home/live-activity.tsx`) feeds home LATEST SCORES and TOP PLAYERS · TODAY. `lib/storage.ts` (`av_scores`) no longer used for scores.
- Deployment: `.github/workflows/deploy-pages.yml` builds on push to `master`, publishes `out/` to https://frankiedlt.github.io/Arcade-Vault-Claude/ with `NEXT_PUBLIC_BASE_PATH=/Arcade-Vault-Claude` and repo secrets `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Pages source must be "GitHub Actions", not "Deploy from a branch" (serves README). `next/link` adds basePath itself. Raw URL strings (audio, images) must use `withBasePath()` from `lib/base-path.ts`. Test locally: build with `NEXT_PUBLIC_BASE_PATH=/Arcade-Vault-Claude`, serve `out/` under that folder. Edge Function `contact`: `verify_jwt: false`, CORS limited to Pages origin and localhost:3000, called through `getSupabase().functions.invoke`. Secrets `RESEND_API_KEY`, `CONTACT_TO_EMAIL` set in Supabase Dashboard. Next prefetch of `__next.*.txt` logs harmless 404s on static hosts.

## Games

Real games: `references/GAMES.md` (keep updated when a game is added). Other catalog games run fake simulation (random score timer, fake arena) in `components/game-player.tsx`.

New real game = engine in `lib/<game>/`, canvas wrapper, registry entry, `games` migration. Pipeline: `/full-game-impl`.

### Registry and player

- `components/game-registry.tsx` maps `gameId` to `GameDefinition`: `Canvas`, `controls` (hint under CRT), `stats` (which of lives / lines / level HUD shows), optional `music`, `appearance`, `sfx`, `levelSelect`, `linesLabel`, `touch`. `getGameDefinition(gameId)` returns `undefined` for fake games.
- `GamePlayer` renders `<Canvas key={runId} />` instead of `.game-arena`. Passes only callbacks of stats the definition uses (`GameCanvasProps`: `paused`, `endSignal`, `onScore`, `onGameOver`, optional `onLives`, `onLevel`, `onLines`, `skin` (string id), `theme`, `onSound`, `levelRequest`). LINES or LIVES share one HUD slot. `linesLabel` replaces `Lines` (e.g. `Length`). Level slot hidden only when `stats.level === false`. PLAY AGAIN bumps `runId`: fresh engine.

### Engine rules (all games)

- Engine in `lib/<game>/` (`constants.ts`, `utils.ts`, `entities.ts`, `engine.ts`). Framework-free: no `react` or `next` imports, no module-level game state.
- Contract: `new XEngine(canvas, callbacks, { skin?, theme? })`, then `start()`, `pause()`, `resume()`, `end()`, `destroy()`, plus `setSkin()` (redraws at once, also paused or after game over). Some add `setTheme()`, `setLevel()`.
- Callbacks fire only on change. `start()` fires initial values (typically 0, 3, 1). `onGameOver` fires once per run, then loop and listeners stop. Score clamped to 10,000,000.
- Canvas draws playfield only (plus in-game timers). Score, lives, level, PAUSED, GAME OVER belong to platform HUD and modal.
- Keys via `e.code`. `P` and `Esc` do nothing: pause is platform button.
- Wrapper `components/<game>-canvas.tsx`: creates engine once in effect, destroys on cleanup. Narrows `skin` string with guard, falls back to default.
- Canvas scaled by CSS. Sizes: asteroids, snake, glowmaw 800x600; tetris 440x600; arkanoid 640x480; frogger 640x560. Non-4:3 canvases use `object-fit: contain`.
- Engines never play sound or vibrate. They emit `onSound(name)`, `onHaptic(name)`. Platform decides.

### Per-game notes

- Asteroids: `AsteroidsEngine`, callbacks `onScore onLives onLevel onGameOver`. Skins `retro neon pastel gothic negative amber-crt deep-sea` (palettes in `SKINS`; `neon`, `amber-crt` add canvas glow). Wrapper props: `paused`, `endSignal` (increment calls `end()`), callbacks. Haptic `split`.
- Tetris: `TetrisEngine`, callbacks `onScore onLines onLevel onGameOver`, `start()` fires 0, 0, 1. Canvas: board 300x600 left, 120-wide NEXT / HOLD column right. Random pieces (no bag), hold `S`, slow fall `C`, ghost. Score `[0,100,300,500,800] * level`, level `1 + floor(lines / 10)`. `Space` and `S` ignore `e.repeat`. Skins `retro neon pastel gothic negative woodshop ice-cavern pixel` + themes `dark` / `light` (canvas only; per-theme colors from `getThemeColors(skin, theme)`, `SKIN_THEME_OVERRIDES` in `constants.ts`). `neon` colors = page tokens `--cyan --yellow --magenta --green --bronze --silver --gold`. Haptics `clear`, `tetris`.
- Arkanoid: `ArkanoidEngine`, callbacks add `onSound("bounce" | "brick")` (only from `update`). 6x10 wall of 64x32 bricks, ball 320 px/s (+5% per level, cap 2x), endless levels from seeded `generateLevel(level)`, sub-stepped ball (`MAX_STEP = 8`). Power-ups (10% drop): Triple ball, Complete bar (10 s), Frenzy (2x speed, 10 s). Input: `←` `→` / `A` `D`, pointer on canvas (mouse, touch, pen), `Space` or click/tap launches. `setLevel` clamps 1..99, ignored after game over. Explosions use engine clock: freeze while paused. Skins `retro pastel neon` = CSS filters on spritesheet `public/game-assets/arkanoid/`. Sheet load fail: flat shapes + one console error. Extra wrapper props `onSound`, `skin`, `levelRequest`. Haptics reuse `onSound("brick")`.
- Snake: `SnakeEngine`, callbacks `onScore onLength onGameOver`, `start()` fires 0, 3. 20x15 grid of 40 px cells, starts length 3, ticks at `min(16, 8 + 0.4 * fruitsEaten)`/s, no levels or lives. Fruit +10, grows 1, 22 sprites in `FRUIT_SPRITES`, never same twice. Golden bonus: 15% after each fruit, +50, 6 s, blinks last 2 s. Walls and body kill; entering the cell the tail leaves is allowed; full grid (300) ends run. 2-slot direction queue (no duplicates, no 180 turns). `keydown` only. Wrapper: `onLength` arrives as `onLines` prop. Registry `stats: { lives: false, lines: true, level: false }`, `linesLabel: "Length"`. Skins `retro neon pastel gothic negative lcd-brick magma` (palettes + CSS filter on fruit sprites). Art `public/game-assets/snake/fruits.png`; load fail: flat circles + one console error. Haptics `fruit`, `bonus`.
- Glowmaw: `GlowmawEngine`, callbacks `onScore onLives onLevel onGameOver`. No assets: canvas shapes. 19x15 grid of 40 px cells at origin (20, 0), one maze `MAZE_A` (135 motes, 4 pearls, den, warp on row 7), pre-rendered to offscreen canvases per skin. Moves 5.5 tiles/s, remembered direction applied at next tile center (180 reversal at once), sub-steps max 8 px. Gulp streak: cell eaten within 0.6 s of previous extends it, mote multiplier `min(5, 1 + floor((n - 1) / 10))`, pearls flat 50. Drifters Hunter, Mirror, Roamer (+ Pacer from level 4). Pearl dazes them `max(2, 6 - 0.4 * (level - 1))` s, chain 100/200/300/400. 3 lives, extra life at 10,000 then every 40,000 (max 5), reef clear +1000. `keydown` only. `setLevel` restarts reef, keeps score and lives, clamps 1..99. Listeners removed on game over: key, `blur`, `visibilitychange`. Draws streak ring and `x2`..`x5` tag. Registry: `stats { lives, level }`, skins `abyss retro neon pastel gothic negative coral sunken-ruin paper-lantern` (`themes: false`), `levelSelect { min: 1, max: 99 }`. Haptics `pearl`, `death`, `clear`.
- Frogger: `FroggerEngine`, callbacks `onScore onLives onLevel onGameOver onHaptic?`. 16x14 grid of 40 px cells: row 0 five goal slots (cols 1-2, 4-5, 7-8, 10-11, 13-14), rows 1-6 river, row 7 median, rows 8-12 road, row 13 start. Lanes loop on 20 cells (`LANE_TEMPLATES`, cells/s, +15% per level). One hop per key press (arrows / WASD, `e.repeat` ignored, one buffered press), 120 ms. Deaths: vehicle, water, turtle dive, river edge, occupied slot, timer (15 s, -1 s per level, min 8 s). 3 lives. Draws round time bar. Skins `retro neon pastel gothic negative tide-poster midnight-toll` (`themes: false`; `negative` = computed inverse of retro, some fields nudged for 3:1). No `appearance` or `levelSelect` yet. Haptics `death`, `clear`. Spec: `references/gameJam/frogger/01-frogger-core.md`.

### Appearance, audio, level select

- Skins and themes: registry `appearance: { skins: { id: string; label }[], themes }` opts in. `GamePlayer` then owns `skin` (init from `skins[0].id`) and `theme` state (defaults `retro` / `dark`, memory only, never `localStorage`) and renders SKIN and THEME buttons (`.appearance-row`) under CRT. Themes apply to canvas only.
- Music: registry `music: { src, volume }`. `components/use-background-music.ts` (`useBackgroundMusic(music, { active, muted, restartKey })`) owns one looping `HTMLAudioElement` per mount. Plays while run active and not muted. Blocked autoplay retried once on first key press or click. Tetris: `public/game-assets/tetris/korobeiniki.mp3`, volume 0.2 (third-party: confirm license before public release).
- Mute button shows only for entries with `music` or `sfx`. Label `MUSIC ON/OFF` if `music`, else `SOUND ON/OFF`. One shared `muted` state, memory only.
- Sound effects: registry `sfx: { sounds: Record<string, url>, volume }`. `components/use-sound-effects.ts` (`useSoundEffects(sfx, { muted })`) returns stable `play(name)`, plays `cloneNode()` of lazy `Audio` so hits overlap, nothing while muted. `GamePlayer` passes `onSound` only to entries with `sfx`.
- Level select: registry `levelSelect: { min, max }`. While paused, overlay shows `LEVEL − NN +` (`.level-select`). Each click sets `levelRequest = { level, id }` (new `id` per click, reset by PLAY AGAIN); wrapper calls `engine.setLevel(level)`. Score and lives kept.
- Third-party assets (Tetris music, Arkanoid sheet, Snake fruits): confirm licenses before public release.

### Touch, gamepad, haptics (specs 10, 11)

- Registry `touch: { pad?: TouchButton[], swipe?, hint }`. `TouchButton = { code, label, hold?, slot: PadSlot }`. `PadSlot` (from `lib/gamepad.ts`) = `up down left right a b x y`. A code may sit in two slots (Tetris `up` and `a` both `ArrowUp`). Real games with `pad`: Tetris, Asteroids, Glowmaw, Frogger. Snake: `swipe`. Arkanoid: `hint` only.
- Touch UI (hint, haptics, forced-on pad) active only below 768px. Keep `TOUCH_UI_QUERY` in `components/use-touch-ui.ts` and `@media (max-width: 767px)` rules in `app/globals.css` in sync.
- `components/touch-pad.tsx` (`TouchPad`: `buttons`, `skin`, `disabled`, `onPress`): each press sends one synthetic `keydown` on `window` (same `code` engines read), each release one `keyup`. Engines have no touch-specific input. Pointer capture + one `pointerId` per control = multi-touch. Releases held keys on pointerup / cancel / leave / lost capture, hidden page, blur, `disabled` (pause, game over), cross/joystick change, unmount. Code held by two controls: one `keydown`, one `keyup` (when last released). Direction controls auto-repeat: after `REPEAT_DELAY_MS = 167` send `keydown` with `repeat: true` every `REPEAT_INTERVAL_MS = 33`, until release. Timers per control and code. Action buttons (A B X Y) never repeat.
- GamePad menu: `components/gamepad-menu.tsx`, top-bar button + dropdown (ON/OFF switch, 4 skins; closes on `Esc`, outside click, route change; typed keys do not reach game). `Nav` renders it only on `/games/<id>/play` when `getGameDefinition(id)?.touch?.pad` exists. State in `GamepadProvider` (`components/gamepad-provider.tsx`, mounted in `app/layout.tsx`, read with `useGamepad()`): `{ enabled, skin }`, memory only, default `false` / `neon`. Below 768px pad always shown, switch ON and locked (`Always on for touch screens`). At 768px+ pad hidden until switch ON; keyboard hint stays. `GamePlayer` renders `TouchPad` when `touch.pad` exists and (`touchUi || enabled`). `useTouchUi()` uses `matchMedia` through `useSyncExternalStore`.
- Gamepad skins: `lib/gamepad.ts` (framework-free): `GamepadSkinId` (`neon` default, `retro`, `arcade-80s`, `wood`), `GAMEPAD_SKINS`, `PadSlot`, `usesJoystick(skin)`. Pure CSS on `.touch-pad.skin-<id>` (`app/globals.css`; PNGs in `references/gamepad-assets/` not shipped). Markup: `.tp-dpad` (cross: `up left hub right down`) or `.tp-dir > .tp-stick` (joystick) | `.tp-actions` (`a`, `b`, plus four inert `.tp-deco` in arcade skins) | `.tp-pills` (`x`, `y`). Unmapped slot: dimmed, `aria-hidden`, not focusable, no pointer events. Joystick (arcade skins): pointer angle to 8 sectors, 28% dead zone, up to two arrow codes, only sends codes of mapped direction slots. Live controls at least 56px tall.
- `components/use-swipe-controls.ts` (`useSwipeControls(ref, { enabled, onSwipe })`, used by `snake-canvas.tsx`): 24 px swipe in dominant axis sends synthetic arrow `keydown`/`keyup`. Origin resets after each trigger. Touch and pen only (mouse ignored). `touch-action: none` on target.
- Arkanoid listens to `pointermove` / `pointerdown` on canvas: drag moves paddle, tap launches. All canvases and pad have `touch-action: none` in CSS. Controls hint rendered twice for entries with `touch` (`.controls-hint-keys`, `.controls-hint-touch`), CSS swaps them.
- Haptics: `lib/haptics.ts` (framework-free) owns `HAPTIC_PATTERNS` (`tap gameover brick clear tetris split fruit bonus pearl death`) and `haptic(kind)`. Does nothing without `navigator.vibrate` (iOS Safari has none) or under `prefers-reduced-motion: reduce`. Never throws. `GamePlayer` calls `haptic` only when touch UI active, `navigator.vibrate` exists and toggle ON. `tap` on pad presses, Snake swipes, Arkanoid touch-downs. `gameover` on game over. `HAPTICS ON/OFF` button in `.appearance-row`: only below 768px with `navigator.vibrate` (read via `useSyncExternalStore`, no hydration mismatch), memory only, survives PLAY AGAIN.

## Design reference

`references/templates/`: ported UI prototype, not app code. `Arcade Vault.html` + `.jsx` (`app`, `auth`, `biblioteca`, `data`, `detalle`, `nav`, `reproductor`, `salon`), `styles.css`, `home-about/`. Mock data in `data.jsx`. `references/StarterGames/`: vanilla-JS sources of asteroids, tetris, arkanoid. `references/source-assets/snake-assets`: snake art sources. `resources/`: raw Tetris music copy only (served file in `public/game-assets/tetris/`).

## Skills and agents

Always use `/frontend-design` when developing UI.

Agents live in `.claude/agents/`. Details in each file.

- `game-planner`: suggests new games that fit library. See `.claude/agents/game-planner.md`.
- `game-jam`: theme in, 3 spec variants out in `references/gameJam/<game-id>/`. See `.claude/agents/game-jam.md`.
- `skin-designer`: adds skins to ONE real game. Two phases (propose, then build approved). See `.claude/agents/skin-designer.md`.
- `mobile-porter`: adds touch controls and haptics to real games lacking `touch`. See `.claude/agents/mobile-porter.md`.
- `game-perf-booster`: measures and fixes ONE game's frame time. See `.claude/agents/game-perf-booster.md`.

Skills:

- `/full-game-impl <spec>`: full pipeline for a new real game (`/spec-impl` flow, then `mobile-porter`, then `skin-designer`). See `.claude/skills/full-game-impl/SKILL.md`.
- `add-game`: writes spec to port a vanilla-JS game. See `.claude/skills/add-game/SKILL.md`.

## Playwright

Leave all screen captures in `.pwScreencaps` folder in repo root.
