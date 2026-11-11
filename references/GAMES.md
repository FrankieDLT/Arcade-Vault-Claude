# Arcade Vault: Games

The `games` table in Supabase holds 10 rows, one per entry of `GAMES` (`lib/games.ts`). All ten are real, playable games with their own engine. There are no catalog-only or fake games. Every game declares an `origin` (`ai`, `human` or `assisted`), stored in `GAMES.origin` and in the `games.origin` column.

## Implemented games

| Game      | Id          | Origin | Category | Accent  | Engine           | Skins                                                  | Extras                                              |
| --------- | ----------- | ------ | -------- | ------- | ---------------- | ------------------------------------------------------ | --------------------------------------------------- |
| Asteroids | `asteroids` | ai     | SHOOTER  | cyan    | `lib/asteroids/` | Retro, Neon, Pastel, Gothic, Negative, Amber CRT, Deep Sea | Power-ups: Bomb, Hyper, Shield, SlowMo, Triple shot |
| Tetris    | `tetris`    | ai     | PUZZLE   | green   | `lib/tetris/`    | Retro, Neon, Pastel, Pixel Art (plus dark/light theme) | Background music, hold piece, ghost piece           |
| Arkanoid  | `arkanoid`  | ai     | ARCADE   | magenta | `lib/arkanoid/`  | Retro, Pastel, Neon                                    | Sound effects, level select while paused, power-ups |
| Snake     | `snake`     | ai     | ARCADE   | yellow  | `lib/snake/`     | Retro, Neon, Pastel, Gothic, Negative, LCD Brick, Magma | Golden bonus fruit, 22 fruit sprites                |
| Glowmaw   | `glowmaw`   | ai     | ARCADE   | cyan    | `lib/glowmaw/`   | Abyss, Retro, Neon, Pastel, Gothic, Negative, Coral, Sunken Ruin, Paper Lantern | Gulp-streak multiplier, level select while paused, extra lives |
| Frogger   | `frogger`   | ai     | ARCADE   | green   | `lib/frogger/`   | Retro, Neon, Pastel, Gothic, Negative, Tide Poster, Midnight Toll                                                 | 5 goal slots, diving turtles, round timer           |
| Pong      | `pong`      | ai     | VERSUS   | magenta | `lib/pong/`      | Retro, Neon, Pastel, Gothic, Negative, Phosphor, Clay Court | PvE (CPU, 3 difficulties) and local PvP, mode picker, sound effects |
| Space Invaders | `space-invaders` | ai     | SHOOTER | cyan | `lib/space-invaders/` | Retro, Neon, Pastel, Gothic, Negative, Blueprint, Newsprint | Endless waves, level select while paused, sound effects |
| Galactic DogFight | `galactic-dogfight` | ai     | SHOOTER | yellow | `lib/galactic-dogfight/` | Retro, Neon, Pastel, Gothic, Negative, Sunset Drive, Chalkboard | Boss tractor beam, capture and rescue, dual fighter, Challenging Stages, music and sound effects |
| Robo Vault | `robo-vault` | ai     | ARCADE  | green  | `lib/robo-vault/` | `retro neon pastel gothic negative lcd-handheld sepia-reel` (CSS filters on the canvas; one palette per stage underneath) | Platformer, 4 Robot Masters with a weakness cycle, Sam's castle, dot-grid password save, music and sound effects |

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
- **Details:** The arcade classic: bounce the ball past your rival's paddle. Longer rallies are worth more points, and three missed balls end the match.
- **Rules:** 800x600 canvas, paddles 12x100 px, ball 14 px. The ball starts at 420 px/s and gains 5% per paddle hit (cap 900); a hit near the paddle edge bounces up to 55 degrees. Each time a human returns the ball they get +5 (the CPU gets nothing for hits). A goal is worth `10 x rally hits` (min 10) and costs the conceder 1 of 3 lives. PvE: only the human has lives, so the run is endless until 3 misses. PvP: the run ends when either player reaches 0 lives. The leaderboard record is the human score (PvE) or the higher of the two scores (PvP); both modes share one leaderboard.
- **Modes:** a picker on the CRT before the run (`PVE`, `PVP`). PLAY AGAIN keeps the mode; `CHANGE MODE` in the GAME OVER modal returns to the picker. In PvE the PAUSED overlay has an `EASY` / `NORMAL` (default) / `HARD` CPU selector (`CPU` table in `lib/pong/constants.ts`). Choosing a different difficulty restarts the match (score, lives and positions reset). The human's points are multiplied by x0.75 / x1 / x1.5 (rounded), and in PvE every 3 goals the human scores add 1 unit to that multiplier (max +10 units, kept when a life is lost, reset by a new match); the `P1` tag shows it.
- **Controls:** Player 1 `W` `S`, Player 2 `↑` `↓`. In PvE the human accepts both pairs.
- **Touch (below 768px):** d-pad or joystick up / down = Player 1 (`KeyW` / `KeyS`); `A` = Player 2 up, `B` = Player 2 down (hold). Left, right, `X` and `Y` are dimmed. Haptic `death` when a life is lost.
- **Sound:** `paddle`, `goal`, `gameover` (own generated `.wav` files, volume 0.2). `SOUND ON/OFF` in the PAUSED overlay shares the mute state with the button under the CRT.
- **HUD:** score only (each side's score, lives and `P1` / `P2` / `CPU` tag are drawn on the canvas).

### Space Invaders

- **Description:** Hold the line. Stop the invasion.
- **Details:** A fleet of invaders marches down the screen, faster with every ship you destroy. Move your cannon, shoot them one by one and dodge their bombs. Clear the wave to face a faster one.
- **Rules:** 800x600 canvas, 11x5 fleet (55 invaders, 32x24 hit boxes), cannon 44x22 at 360 px/s, one player bullet on screen at a time (600 px/s). The fleet moves 16 px per step and drops 24 px at each edge; `stepInterval(alive, level)` shortens as invaders die and as the level rises (cap 2.5x). Up to 3 bombs (240 px/s) fall from the lowest invader of a random column. Points by row: 30 / 20 / 20 / 10 / 10; wave clear +`100 x level`. 3 lives; a bomb hit pauses the game for 1.2 s and the cannon respawns at center. The run also ends at once if an invader reaches the cannon row. Waves are endless; a later wave starts lower (start row capped at level 9).
- **Controls:** `←` `→` or `A` `D` move, `SPACE` fires (hold to keep firing). While paused, `LEVEL - NN +` restarts the wave at that level (score and lives kept).
- **Touch (below 768px):** pad under the CRT with ◀ ▶ (hold) and `A` = FIRE (hold). Haptics: `death` (life lost), `clear` (wave cleared).
- **Sound:** `shoot`, `hit`, `boom`, `gameover` (own generated `.wav` files in `public/game-assets/space-invaders/`, volume 0.2). The mute button under the CRT is the only toggle.
- **HUD:** score, lives, level (the canvas draws only the playfield).

### Galactic DogFight

- **Description:** Break the formation. Rescue your captured ship.
- **Details:** Alien squadrons swoop in, lock into formation and dive at your fighter. Shoot them down, beware the Boss tractor beam that steals your ship, and win it back for a deadly dual fighter. Survive the Challenging Stages for a perfect bonus. A Galaga-style game with our own art, name, music and sound effects (nothing from the arcade original).
- **Rules:** 480x600 canvas, fighter 26x26 at 240 px/s, 40 ships (4 Boss, 16 Butterfly, 20 Bee) enter in 5 waves and sway and breathe in formation. Ships dive and shoot; Bosses take 2 hits. Points: Bee 50 / 100, Butterfly 80 / 160, Boss 150 / 400 (formation / diving), Boss with 1 or 2 escorts 800 / 1600. A diving Boss may stop and emit a 3 s tractor beam that captures the fighter; shooting that Boss while it dives frees the ship for a dual fighter (+1000). 3 lives, extra lives at 20,000 and 70,000 then every 70,000 (max 5). Stages 3, 7, 11 ... are Challenging Stages (100 per ship, 40 / 40 gives +10,000). Each stage ends with a SHOTS FIRED / HITS / RATIO banner. Endless stages.
- **Controls:** `←` `→` or `A` `D` move, `SPACE` fires (hold to keep firing).
- **Touch (below 768px):** pad under the CRT with ◀ ▶ (hold) and `A` = FIRE (hold). Haptics: `death` (fighter destroyed or captured), `clear` (stage cleared).
- **Sound:** 12 effects (`shoot`, `hit`, `bossHit`, `death`, `gameover`, `stageStart`, `beam`, `capture`, `rescue`, `challenge`, `perfect`, `extraLife`, volume 0.2) and a 12 s music loop (volume 0.12), all generated `.wav` files in `public/game-assets/galactic-dogfight/`. The mute button under the CRT is the only toggle.
- **HUD:** score, lives (total fighters), level (stage). The canvas also draws banners, reserve fighters and stage badges.

### Robo Vault

- **Description:** Beat four bosses, steal their weapons, storm Sam's castle.
- **Details:** A run-and-gun platformer in the style of the 8-bit classics, with our own art, names and audio (nothing from the original series, and the UI never uses its name). Pick one of four Robot Master stages, defeat the boss and take its weapon. Every Master is weak to another Master's weapon. After the four Masters, Sam's castle opens.
- **Rules:** 768x576 canvas, 16x12 tiles of 48 px, hero BOLT (14 energy). Masters: FROSTBYTE (Frost Shard, weak to Tide Burst), EMBERCORE (Ember Orb, weak to Frost Shard), GALEFORCE (Gale Cutter, weak to Ember Orb), TIDEBREAKER (Tide Burst, weak to Gale Cutter). Boss HP 20: buster 1, matching weapon 5, any other weapon 2. Weapons have 28 energy (shot costs 1, Tide Burst 2); with 0 energy the buster fires. The castle has 3 rooms (hazards, a rematch of the 4 Masters at half HP, a turret corridor) and Sam in 2 phases (saucer, then mech, HP 30 each). 3 lives per run, extra life every 20,000 points (max 5). Scoring: enemy 100, Master 2,000, castle room 1,500, Sam 10,000. Each defeated Master makes you take 10% less damage (stacks, up to 40%). Every boss defeated earns a signed-in player 1 credit (9 per full run: 4 Masters, 4 rematch bosses, Sam), rate-limited by the server. Entering a boss room removes every other enemy and projectile, and dying there restarts the boss fight from its beginning.
- **Password:** the only save. A 5x5 dot grid (cells `A1` to `E5`, 25 bits: 4 Masters, 2 castle-room bits, cleared, 12-bit score in steps of 10, 6-bit checksum, XOR mask and cell permutation). Shown on the stage-select screen and after each Master, room and the victory. The title screen has `PASSWORD` to type one in; a wrong grid shows `WRONG PASSWORD`. A password stores at most 40,950 points. `DELETE PROGRESS` (NO by default) wipes Masters, weapons, castle and score back to 0. Nothing is stored in the browser or the database.
- **Controls:** `←` `→` or `A` `D` move, `SPACE` jumps (hold = higher), `X` / `J` shoot (hold = auto-fire), `↑` / `W` held with shoot fires straight up and the hero looks up with the buster raised (up is not jump), `↓` / `S` held crouches and shoots low (hits small enemies like walkers; you cannot move while crouched), `Q` / `E` change weapon. Menus: arrows move, `SPACE` confirms, `X` goes back (clears the grid on the password entry screen). The password screens have a `COPY` button that copies the filled cells (for example `A2 A3 B1`) to the clipboard.
- **Touch (below 768px):** pad under the CRT: ◀ ▶ (hold), ▲ (hold, with SHOOT fires up; menu cursor) ▼ (menu cursor), `A` = JUMP (hold), `B` = SHOOT (hold), `X` / `Y` = previous / next weapon. Haptics: `death` (life lost), `clear` (Master, room or Sam cleared). The pad's ▼ button is a hold button (crouch).
- **Sound:** 13 effects (`shoot`, `jump`, `hit`, `enemyDie`, `bossHit`, `bossDie`, `pickup`, `weapon`, `death`, `gameover`, `select`, `victory`, `bossTick` (one per segment while a boss health bar fills), volume 0.2), a 16 s stage music loop (volume 0.12) and a 22 s heavy-metal inspired boss-fight loop (`music-boss.wav`, volume 0.18, replaces the stage music in every boss room and restarts at each one), all generated `.wav` files in `public/game-assets/robo-vault/`. The mute button under the CRT is the only toggle.
- **HUD:** score, lives, level (stages cleared + 1, 1 to 9). The canvas also draws hero, weapon and boss energy bars.

## Touch controls and haptics

Asteroids, Tetris, Arkanoid and Snake are playable on a phone (viewport below 768px). The touch hint shows only below 768px, and the pad is always on there; at 768px and wider the pad is off until the GamePad menu turns it on (Tetris, Asteroids, Glowmaw, Frogger, Pong, Space Invaders and Galactic DogFight and Robo Vault). Glowmaw is playable on a phone too (direction pad). Vibration uses `navigator.vibrate`, so iOS Safari gets no haptics. Details are in `CLAUDE.md` and `specs/10-mobile-touch-controls.md`.

## Adding a game

A new real game needs an engine under `lib/<game>/`, a canvas wrapper in `components/`, an entry in `components/game-registry.tsx`, and a migration that inserts its `games` row (including `origin`: `ai`, `human` or `assisted`). Without that row, saving a score fails on the foreign key. The new `GAMES` entry must set `origin` too; the type requires it.
