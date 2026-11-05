# Arcade Vault: Games

The `games` table in Supabase holds 12 rows. Four of them are real, playable games with their own engine. The other eight are catalog entries that still run a fake simulation (a random score timer and a fake arena) in `components/game-player.tsx`.

## Implemented games

| Game      | Id          | Category | Accent  | Engine           | Skins                                                  | Extras                                              |
| --------- | ----------- | -------- | ------- | ---------------- | ------------------------------------------------------ | --------------------------------------------------- |
| Asteroids | `asteroids` | SHOOTER  | cyan    | `lib/asteroids/` | none                                                   | Power-ups: Bomb, Hyper, Shield, SlowMo, Triple shot |
| Tetris    | `tetris`    | PUZZLE   | green   | `lib/tetris/`    | Retro, Neon, Pastel, Pixel Art (plus dark/light theme) | Background music, hold piece, ghost piece           |
| Arkanoid  | `arkanoid`  | ARCADE   | magenta | `lib/arkanoid/`  | Retro, Pastel, Neon                                    | Sound effects, level select while paused, power-ups |
| Snake     | `snake`     | ARCADE   | yellow  | `lib/snake/`     | Retro, Neon, Pastel                                    | Golden bonus fruit, 22 fruit sprites                |

### Asteroids

- **Description:** Split rocks in zero gravity and survive the field.
- **Details:** Your ship drifts in open space. Rotate, thrust and fire to break big asteroids into smaller ones before they hit you. Grab power-ups: Bomb, Hyper, Shield, SlowMo and Triple shot.
- **Controls:** `←` `→` rotate, `↑` thrust, `SPACE` fire.
- **HUD:** score, lives, level.

### Tetris

- **Description:** Stack, rotate and clear lines before the stack hits the top.
- **Details:** Seven classic pieces fall into a ten-column well. Slide, rotate and drop them to clear lines, stash one piece on hold for later and follow the ghost to aim. Gravity speeds up every 10 lines.
- **Controls:** `←` `→` move, `↑` or `X` rotate, `↓` soft drop, `SPACE` hard drop, `S` hold, `C` slow fall.
- **HUD:** score, lines, level.

### Arkanoid

- **Description:** Break the wall, catch the power-ups and keep the ball alive.
- **Details:** Slide the paddle, bounce the ball and smash a wall of colored bricks. Falling capsules split the ball, add a safety bar or send it into a frenzy. Every level builds a new wall and the ball gets faster.
- **Controls:** `←` `→` or mouse move the paddle, `SPACE` or click launches the ball.
- **HUD:** score, lives, level.

### Snake

- **Description:** Eat the fruit, grow longer and never touch the wall or yourself.
- **Details:** Steer a hungry snake across the grid and eat the fruit to grow. Golden fruit is worth five times more but vanishes fast. The snake speeds up with every bite, and one wrong turn into a wall or your own tail ends the run.
- **Controls:** arrow keys or `W` `A` `S` `D` steer.
- **HUD:** score, length.

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

Brick Buster, Drop, Serpentine and Rocks overlap with the real Arkanoid, Tetris, Snake and Asteroids.

## Adding a game

A new real game needs an engine under `lib/<game>/`, a canvas wrapper in `components/`, an entry in `components/game-registry.tsx`, and a migration that inserts its `games` row. Without that row, saving a score fails on the foreign key.
