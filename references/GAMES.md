# Arcade Vault: Games

The `games` table in Supabase holds 15 rows. Seven of them are real, playable games with their own engine. The other eight are catalog entries that still run a fake simulation (a random score timer and a fake arena) in `components/game-player.tsx`.

## Implemented games

| Game      | Id          | Category | Accent  | Engine           | Skins                                                  | Extras                                              |
| --------- | ----------- | -------- | ------- | ---------------- | ------------------------------------------------------ | --------------------------------------------------- |
| Asteroids | `asteroids` | SHOOTER  | cyan    | `lib/asteroids/` | Retro, Neon, Pastel, Gothic, Negative, Amber CRT, Deep Sea | Power-ups: Bomb, Hyper, Shield, SlowMo, Triple shot |
| Tetris    | `tetris`    | PUZZLE   | green   | `lib/tetris/`    | Retro, Neon, Pastel, Pixel Art (plus dark/light theme) | Background music, hold piece, ghost piece           |
| Arkanoid  | `arkanoid`  | ARCADE   | magenta | `lib/arkanoid/`  | Retro, Pastel, Neon                                    | Sound effects, level select while paused, power-ups |
| Snake     | `snake`     | ARCADE   | yellow  | `lib/snake/`     | Retro, Neon, Pastel, Gothic, Negative, LCD Brick, Magma | Golden bonus fruit, 22 fruit sprites                |
| Glowmaw   | `glowmaw`   | ARCADE   | cyan    | `lib/glowmaw/`   | Abyss, Retro, Neon, Pastel, Gothic, Negative, Coral, Sunken Ruin, Paper Lantern | Gulp-streak multiplier, level select while paused, extra lives |
| Frogger   | `frogger`   | ARCADE   | green   | `lib/frogger/`   | Retro, Neon, Pastel, Gothic, Negative, Tide Poster, Midnight Toll                                                 | 5 goal slots, diving turtles, round timer           |
| Pong      | `pong`      | VERSUS   | magenta | `lib/pong/`      | Retro, Neon, Pastel, Gothic, Negative, Phosphor, Clay Court | PvE (CPU, 3 difficulties) and local PvP, mode picker, sound effects |

### Asteroids

- **Description:** Split rocks in zero gravity and survive the field.
- **Details:** Your ship drifts in open space. Rotate, thrust and fire to break big asteroids into smaller ones before they hit you. Grab power-ups: Bomb, Hyper, Shield, SlowMo and Triple shot.
- **Controls:** `←` `→` rotate, `↑` thrust, `SPACE` fire.
- **Touch (below 768px):** pad under the CRT with ◀ ▶ (rotate), THRUST (hold) and FIRE (hold). Rotate and thrust can be held together. Haptic `split` when an asteroid splits.
- **Gamepad (GamePad menu, any width):** `left` `right` (hold) rotate, `up` and `b` THRUST (hold), `a` FIRE (hold). `down`, `x` and `y` have no action and are drawn dimmed.
- **HUD:** score, lives, level.

### Tetris

- **Description:** Stack, rotate and clear lines before the stack hits the top.
- **Details:** Seven classic pieces fall into a ten-column well. Slide, rotate and drop them to clear lines, stash one piece on hold for later and follow the ghost to aim. Gravity speeds up every 10 lines.
- **Controls:** `←` `→` move, `↑` or `X` rotate, `↓` soft drop, `SPACE` hard drop, `S` hold, `C` slow fall.
- **Touch (below 768px):** pad under the CRT with ◀ ▶ ▼ (hold), ⟳ rotate, DROP, HOLD and SLOW (hold). Holding ◀ ▶ moves one cell per press (the engine relies on OS key repeat, which a pad does not send). Haptics: `clear` for 1 to 3 lines, `tetris` for 4.
- **Gamepad (GamePad menu, any width):** `left` `right` `down` (hold) move, `up` and `a` rotate, `b` DROP, `x` HOLD, `y` SLOW (hold). Skins: Neon (default), Retro, 80s Arcade, Wood.
- **HUD:** score, lines, level.

