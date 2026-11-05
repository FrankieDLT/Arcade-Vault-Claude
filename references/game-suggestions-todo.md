# Game suggestions

Memory of the `game-planner` agent (`.claude/agents/game-planner.md`). It reads this file before proposing games, so it never repeats an idea, and updates it after every run.

Status legend: `suggested`, `accepted`, `rejected`, `built`.

## Library snapshot

Source of truth: `references/GAMES.md`. Copied here so the agent sees existing coverage at a glance.

| Game         | Id             | Category | State        |
| ------------ | -------------- | -------- | ------------ |
| Asteroids    | `asteroids`    | SHOOTER  | built        |
| Tetris       | `tetris`       | PUZZLE   | built        |
| Arkanoid     | `arkanoid`     | ARCADE   | built        |
| Snake        | `snake`        | ARCADE   | built        |
| Brick Buster | `brick-buster` | ARCADE   | catalog only |
| Drop         | `drop`         | PUZZLE   | catalog only |
| Serpentine   | `serpentine`   | ARCADE   | catalog only |
| Chomper      | `chomper`      | ARCADE   | catalog only |
| Invaders     | `invaders`     | SHOOTER  | catalog only |
| Rocks        | `rocks`        | SHOOTER  | catalog only |
| Hopper       | `hopper`       | ARCADE   | catalog only |
| Pixel Duel   | `pixel-duel`   | VERSUS   | catalog only |

## Suggestions

| Date | Name | Id | Category | Status | Note |
| ---- | ---- | -- | -------- | ------ | ---- |
| 2026-11-05 | Echo Duel | `echo-duel` | VERSUS | suggested | Pick #1. Solo vs CPU rally; your past paddle positions linger as "echo" barriers that deflect the ball. Fills the empty VERSUS category. Effort M. Overlaps catalog-only Pixel Duel. |
| 2026-11-05 | Orbit Keeper | `orbit-keeper` | ARCADE | suggested | Rank 2. Rotate a shield ring around a core to bounce incoming debris; lives + level. Effort S-M. |
| 2026-11-05 | Lane Lantern | `lane-lantern` | PUZZLE | suggested | Rank 3. Slide-and-merge rows of tiles on a timer, score chains. Effort M. Light overlap with Drop/Tetris. |
| 2026-11-05 | Bumper Bay | `bumper-bay` | ARCADE | suggested | Single-table pinball, two flippers, bumpers, combo targets. Accent magenta. Effort M. Overlap low. |
| 2026-11-05 | Dust Devil | `dust-devil` | ARCADE | suggested | Tunnel through sand, drop boulders on burrowing critters. Accent yellow. Effort M-L. Overlap low. |
| 2026-11-05 | Skyline Hop | `skyline-hop` | ARCADE | suggested | Endless vertical platform jumper, height = score. Accent green. Effort S-M. Overlap low. |
| 2026-11-05 | Girder Dash | `girder-dash` | ARCADE | suggested | Climb ladders and girders dodging rolling drums to reach the top. Accent cyan. Effort M. Overlap low. |
| 2026-11-05 | Paper Route | `paper-route` | ARCADE | suggested | Side-scrolling bike delivery, throw papers at mailboxes, dodge hazards. Accent yellow. Effort M. Overlap low. |
| 2026-11-05 | Claimline | `claimline` | ARCADE | suggested | Draw lines to claim board area while a sparker hunts the line. Accent cyan. Effort M-L. Overlap low. |
| 2026-11-05 | Dusk Drift | `dusk-drift` | ARCADE | suggested | Top-down endless night racer, dodge traffic, drift for combo. Accent magenta. Effort S. Overlap low. |
| 2026-11-05 | Foam Pop | `foam-pop` | PUZZLE | suggested | Aim and fire bubbles from the bottom, pop clusters of 3+, ceiling creeps down. Accent magenta. Effort M. Overlap low. |
| 2026-11-05 | Gem Column | `gem-column` | PUZZLE | suggested | Falling 3-gem columns, line up 3+ same colors, chains. Accent yellow. Effort S-M. Overlap medium with Drop/Tetris. |
| 2026-11-05 | Pipe Panic | `pipe-panic` | PUZZLE | suggested | Place queued pipe pieces before the flow arrives, longest path scores. Accent green. Effort M. Overlap low. |
| 2026-11-05 | Crate Clerk | `crate-clerk` | PUZZLE | suggested | Push crates onto marks in short warehouse levels, fewer moves = more points. Accent green. Effort S-M. Overlap low. |
| 2026-11-05 | Prism Swap | `prism-swap` | PUZZLE | suggested | Swap adjacent gems to match 3+, timed with cascades. Accent cyan. Effort M. Overlap low. |
| 2026-11-05 | Moth Swarm | `moth-swarm` | SHOOTER | suggested | Fixed shooter, enemies dive in looping formations, rescue-ship power. Accent green. Effort M-L. Overlap medium with Invaders. |
| 2026-11-05 | Skyfall Guard | `skyfall-guard` | SHOOTER | suggested | Mouse-aim counter-missiles with blast radius to defend cities. Accent yellow. Effort M. Overlap low. |
| 2026-11-05 | Vine Crawler | `vine-crawler` | SHOOTER | suggested | Shoot a segmented worm that splits down a mushroom field. Accent green. Effort M. Overlap low-medium. |
| 2026-11-05 | Lantern Hunt | `lantern-hunt` | SHOOTER | suggested | Mouse shooting gallery, limited ammo, reload timing, bonus targets. Accent magenta. Effort S. Overlap low. |
| 2026-11-05 | Scrap Storm | `scrap-storm` | SHOOTER | suggested | Arena survival, move with WASD and aim with arrows, waves of robots. Accent cyan. Effort M. Overlap low-medium with Asteroids. |
| 2026-11-05 | Ribbon Chase | `ribbon-chase` | VERSUS | suggested | Light-trail duel vs CPU, trap it with your ribbon. Accent cyan. Effort M. Overlap medium with Snake. |
| 2026-11-05 | Arc Artillery | `arc-artillery` | VERSUS | suggested | Turn-based angle/power artillery duel vs CPU, wind and terrain craters. Accent yellow. Effort M. Overlap low. |
| 2026-11-05 | Blast Grid | `blast-grid` | VERSUS | suggested | Drop timed bombs in a block maze vs CPU rivals. Accent green. Effort M-L. Overlap low. |

## Details

Longer notes for `accepted` ideas go here.
