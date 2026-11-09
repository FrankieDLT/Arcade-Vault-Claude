# SPEC — Frogger: core game integration

> **Status:**  Approved
> **Depends on:** SPEC 05, SPEC 06, SPEC 07, SPEC 08, SPEC 09
> **Date:** 2026-05-20
> **Goal:** Integrate Frogger (pure canvas, built from scratch) as a playable game in Arcade Vault with ID `frogger`, connecting score, lives, level and game over to the React HUD and a dedicated play page.

---

## Scope

**In:**

- SQL INSERT to add the `frogger` row to the `games` table in Supabase.
- Create `components/games/FroggerGame.tsx` — a `"use client"` React component that wraps the main canvas (480 × 640 px). Accepts props: `paused`, `onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver`.
- Game loop built from scratch in the component: a grid of 16 columns × 14 rows of 40 × 40 px. The vertical map is divided into fixed zones: bottom safe zone (row 13 — starting base), road zone (rows 12–8, 5 traffic lanes), river zone (rows 7–2, 6 river lanes) and goal zone (row 1, 5 goal slots).
- Road entities: cars and trucks of different lengths (1–3 cells), with per-lane speeds and directions; they move horizontally in a continuous loop; colliding with the frog is lethal.
- River entities: logs (length 2–4 cells) and turtles (groups of 2–3) per lane; they move horizontally. The frog survives in the river only while on top of a log or visible turtles; falling in the water kills it. Turtles can periodically submerge (visible phase → underwater → visible); while underwater they provide no support.
- Frog movement: discrete jumps of 1 cell (40 px) in 4 directions (↑ ↓ ← →); each key press moves the frog exactly one cell after a 120 ms jump animation completes. The frog cannot move past the left and right edges.
- Goal reached condition: the frog reaches one of the 5 goal slots in the top row (each slot spans 2 of the 16 columns). A slot that is already occupied cannot be used again in the same round. Filling all 5 slots completes the round and starts the next one.
- Death conditions: (a) collision with a vehicle, (b) falling into the water, (c) the turtle under the frog submerges, (d) leaving through the left/right edges of the river, (e) the round timer runs out (15 s initially, reduced at higher levels).
- Lives system: the frog starts with 3 lives. Each death subtracts 1 life and calls `onLivesChange(lives - 1)`. If `lives - 1 === 0`, call `onLivesChange(0)` and then `onGameOver(finalScore)`.
- Scoring: +10 pts for each cell advanced upward for the first time in the round; +50 pts for occupying a goal slot; +200 pts for completing a round; plus a time bonus = `remaining_time × 10` when occupying a slot.
- Round timer visible in the HUD: 15 s by default, reduced in higher rounds.
- Internal canvas HUD (score top-left, lives as frog icons top-right, level top-center, time bar in row 0) — same double-HUD pattern as the other games on the platform.
- The `paused: boolean` prop freezes `update()` but keeps calling `draw()`.
- Clean up event listeners (`keydown` on `document`) in the `useEffect` `return`.
- Create `app/games/frogger/play/page.tsx` — dedicated play page.
- Save the score on game over: a React modal pre-fills the name from `localStorage` (`av_player_name`), inserts into Supabase and persists the name for the next game.

**Out of scope:**

- External bitmap sprites — all elements are drawn with canvas primitives (rectangles, arcs, composite shapes) in themed colors; no image is loaded.
- Touch or mobile controls.
- Elaborate death animations (explosions, particles) — covered in a secondary spec.
- Special power-ups (fly in the goal slot, crocodile disguised as a log) — covered in a secondary spec.
- Supabase Auth and RLS — `user_id` is stored as `null`.
- Realtime leaderboard.
- Generic `CanvasGame` component (YAGNI).

---

## Data model

### INSERT into the `games` table

```sql
INSERT INTO games (id, title, short, long, cat, cover, color)
VALUES (
  'frogger',
  'FROGGER',
  'Cruza la carretera y el río sin convertirte en papilla.',
  'Guía a tu rana a través de una carretera repleta de coches y un río de troncos y tortugas flotantes. Llena las cinco bocas del otro lado para completar la ronda; cada nivel acelera el tráfico y acorta el tiempo. Tres vidas y mucho asfalto por delante.',
  'ARCADE',
  'cover-frogger',
  'lime'
);
```

