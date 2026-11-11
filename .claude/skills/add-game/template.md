# SPEC {{NN}} — {{Game title}} game

> **Status:** Draft
> **Depends on:** SPEC 05, SPEC 06{{, other specs}}
> **Date:** {{YYYY-MM-DD}}
> **Objective:** {{One sentence: port the game in `references/...` to a TypeScript engine plus a React canvas component, add/upgrade it in the catalog as `<id>`, and wire its score, {{stats}} into the platform HUD and the GAME OVER / SAVE SCORE flow.}}

## Why this spec exists

{{2 short paragraphs: what the game page does today (fake simulation or nothing), what this spec makes real, and which pattern it follows (engine under `lib/<id>/`, thin canvas wrapper, GamePlayer as host). Describe the reference source: file(s), size, language of its text, and which files are leftovers to ignore.}}

## Scope

**In:**

- {{Catalog: new entry `<id>` appended after the last entry of `GAMES`, or upgrade of placeholder `<id>` in place.}}
- {{Full port of the gameplay: list every rule, entity, mode and power-up from the inventory.}}
- Pure TypeScript engine in `lib/{{id}}/` with no React and no Next.js imports.
- Client component `components/{{id}}-canvas.tsx` that owns the `<canvas>`, creates and destroys the engine.
- {{Registry: introduce `components/game-registry.tsx` and move space-voyage into it, OR add an entry to the existing registry.}} `GamePlayer` dispatches through it; games not in the registry keep the fake simulation.
- Score, {{stats}} in the platform HUD come from the engine; PAUSE / RESUME pauses the engine; END ends the run; GAME OVER modal and SAVE SCORE (`insertScore`) work as in SPEC 06; PLAY AGAIN starts a new run.
- Canvas draws only the playfield {{and in-game timers}}. HUD, PAUSED and GAME OVER belong to the platform.
- Fixed {{W}}x{{H}} game coordinates, scaled by CSS to fit `.crt-screen` keeping the aspect ratio.
- {{Keyboard / mouse input list.}} Controls hint near the CRT.
- In-game text in English.
- {{Assets copied to `public/game-assets/<id>/` (omit if none).}}
- {{Migration `supabase/migrations/<timestamp>_add_<id>_game.sql` that inserts (or updates) the `games` row, applied with MCP `apply_migration`.}}
- {{New cover class `cover-<id>` in `app/globals.css` (new entry only).}}
- Update `CLAUDE.md` with the engine location, the callbacks contract and the registry.

**Out of scope (for future specs):**

- {{Source-game features dropped by the user: skins, themes, sound, modes...}}
- Touch or gamepad controls; any input not listed above.
- Sound and music {{unless opted in}}.
- High-DPI canvas scaling and a responsive playfield size.
- Supabase Auth, server client, rate limiting, anti-cheat.
- Changes to other games, the Home, auth or the Hall of Fame layout.
- Automated tests (no test runner is configured).

## Data model

Catalog entry (the `Game` type is unchanged):

```ts
// lib/games.ts
{
  id: "{{id}}",
  title: "{{TITLE}}",
  short: "{{one line}}",
  long: "{{two or three sentences}}",
  cat: "{{ARCADE|PUZZLE|SHOOTER|VERSUS}}",
  cover: "{{cover-id}}",
  color: "{{cyan|magenta|yellow|green}}",
  best: 0,
}
```

Engine public API:

```ts
// lib/{{id}}/engine.ts
export interface {{Name}}Callbacks {
  onScore: (score: number) => void; // when the score changes
  {{onLives / onLevel / onLines ...: only the stats the HUD mapping uses}}
  onGameOver: (finalScore: number) => void; // once per run
}

export class {{Name}}Engine {
  constructor(canvas: HTMLCanvasElement, callbacks: {{Name}}Callbacks);
  start(): void; // resets state, attaches listeners, starts the rAF loop; idempotent
  pause(): void; // stops updating, clears held keys
  resume(): void; // continues without a time jump
  end(): void; // ends the run immediately and calls onGameOver once
  destroy(): void; // cancels rAF and removes every listener
}
```

Module layout:

| File                      | Contents                                                         |
| ------------------------- | ---------------------------------------------------------------- |
| `lib/{{id}}/constants.ts` | {{sizes, speeds, points, timers, tables copied from the source}} |
| `lib/{{id}}/utils.ts`     | {{helpers}}                                                      |
| `lib/{{id}}/entities.ts`  | {{entities, each with update/draw receiving ctx as argument}}    |
| `lib/{{id}}/engine.ts`    | `{{Name}}Engine`: input, state, update, draw, loop, callbacks    |

HUD mapping:

| Platform HUD | Source game           | Callback  |
| ------------ | --------------------- | --------- |
| Score        | {{...}}               | `onScore` |
| Lives        | {{...or hidden}}      | {{...}}   |
| Level        | {{...or mapped stat}} | {{...}}   |

Registry entry:

```ts
// components/game-registry.tsx
{{"<id>": { Canvas: {{Name}}Canvas, controls: [...], stats: {...} }}}
```

Migration (`supabase/migrations/<timestamp>_add_{{id}}_game.sql`):

```sql
{{insert into public.games (id, title, short, long, cat, cover, color) values (...);
-- or: update public.games set ... where id = '...';
-- values identical to lib/games.ts}}
```

Conventions:

- Constants, formulas and values are copied from the source unchanged ({{examples with the real numbers}}).
- Scoring is copied from the source: {{table}}.
- Entities receive `ctx` as an argument to `draw(ctx)`; no module-level globals. Game state lives in the engine instance.
- Input is fed by `keydown` / `keyup` listeners on `window` {{and mouse listeners on the canvas}}. `preventDefault` only for {{keys}} while the engine runs and is not paused.
- Held keys are cleared on `pause()`, window `blur` and `visibilitychange` (hidden).
- Callbacks fire only on change; `start()` fires the initial values ({{values}}).
- `onGameOver` fires at most once per run; afterwards the engine stops updating.
- The score is an integer in 0 to 10,000,000. {{How the engine guarantees it, or "max reachable is ~N".}}
- No new `localStorage` keys; `lib/storage.ts` is unchanged.

## Implementation plan

Before step 1, read the relevant guides in `node_modules/next/dist/docs/` as required by `AGENTS.md`. Invoke `/frontend-design` for the cover and the controls hint, per `CLAUDE.md`.

1. **Catalog entry.** {{Append / update in `lib/games.ts` with the temporary cover. `npm run build` passes; `/games/<id>` and `/games/<id>/play` render with the fake player; Home mini cards unchanged.}}
2. **Migration.** {{Write the file, apply it with `apply_migration`, check `select * from games where id = '<id>'` matches `lib/games.ts`, run `get_advisors`.}}
3. **Cover.** {{`.cover-<id>` in `app/globals.css`; library card and detail page show it. Skip for placeholder upgrade.}}
4. **Constants and utils.** {{...}} `npm run build` passes.
5. **Entities.** {{...}} `npm run lint` and `npm run build` pass.
6. **Engine.** {{state, input, update, draw, collision/rules, loop, callbacks, public API}}
7. **Canvas wrapper.** `components/{{id}}-canvas.tsx`, Strict-Mode safe.
8. **Registry and player wiring.** {{Create the registry and move space-voyage / add the entry. `GamePlayer` reads the registry; `END` uses `endSignal`; `onGameOver` sets `over`; `restart()` bumps `runId`. Space Voyage and the fake games behave as before.}}
9. **Score walkthrough.** In `npm run dev` with Playwright (captures in `.pwScreencaps/`): play to game over, SAVE SCORE, confirm the row in `scores`, on `/games/<id>` and in the Hall of Fame tab after a reload, at 1280px and 375px.
10. **Docs.** Update `CLAUDE.md`. Run `npm run lint` and `npm run build`.

## Acceptance criteria

Generic:

- [ ] `npm run lint` and `npm run build` finish without errors.
- [ ] `lib/games.ts` {{contains `<id>` as the last entry with the listed values / has `<id>` upgraded}}; other entries are unchanged; the Home still shows the same 6 mini cards.
- [ ] `select * from games where id = '{{id}}'` matches `lib/games.ts` (`id`, `title`, `short`, `long`, `cat`, `cover`, `color`); the migration file matches what was applied; `get_advisors` shows no new warning.
- [ ] `/library` shows the card; clicking it goes to `/games/{{id}}`; PLAY goes to `/games/{{id}}/play`.
- [ ] `/games/{{id}}/play` shows a real canvas in the CRT frame and no auto-incrementing score.
- [ ] Score and {{stats}} in the HUD come from the engine.
- [ ] PAUSE freezes the game and shows the PAUSED overlay; RESUME continues with no jump; keys held during pause do not stay stuck.
- [ ] END opens the GAME OVER modal with the current score; `onGameOver` does not fire twice.
- [ ] Game keys do not scroll the page during play; typing a name with spaces in the modal input works.
- [ ] SAVE SCORE inserts one row `{ game_id: "{{id}}", name, score }` into `scores`; the modal shows `SCORE SAVED_`; a double click inserts one row.
- [ ] The saved score appears in `/games/{{id}}` and in the Hall of Fame tab for this game after a reload, when it is above the lowest mock row.
- [ ] PLAY AGAIN starts a fresh run with initial values.
- [ ] EXIT or leaving the page stops the engine: no rAF loop and no `keydown` / `keyup` / `blur` / `visibilitychange` listener remains.
- [ ] In dev (React Strict Mode) only one loop runs: speed is normal, not double.
- [ ] At 375px width the canvas fits the CRT frame without horizontal scroll and keeps its ratio.
- [ ] Space Voyage and the other games' play pages behave exactly as before.
- [ ] No new `localStorage` keys; `lib/storage.ts` is unchanged.
- [ ] `lib/{{id}}/` imports nothing from `react` or `next`.
- [ ] No text on the canvas or in the player is in Spanish.
- [ ] Reloading `/games/{{id}}/play` shows no React hydration warnings.

Game-specific:

- [ ] {{One criterion per rule, score value, level rule, power-up, input and edge case from the inventory, with the real numbers.}}

## Decisions

- **Yes/No:** {{decision}}. {{Who decided and why.}}
- {{Include: catalog mode, registry, HUD mapping, dropped features, assets location, sound, score handling.}}

## Risks

| Risk                                                                                          | Mitigation                                                                                       |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| React Strict Mode mounts effects twice in dev and can leave two loops or duplicate listeners. | `start()` is idempotent, `destroy()` removes everything; a criterion checks single speed in dev. |
| Global key listeners interfere with typing in the GAME OVER input.                            | Listeners and `preventDefault` are active only while running and not paused.                     |
| `GAMES` and the `games` table drift apart.                                                    | The migration inserts/updates the row; documented in `CLAUDE.md`.                                |
| {{Source README differs from code.}}                                                          | {{Code wins; list the difference.}}                                                              |
| {{Score can exceed the database cap, or fractional.}}                                         | {{Rounding / clamping rule.}}                                                                    |
| {{Game-specific risks: tunneling, tuned physics, asset loading, timing.}}                     | {{...}}                                                                                          |

## What is **not** in this spec

- {{Dropped features and future ideas from the Scope's out list.}}
- Touch or gamepad controls, high-DPI rendering, real stats, Auth, server validation.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