### Arkanoid

- **Description:** Break the wall, catch the power-ups and keep the ball alive.
- **Details:** Slide the paddle, bounce the ball and smash a wall of colored bricks. Falling capsules split the ball, add a safety bar or send it into a frenzy. Every level builds a new wall and the ball gets faster.
- **Controls:** `←` `→` or mouse move the paddle, `SPACE` or click launches the ball.
- **Touch:** no pad. Drag a finger over the canvas to move the paddle, tap to launch (pointer events; the mouse works the same). Haptic `brick` when a brick breaks.
- **HUD:** score, lives, level.

### Snake

- **Description:** Eat the fruit, grow longer and never touch the wall or yourself.
- **Details:** Steer a hungry snake across the grid and eat the fruit to grow. Golden fruit is worth five times more but vanishes fast. The snake speeds up with every bite, and one wrong turn into a wall or your own tail ends the run.
- **Controls:** arrow keys or `W` `A` `S` `D` steer.
- **Touch:** no pad. Swipe on the canvas (24 px or more, dominant axis; one finger path can turn several times). Touch and pen only, a mouse drag does nothing. Haptics: `fruit`, `bonus`.
- **HUD:** score, length.

### Glowmaw

- **Description:** Gulp the glowing motes and outswim the jelly drifters.
- **Details:** Guide Glowmaw, a luminous orb with a big hungry mouth, through a coral maze and gulp every glowing mote. Jelly drifters hunt you down the corridors, but a pearl leaves them dazed and good to eat. Clear the reef to dive into a faster one.
- **Rules:** 19x15 maze "Reef A" (135 motes, 4 pearls, a den and a warp on row 7). Mote `10 * multiplier`, pearl +50, dazed drifter 100/200/300/400, reef clear +1000. Gulp streak: each cell eaten within 0.6 s of the previous one extends the streak, multiplier x1 to x5 every 10 links. Drifters: Hunter, Mirror, Roamer, and Pacer from level 4. 3 lives, extra life at 10,000 and then every 40,000 (max 5).
- **Controls:** arrow keys or `W` `A` `S` `D` steer. While paused, `LEVEL - NN +` restarts the reef at that level (score and lives kept).
- **Touch (below 768px):** direction-only pad under the CRT (cross in the neon and retro gamepad skins, joystick in 80s Arcade and Wood); a tap sets the direction, which the engine remembers. Haptics: `pearl` (pearl eaten), `death` (life lost), `clear` (reef cleared).
- **HUD:** score, lives, level.

### Frogger

- **Description:** Cross the road and the river without becoming roadkill.
- **Details:** Guide your frog across a road packed with cars and a river of floating logs and turtles. Fill the five goal slots on the far side to complete the round; each level speeds up the traffic and shortens the time.
- **Rules:** 16x14 grid of 40 px cells (640x560 canvas). Row 13 start, rows 12-8 road, row 7 median, rows 6-1 river, row 0 goal slots. One hop per key press (120 ms). Dies on a vehicle, water, a diving turtle, the river edges, an occupied slot or the timer (15 s, minus 1 s per level, min 8 s). 3 lives. +10 per new row, +50 per slot plus 10 per remaining second, +200 per round. Speed +15% per level.
- **Controls:** arrow keys or `W` `A` `S` `D` hop.
- **Touch (below 768px):** direction-only pad under the CRT (one hop per tap). Haptics: `death` (life lost), `clear` (round cleared).
- **Skins:** `retro`, `neon`, `pastel`, `gothic`, `negative`, `tide-poster`, `midnight-toll` (palettes, no theme toggle).
- **HUD:** score, lives, level (the canvas draws only the playfield and the time bar).

### Pong