> Note: the `short` and `long` strings are kept in Spanish exactly as in the original spec, because they are data to be inserted. Translate them only if the catalog language changes. (CLAUDE.md states that all UI text is English, so you may want to replace them with: *"Cross the road and the river without becoming roadkill."* / *"Guide your frog across a road packed with cars and a river of floating logs and turtles. Fill the five goal slots on the far side to complete the round; each level speeds up the traffic and shortens the time. Three lives and plenty of asphalt ahead."*)

### `FroggerGame` component props

```ts
interface FroggerGameProps {
  paused: boolean;
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
```

Local state starts with `lives = 3`, `score = 0`, `level = 1`.
`onLivesChange(n)` fires every time the frog dies.
`onLivesChange(0)` fires right before `onGameOver(score)` on any end-of-game condition.

No new tables or TypeScript types are introduced — `GameRow` and `ScoreRow` from `lib/supabase/types.ts` are reused.

---

## Implementation plan

1. **INSERT in Supabase** — run the data model SQL in the Supabase SQL Editor.
   Verification: the `frogger` row appears in the Table Editor; `/games` shows the card with cover `cover-frogger` and color `lime`.

2. **Define constants and types** inside `FroggerGame.tsx`:

   ```ts
   const COLS = 16;
   const ROWS = 14;
   const CELL = 40; // px
   const CANVAS_W = COLS * CELL; // 640 — scaled by CSS to the container
   const CANVAS_H = ROWS * CELL; // 560
   // Zones (row index, 0 = top)
   const ROW_GOALS = 0;
   const ROW_RIVER_TOP = 1;
   const ROW_RIVER_BOT = 6;
   const ROW_SAFE_MID = 7;
   const ROW_ROAD_TOP = 8;
   const ROW_ROAD_BOT = 12;
   const ROW_START = 13;
   ```

   Local types (not exported):

   ```ts
   type Direction = 'up' | 'down' | 'left' | 'right';
   interface Lane {
     row: number;
     speed: number;
     dir: 1 | -1;
     entities: Entity[];
   }
   interface Entity {
     col: number;
     width: number;
     type: 'car' | 'truck' | 'log' | 'turtle';
     submerged?: boolean;
   }
   interface Frog {
     col: number;
     row: number;
     animating: boolean;
     animT: number;
     targetCol: number;
     targetRow: number;
   }
   ```

3. **Build the lane map** — function `buildLanes(level: number): Lane[]`:
   - Road lanes (rows 8–12): speeds between 1.5 and 4 px/frame (scaled by level); alternating directions; entities preloaded with gaps so they can be crossed.
   - River lanes (rows 1–6): speeds between 1 and 3 px/frame; logs of 2–4 cells with gaps of at least 1 cell; turtle groups of 2–3 with a submersion cycle of 3 s visible / 1.5 s underwater.
   - Each level increases all speeds by 15 %.
     Verification: when the `lanes` array is printed to the console, each lane has at least 2 entities and the gaps are visible.

4. **Main game loop** with `requestAnimationFrame`:
   - `update(dt: number)`:
     - If `paused`, skip all logic.
     - Advance each entity's position in its lane (`entity.col += lane.speed * lane.dir * dt / 16`); when an entity leaves the edge, reintroduce it on the opposite side (`col = -entity.width` or `col = COLS`).
     - If the frog is not animating: check input (`pendingDir`); if there is a pending direction, start the animation (`animating = true`, `animT = 0`, compute `targetCol/targetRow`).
     - If the frog is animating: advance `animT += dt`; if `animT >= 120`, complete the jump (`col = targetCol`, `row = targetRow`, `animating = false`) and resolve the destination cell logic (death/goal/score detection).
     - If the frog is in the river and not animating: apply the horizontal displacement of the entity it rests on (checked with `getSupport(frog, lanes)`).
     - Decrement the round timer; if it reaches 0, death by time.
     - Call state-change callbacks if the value differs from the previous one.

   - `draw()`:
     - Background by zone: black for road, dark blue for river, dark green for safe rows, light green for goal slots.
     - Draw the entities of each lane: cars (red/yellow/blue rectangle with circular wheels), trucks (gray rectangle with a distinct cab), logs (brown rectangle with line texture), visible turtles (green circle with scale pattern), submerged turtles (semi-transparent outline).
     - Draw the frog: bright green body (28×24 px ellipse) with white/black eyes (two circles), legs extended during the jump animation.
     - Draw goal slots: dark green goal rectangle with a gold border; if occupied, draw a frog silhouette inside.
     - Internal HUD: score top-left (white 16 px font), level top-center, frog icons top-right (one green circle per life), time bar (rectangle in row 0, width proportional to remaining time, color green → yellow → red).

5. **Collision and support detection**:
   - `checkRoadCollision(frog, lanes)`: iterates the entities of road lanes; if `frog.col` is within the range `[entity.col, entity.col + entity.width)` and `frog.row === lane.row`, returns `true`.
   - `getSupport(frog, lanes)`: iterates the entities of river lanes; returns the entity whose range covers the frog's column in the same lane, or `null`. If the entity is a turtle with `submerged === true`, returns `null` (no support).
   - `checkGoal(frog, goals)`: if `frog.row === ROW_GOALS`, computes the slot corresponding to `frog.col`; if it is not occupied, marks it and adds points; if it was already occupied or `frog.col` is not a slot, it is a death.

6. **Round completion handling** — `completeRound()`:
   - Reset the frog position to `ROW_START`, center column.
   - Clear the occupied slots.
   - Increment `level`, call `onLevelChange(level)`.
   - Rebuild the lanes with `buildLanes(level)`.
   - Reset the timer.

7. **Death handling** — `killFrog()`:
   - Decrement `lives`.
   - Call `onLivesChange(lives)`.
   - If `lives === 0`: call `onLivesChange(0)`, then `onGameOver(score)`, stop the loop.
   - If `lives > 0`: reset the frog position to `ROW_START`, center column; reset the timer.

8. **Create `app/games/frogger/play/page.tsx`** — dedicated play page:
   - Imports `FroggerGame` with `dynamic(..., { ssr: false })`.
   - Local state: `score`, `lives` (initially `3`), `level`, `paused`, `over`, `name`, `saved`, `gameKey`.
   - Passes `paused` and the four callbacks to `FroggerGame`.
   - Reuses the platform's visual layout (React HUD + CRT + game over modal), the same as the Asteroids, Tetris, Arkanoid, Snake and Space Invaders play pages.
   - Game over modal: pre-fills the name from `localStorage.getItem('av_player_name')`; on confirm, saves to `localStorage` and inserts into Supabase `{ game_id: 'frogger', player_name: name, score, user_id: null }`.
   - The save button is disabled after the first submission.
   - The "PLAY AGAIN" button increments `gameKey` to remount `FroggerGame`.
     Verification: the React HUD reflects score, lives and level in real time.

9. **Final verification** — `npm run build` finishes with no TypeScript errors. No existing route returns 500.

---

## Acceptance criteria