- **Description:** Two paddles, one ball. Beat the CPU or a friend.
- **Details:** The arcade classic: bounce the ball past your rival's paddle. Longer rallies are worth more points, and three missed balls end the match. `pixel-duel` stays a fake catalog entry.
- **Rules:** 800x600 canvas, paddles 12x100 px, ball 14 px. The ball starts at 420 px/s and gains 5% per paddle hit (cap 900); a hit near the paddle edge bounces up to 55 degrees. Each time a human returns the ball they get +5 (the CPU gets nothing for hits). A goal is worth `10 x rally hits` (min 10) and costs the conceder 1 of 3 lives. PvE: only the human has lives, so the run is endless until 3 misses. PvP: the run ends when either player reaches 0 lives. The leaderboard record is the human score (PvE) or the higher of the two scores (PvP); both modes share one leaderboard.
- **Modes:** a picker on the CRT before the run (`PVE`, `PVP`). PLAY AGAIN keeps the mode; `CHANGE MODE` in the GAME OVER modal returns to the picker. In PvE the PAUSED overlay has an `EASY` / `NORMAL` (default) / `HARD` CPU selector (`CPU` table in `lib/pong/constants.ts`). Choosing a different difficulty restarts the match (score, lives and positions reset). The human's points are multiplied by x0.75 / x1 / x1.5 (rounded), and in PvE every 3 goals the human scores add 1 unit to that multiplier (max +10 units, kept when a life is lost, reset by a new match); the `P1` tag shows it.
- **Controls:** Player 1 `W` `S`, Player 2 `↑` `↓`. In PvE the human accepts both pairs.
- **Touch (below 768px):** d-pad or joystick up / down = Player 1 (`KeyW` / `KeyS`); `A` = Player 2 up, `B` = Player 2 down (hold). Left, right, `X` and `Y` are dimmed. Haptic `death` when a life is lost.
- **Sound:** `paddle`, `goal`, `gameover` (own generated `.wav` files, volume 0.2). `SOUND ON/OFF` in the PAUSED overlay shares the mute state with the button under the CRT.
- **HUD:** score only (each side's score, lives and `P1` / `P2` / `CPU` tag are drawn on the canvas).

## Touch controls and haptics

Asteroids, Tetris, Arkanoid and Snake are playable on a phone (viewport below 768px). The touch hint shows only below 768px, and the pad is always on there; at 768px and wider the pad is off until the GamePad menu turns it on (Tetris, Asteroids, Glowmaw, Frogger and Pong). Glowmaw is playable on a phone too (direction pad). Vibration uses `navigator.vibrate`, so iOS Safari gets no haptics. Details are in `CLAUDE.md` and `specs/10-mobile-touch-controls.md`.

## Catalog-only games (fake simulation)

These rows exist in the `games` table and in `GAMES` (`lib/games.ts`), but have no engine yet.

| Game         | Id             | Category | Description                                    |
| ------------ | -------------- | -------- | ---------------------------------------------- |
| Brick Buster | `brick-buster` | ARCADE   | Bounce the ball and smash neon walls.          |
| Drop         | `drop`         | PUZZLE   | Fit the pieces before the ceiling crushes you. |
| Serpentine   | `serpentine`   | ARCADE   | Grow without biting your own tail.             |
| Chomper      | `chomper`      | ARCADE   | Gobble dots and escape the ghosts.             |
| Invaders     | `invaders`     | SHOOTER  | Defend the planet from rows of aliens.         |
| Rocks        | `rocks`        | SHOOTER  | Pulverize asteroids in zero gravity.           |
| Hopper       | `hopper`       | ARCADE   | Cross the pixel highway.                       |
| Pixel Duel   | `pixel-duel`   | VERSUS   | Two paddles. One ball. Maximum reflexes.       |

Brick Buster, Drop, Serpentine and Rocks overlap with the real Arkanoid, Tetris, Snake and Asteroids. Pixel Duel overlaps with the real Pong.

## Adding a game

A new real game needs an engine under `lib/<game>/`, a canvas wrapper in `components/`, an entry in `components/game-registry.tsx`, and a migration that inserts its `games` row. Without that row, saving a score fails on the foreign key.