- [ ] The `frogger` row exists in the Supabase `games` table with the data model values.
- [ ] The Frogger card appears in `/games` with cover `cover-frogger` and color `lime`.
- [ ] The route `/games/frogger/play` loads with no SSR or TypeScript errors.
- [ ] The canvas (640 × 560) renders with the zones visually distinct (road, river, safe zones, goal slots).
- [ ] The frog appears centered in the start row when the game loads.
- [ ] The frog jumps exactly one cell (40 px) per direction key press with a 120 ms animation.
- [ ] The frog cannot leave through the side edges.
- [ ] Cars and trucks move horizontally in a loop along their lanes; they re-enter from the opposite side when leaving.
- [ ] Logs and turtles move horizontally in a loop along their lanes.
- [ ] Turtles alternate between visible and submerged on the defined cycle.
- [ ] The frog dies when hit by a road vehicle.
- [ ] The frog dies when falling into the water (not on a log or visible turtles).
- [ ] The frog dies when the turtle supporting it submerges.
- [ ] The frog dies when the round timer runs out.
- [ ] On death, `onLivesChange(lives - 1)` fires; the frog returns to the start row.
- [ ] Reaching a free goal slot marks the slot and adds the score bonus.
- [ ] Reaching an already occupied goal slot kills the frog.
- [ ] Completing all 5 slots ends the round and starts the next one with `level` incremented.
- [ ] `onLevelChange(level)` fires at the start of each new round.
- [ ] Entity speed increases with each level.
- [ ] The round timer decreases with each level.
- [ ] `onScoreChange(score)` fires on every score change.
- [ ] The internal canvas HUD (score, level, life icons, time bar) is drawn correctly.
- [ ] The platform's React HUD reflects score, lives and level in real time.
- [ ] The platform's "PAUSE" button freezes the game loop; "RESUME" resumes it.
- [ ] The P / Esc keys do not trigger an independent canvas pause.
- [ ] On reaching `lives = 0`, `onLivesChange(0)` and `onGameOver(score)` fire; the React modal appears.
- [ ] The modal pre-fills the name from `av_player_name` if it exists in localStorage.
- [ ] On confirming the name, the score is inserted into Supabase and the name is persisted in localStorage.
- [ ] The save button is disabled after the first submission (no double insert).
- [ ] The "PLAY AGAIN" button restarts the game from scratch (new `gameKey`).
- [ ] The saved score appears in `/games/frogger` and in `/hall-of-fame` on reload.
- [ ] `npm run build` completes with no TypeScript errors.
- [ ] No existing route returns 500.

---

## Decisions

- **Yes: Canvas primitives without bitmap sprites** — cars, trucks, logs, turtles and the frog are drawn with canvas geometric shapes and themed colors. Reason: there are no Frogger assets in the repository; drawing in code removes image-loading dependencies and lets the visuals be tweaked without external files.

- **Yes: 40 px discrete grid with a 120 ms jump animation** — frog movement is cell by cell, not continuous. Reason: canonical Frogger mechanic; discrete movement greatly simplifies collision detection and river support by comparing whole rows/columns.

- **Yes: Double HUD** — the canvas keeps its internal HUD and React shows the same values in the platform HUD. Reason: consistency with the pattern established in all the platform's games.

- **Yes: 3 lives** — the original Frogger starts with 3 lives. `onLivesChange` reports each loss. Reason: faithful to the classic mechanic; consistent with Arkanoid and Space Invaders.

- **Yes: Turtles with a submersion cycle** — they alternate between support and hazard with an independent timer per group. Reason: a mechanic that sets Frogger apart from a log-only river; adds risk management without excessive implementation complexity.

- **Yes: Round timer** — 15 s initially, reduced at higher levels. Death by time adds urgency. Reason: original Frogger mechanic; stops the player from waiting indefinitely in the safe zone.

- **Yes: 5 goal slots** — all must be filled to complete the round. Reason: original mechanic that gives each round a clear objective without being a single linear level.

- **Yes: 640 × 560 px canvas (16 × 14 cells of 40 px)** — vertical aspect ratio close to the original. Reason: the Frogger map is vertical (the player advances upward); a canvas wider than tall would not represent the journey well.

- **Yes: Dedicated play page `app/games/frogger/play/page.tsx`** — instead of the generic `[id]/play` route. Reason: consistency with all previous games; the Next.js App Router gives static routes priority over dynamic ones.

- **Yes: `dynamic(..., { ssr: false })`** — the canvas component loads on the client only. Reason: `canvas` and `requestAnimationFrame` do not exist in the Next.js SSR Node.js environment.

- **No: Continuous (interpolated) movement** — the frog does not glide; it jumps from cell to cell. Reason: continuous interpolation would require AABB collisions in continuous space for the river and road, increasing complexity without adding fun.

- **No: Crocodile disguised as a log or bonus fly in the slots** — covered in the secondary power-ups and events spec. Reason: they are independent layers of difficulty and reward on top of the base mechanic.

- **No: Generic `CanvasGame` component** — each game has its own component. Reason: YAGNI.

- **No: RLS in this spec** — tables stay open (public INSERT and SELECT). Reason: mitigated in the future security spec.

- **No: Realtime on leaderboards** — scores appear on reload. Reason: subscription complexity adds no value while there are few active players.
