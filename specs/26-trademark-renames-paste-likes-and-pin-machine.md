# SPEC 26 — Trademark renames, original Arkanoid and Snake art, Robo Vault paste, game Likes and a pin machine upgrade

> **Status:** Implemented
> **Depends on:** SPEC 05, SPEC 06, SPEC 07, SPEC 08, SPEC 09, SPEC 13, SPEC 15, SPEC 16, SPEC 18, SPEC 20, SPEC 21, SPEC 25
> **Date:** 2026-11-11
> **Objective:** Rename six games to avoid trademark conflicts (ids, URLs and database included), replace the third-party Arkanoid and Snake art and Arkanoid sounds with original ones, and add a Robo Vault paste option, a per-account `Likes` toggle on game pages and a pin machine upgrade (64 new pins, clickable crank, radial costs, rarity-scaled sounds).

## Why this spec exists

Two groups of work share this spec because the user asked for one plan. The implementation plan orders them so each step can be committed and checked alone, and if the spec proves too big it splits cleanly: **A** (steps 1 to 4: trademark respect), **B** (steps 5 to 7: Likes and Robo Vault paste), **C** (steps 8 to 12: pin collection).

**Trademark respect (user decision).** Several catalog titles are live trademarks of other companies. The mechanics are free to copy, the names, art and recordings are not. The user chose the new names and asked for a **full rename**: the title, the game id, the URL, the `games`, `scores`, `pins` and credit rows, the folders and the pin ids. The third-party assets that remain in the repo are replaced by original ones: the Arkanoid spritesheet and sounds, and the Snake fruit sheet. The Tetris music (`korobeiniki.mp3`) is **not** in this spec and stays flagged in `CLAUDE.md`.

| Old name (id)                     | New name      | New id          |
| --------------------------------- | ------------- | --------------- |
| TETRIS (`tetris`)                 | BLOCK RAIN    | `block-rain`    |
| PONG (`pong`)                     | SUPER TENNIS  | `super-tennis`  |
| ASTEROIDS (`asteroids`)           | SPACE VOYAGE  | `space-voyage`  |
| FROGGER (`frogger`)               | STREET JUMPER | `street-jumper` |
| SPACE INVADERS (`space-invaders`) | ALIEN ATTACK  | `alien-attack`  |
| ARKANOID (`arkanoid`)             | WALL WRECKER  | `wall-wrecker`  |

(The user wrote "Street Jummper"; the double `m` was confirmed as a typo and `Street Jumper` is used.)

Other decisions the user already made and this spec does not reopen:

- Likes keep the exact current look of the stat; only the label and interaction change. One like per account per game, a second click removes it.
- New pins also come from Pong (now Super Tennis) and Tetris (now Block Rain), reversing the SPEC 18 exclusion.
- Marcy, Frankford (Marcy the Vampire Hunter) and the Wingshot astronaut are epic pins; other rarities follow the relevance of the sprite.
- Machine sounds are synthesized live with Web Audio, with a SOUND ON/OFF toggle.
- Arkanoid sprites are redrawn **in code** (canvas shapes), no image file. The Snake fruits follow the same approach for consistency (see Decisions).

## Scope

**In:**

- **Rename of six games, full depth.**
  - `GAMES` in `lib/games.ts`: new `id`, `title`, `cover` (`cover-<new-id>`), and any `short` / `long` text that names the old game or an original series.
  - Routes `/games/<id>/` and `/games/<id>/play/` use the new ids (static export, so old URLs stop existing).
  - Engine folders `lib/<old>/` become `lib/<new>/` and canvas wrappers `components/<old>-canvas.tsx` become `components/<new>-canvas.tsx`; registry keys, imports, CSS classes (`cover-*`, canvas classes) and `public/game-assets/<old>/` folders follow.
  - Database: migration `rename_games_trademark` changes `games.id` and the `title`, `short`, `long`, `cover` columns, and moves every row that points to the old ids (`scores.game_id`, `pins.game_id`, `boss_awards.game_id`, every other foreign key found to `games(id)`), plus the pin ids that start with the old game id (`pins.id`, `user_pins.pin_id`). No score, pin or credit row is lost.
  - In-game text, tooltips and `aria-label`s, `lib/home.ts` copy, `README.md`, `CLAUDE.md`, `GAME-INTEGRATION-GUIDE.md`, `references/GAMES.md` and the names used as examples in `.claude/` agent and skill files.
- **Pins section references (user request).** Every reference to the old games in the Pin Collection follows the new names:
  - Pin ids with an old game prefix and `PINS[].gameId` use the new game ids (`asteroids-big-rock` becomes `space-voyage-big-rock`, and so on for the 79 pins of the six renamed games), in `lib/pins/catalog.ts`, `lib/pins/sprites.ts` keys, the `pins` table and `user_pins`.
  - The almanac and result card show the new game title (they read `GAMES`, so this follows from the rename) and no card, tooltip, `aria-label` or comment in `components/pin-*.tsx`, `lib/pins/` or `lib/pins-db.ts` names an old game.
  - Pin **names** that are the original's own terms are renamed (names and ids, rarity and sprite unchanged):

    | Old pin (id)                                       | New name       | New id                        |
    | -------------------------------------------------- | -------------- | ----------------------------- |
    | Vaus Paddle (`arkanoid-vaus-paddle`)               | Wrecker Paddle | `wall-wrecker-wrecker-paddle` |
    | Invader (`space-invaders-invader`)                 | Alien          | `alien-attack-alien`          |
    | Invader Bomb (`space-invaders-invader-bomb`)       | Alien Bomb     | `alien-attack-alien-bomb`     |
    | Waving Invader (`space-invaders-waving-invader`)   | Waving Alien   | `alien-attack-waving-alien`   |
    | Mystery Ship (`space-invaders-mystery-ship`, epic) | Bonus Saucer   | `alien-attack-bonus-saucer`   |

    The other pin names are plain words and stay. The rename migration also updates `pins.name` for these five rows.

  - The pin text in the spec-18 sections of `CLAUDE.md` (`Mystery Ship pin`, `Space Invaders`, `Asteroids`, ...) uses the new names.
- **Wall Wrecker art in code.** The Arkanoid spritesheet `public/game-assets/arkanoid/spritesheet-breakout.png` is deleted. Bricks, paddle, ball, power-up capsules and explosion frames are drawn with canvas shapes (rectangles, gradients, simple paths) in `lib/wall-wrecker/`, original design, pre-rendered once per skin and color into offscreen canvases so the frame time does not rise. The three skins `retro`, `pastel`, `neon` become palettes in `constants.ts` that keep the same feel as today. The sheet load path, its failure fallback and its console error go away.
- **Wall Wrecker sounds.** `ball-bounce.mp3` and `break-sound.mp3` are replaced by original generated `.wav` files with the same event names and volume.
- **Snake fruits in code.** `public/game-assets/snake/fruits.png` is deleted. The 22 fruit sprites and the golden bonus become run tables in `lib/snake/sprites.ts` (16x16, original drawings, at most 6 colors each), drawn through offscreen canvases. The existing skins keep their look (palette plus the filter already applied to fruit sprites). The sheet load path and its failure fallback go away.
- **Robo Vault paste.** The password entry screen gets a `PASTE` option and accepts `Ctrl+V`, same pattern as Marcy's entry screen (SPEC 21). Pasted cell labels (for example `A2 A3 B1`) fill the 5x5 grid.
- **Likes.**
  - The `Plays` stat on `/games/[id]` becomes a button labeled `Likes` with the live count. Look identical to today's stat cell (`.stat-strip`, `.l`, `.v`).
  - One like per account per game, second click removes it. Optimistic update, reverts on error.
  - Liked: the number takes the accent color and `aria-pressed="true"`.
  - A guest sees the count; clicking stores the page with `rememberNextPath` (`av_auth_next`) and goes to `/auth`.
  - Counts are public, who liked what is private. Compact format above 999 (`1.2K`).
  - The unused `plays` field is removed from `Game` and every `GAMES` entry.
- **New pins.** 64 new pins, numbers 152 to 215, drawn by us as 16x16 run-table sprites (max 6 colors):

  | Game                     | New pins | Notes                                                                                                 |
  | ------------------------ | -------- | ----------------------------------------------------------------------------------------------------- |
  | Robo Vault               | 20       | Hero, the four Masters, Sam (saucer and mech), walker and other enemies, weapon pickups, energy items |
  | Marcy the Vampire Hunter | 20       | Marcy, Frankford (both epic), Count Faust, the Hollow King, bosses, relics, enemies, Credit Coin      |
  | Wingshot                 | 12       | The astronaut (epic), the three other companions, rare and decoy targets per scene                    |
  | Super Tennis             | 4        | Paddle, ball and similar, drawn for the pin only (the engine has no sprites)                          |
  | Block Rain               | 8        | The seven block shapes plus one more, drawn for the pin only                                          |

  Rarity of the 64: **3 epic** (Marcy, Frankford, the astronaut), **6 ultra rare**, **11 super rare**, **14 rare**, **30 common**, by how relevant the sprite is (final bosses and the Count ultra rare, Robo Vault heroes super rare, fodder common). Each of the five games has at least one rare or better pin. The final catalog is 215 pins: **121 common, 44 rare, 34 super rare, 12 ultra rare, 4 epic**. Names unique across all 215. Pin names and ids for Super Tennis and Block Rain use the new game ids and never the words `Tetris`, `Tetromino` or `Pong`.

- **Crank.** The lever (`.pm-lever`) becomes a real `<button>` (`Pull the crank`). Click, tap, `Enter` and `Space` pull the selected cost. Hit area at least 56 px.
- **Radial cost selector.** The three cost buttons become a radio group (`role="radiogroup"`, three `role="radio"`, arrow keys). Selecting does not pull. Default 5. An option above the balance is dimmed and cannot be selected; `100` is also disabled when the collection is complete. After a pull the selection drops to the highest affordable option; under 5 credits nothing is selected, the crank is disabled and `Not enough credits. Finish a game to earn more.` shows. Guests and a running pull disable crank and selector.
- **Machine sounds** in `lib/pins/sfx.ts` (Web Audio, no files): a plain ratchet tick at click; a crank sound in five tiers by rarity when the result arrives; a reveal sound in five tiers (about 0.6 s common, 0.9 s rare, 1.3 s super rare, 1.8 s ultra rare, 2.5 s epic), each a more complex and slightly longer version of the previous. A `SOUND ON/OFF` toggle in `.pm-controls`, default ON, memory only.
- Migrations `rename_games_trademark`, `add_game_likes`, `add_pins_new_games`; `database.types.ts` regenerated.
- `CLAUDE.md` updated (new names and ids everywhere, art in code, Likes, pin counts, machine controls and sounds, Robo Vault paste).
- UI of the Likes button and the machine designed with `/frontend-design`.

**Out of scope (for future specs):**

- The Tetris music (`korobeiniki.mp3`), which stays and stays flagged in `CLAUDE.md`.
- Redirects from the old URLs (static export on GitHub Pages cannot do server redirects), keeping an alias for the old ids, or renaming git history, old specs in `specs/` and old migration files (they are history and keep the old names).
- Renaming pins that merely look like something from an original game but whose name is a plain word (for example `Car`, `Frog`, `Log`, `Joystick`). Only names that are the original's own terms change (see "Pins section references" in scope).
- Changing the mechanics, scoring, skins' ids, difficulty or feel of any renamed game, and a visual redesign of covers beyond the renamed class.
- Showing who liked a game, sorting by likes, likes on the Library or home, guest likes stored locally, extra like rate limiting.
- Haptics for the machine, music on `/pins`, volume slider, new odds, costs or refunds.
- Paste for any game other than Robo Vault, changes to Marcy's password screen.
- Automated tests (no test runner is configured).

## Data model

### Rename migration (`rename_games_trademark`)

One migration, one transaction. Outline:

```sql
-- 1. find every foreign key that references public.games(id) and public.pins(id)
--    (known: scores.game_id, pins.game_id, boss_awards.game_id, user_pins.pin_id)
-- 2. drop them, update, re-add them (or re-add with ON UPDATE CASCADE)
-- 3. games: id, title, short, long, cover for the six rows
-- 4. scores / pins / boss_awards: game_id old -> new (from a mapping VALUES list)
-- 5. pins.id and user_pins.pin_id: replace the old game id prefix with the new one
-- 6. pins.name and the id suffix of the five pins listed in "Pins section references"
```

The mapping is the table in "Why this spec exists". The migration must leave row counts unchanged for `scores`, `pins`, `user_pins`, `boss_awards` and `games`. Functions that use game ids by value (`award_boss_credit` for `robo-vault` and `marcy-vampire-hunter`) are not affected; the migration checks by reading every function body that mentions an old id.

Client side: `PINS` in `lib/pins/catalog.ts` uses the new `gameId` and pin ids (manual copy of the `pins` table), `PIN_SPRITES` keys follow the new pin ids, `GAMES` and the registry use the new ids.

### Likes (migration `add_game_likes`)

```sql
create table public.game_likes (
  user_id    uuid not null references auth.users(id) on delete cascade,
  game_id    text not null references public.games(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);
```

RLS on, no policy, no client grant (same pattern as `boss_awards`). RPCs, `security definer`, `set search_path = ''`:

```sql
-- anon and authenticated. Returns { count, liked }; liked is false without a session.
get_game_likes(p_game_id text) returns jsonb
-- authenticated only. Inserts the row if absent, deletes it if present, atomically.
-- Raises `unknown_game` for a game that does not exist. Returns { count, liked }.
toggle_game_like(p_game_id text) returns jsonb
```

The advisor warnings for these two executable definer functions are accepted (like `royalty_of_games`) and recorded in `CLAUDE.md`.

```ts
// lib/likes-db.ts (client only)
export type GameLikes = { count: number; liked: boolean };
export class LikesError extends Error {
  kind: "signin" | "unknown_game" | "network";
}
export function fetchGameLikes(gameId: string): Promise<GameLikes>;
export function toggleGameLike(gameId: string): Promise<GameLikes>;
```

`Game` in `lib/games.ts` loses `plays` (the `games` table has no such column).

### New pins (migration `add_pins_new_games`)

Inserts 64 rows into `public.pins` (numbers 152 to 215) with `game_id` in `robo-vault`, `marcy-vampire-hunter`, `wingshot`, `super-tennis`, `block-rain`. Pin ids follow `<game-id>-<kebab-name>`. `lib/pins/catalog.ts` gets the same 64 entries and `lib/pins/sprites.ts` the 64 sprites. The pull RPCs read the `pins` table; step 9 verifies that no function hard-codes the catalog size.

### Art in code

```ts
// lib/snake/sprites.ts: run tables like lib/pins/sprites.ts
export type FruitSpriteDef = {
  palette: Record<string, string>;
  rows: string[];
};
export const FRUIT_SPRITES: FruitSpriteDef[]; // 22 fruits + golden bonus
```

`lib/wall-wrecker/constants.ts` gets `SKINS` palettes (brick colors, paddle, ball, capsule, explosion) per skin. No new persisted data.

### Machine state and sounds

```ts
// lib/pins/sfx.ts (client only, uses AudioContext)
export type PinSfxTier = { crankMs: number; revealMs: number; voices: number };
export const PIN_SFX_TIERS: Record<PinRarity, PinSfxTier>;
export function playCrankTick(): void;
export function playCrank(rarity: PinRarity): void;
export function playReveal(rarity: PinRarity): void;
export function setPinSfxMuted(muted: boolean): void;
```

The `AudioContext` is created lazily inside the crank click. If Web Audio is missing or throws, every function does nothing. `PinMachine` gets `selected: PullCost | null` and `muted: boolean`, both memory only.

## Implementation plan

1. **Titles and text.** Change `title`, `short`, `long`, in-game text and docs wording to the new names in `lib/games.ts`, the registry, canvases and the UI, keeping the old ids. Add the new names to the `games` table by a small migration (`rename_games_titles`) that changes only `title`, `short` and `long`. The site runs and shows the new names.
2. **Full id rename.** Write the migration `rename_games_trademark` (inspect foreign keys first with `execute_sql`), move `lib/` and `components/` files and `public/game-assets/` folders, change ids in `GAMES`, the registry, `cover-*` classes and `globals.css`, `PINS` and `PIN_SPRITES` keys, `references/GAMES.md`, `CLAUDE.md` and the `.claude/` examples. Apply the migration and deploy code together. Check a before and after count of `scores`, `pins`, `user_pins`, `boss_awards`; `npm run build` produces the six new route folders and none of the old. Regenerate types.
3. **Wall Wrecker art and sounds.** Draw bricks, paddle, ball, capsules and explosions in code with per-skin palettes and offscreen caches, delete the spritesheet and its load path, replace the two `.mp3` with generated `.wav`, update the registry `sfx` paths. Play a full level in each skin and check the console. Measure frame time with `references/perf/measure-fps.md` (agent `game-perf-booster` if it misses the target).
4. **Snake fruits.** Draw 22 fruits and the golden bonus as run tables in `lib/snake/sprites.ts`, replace the sheet drawing with cached offscreen canvases, keep the skin look, delete `fruits.png`. Play a run in every skin.
5. **Likes migration.** Write and apply `add_game_likes`. Verify with `execute_sql` as a test user: toggle on, count 1, toggle off, count 0, unknown game error, `anon` cannot call `toggle_game_like`, `anon` can call `get_game_likes`, a client cannot read or write `game_likes`. Regenerate types.
6. **Likes UI.** Create `lib/likes-db.ts` and `components/like-button.tsx` (the stat cell as a `<button>` with reset styles, optimistic update, guest redirect), use it in `app/games/[id]/page.tsx` in place of `Plays`, remove `plays` everywhere. Manual test with two accounts and a guest.
7. **Robo Vault paste.** Add `parsePasswordText(text)` to `lib/robo-vault/password.ts` (cell labels from `cellLabel`, tolerant of case, commas and extra spaces, returns the grid or `null`). In `lib/robo-vault/engine.ts` add `PASTE` as column 0 of the option row (then `OK`, `BACK`), a `paste` listener on `window` active only while the entry screen is open and removed on close and in `destroy()`, `pasteFromClipboard()` with `PRESS CTRL+V` fallback, and the messages `PASTED` and `NOT A PASSWORD`. Pasting only fills the grid. Test with the existing `COPY` button.
8. **Pin catalog and art.** Draw the 64 sprites, choose the pins by relevance with the counts above, add them to `lib/pins/catalog.ts` and `lib/pins/sprites.ts`, update the file header. Check totals (215; 121 / 44 / 34 / 12 / 4), unique names and ids with a throwaway script. The almanac shows 215 cards (new ones as silhouettes, the server does not know them yet).
9. **Pins migration.** Write and apply `add_pins_new_games` (64 inserts). Verify with `execute_sql`: counts per rarity, `pull_pin(100)` still works, a 10,000-roll simulation of `pull_pin(5)` keeps common between 57% and 63% and epic between 0.5% and 1.5%, no function hard-codes 151.
10. **Machine sounds.** Create `lib/pins/sfx.ts` with the tick, five crank tiers and five reveal tiers. Check by listening through a temporary dev page (not shipped) and that `PIN_SFX_TIERS` values grow strictly with rarity.
11. **Crank and radial selector.** In `components/pin-machine.tsx` and the `.pm-*` rules of `app/globals.css`: lever as a button, radio group with the selection rules, `playCrankTick` on click, `playCrank` on result, `playReveal` on reveal, `SOUND ON/OFF` toggle. Keep the odds table, result card, errors and `aria-live`. Test on desktop and below 768 px.
12. **Docs.** Final `CLAUDE.md` pass: names, ids, art in code, Likes tables and RPCs, advisor notes, pin counts 215, crank, radio, sounds, paste. Confirm no stale old name remains in the files listed in the acceptance criteria.

## Acceptance criteria

**Renames and original art**

- [ ] `GAMES` has the six new ids, titles and covers from the mapping table, and no entry still has `tetris`, `pong`, `asteroids`, `frogger`, `space-invaders` or `arkanoid` as id.
- [ ] `npm run build` creates `/games/<new-id>/` and `/games/<new-id>/play/` for the six games, and none for the old ids.
- [ ] A search for the old names and ids (`Tetris`, `Pong`, `Asteroids`, `Frogger`, `Space Invaders`, `Arkanoid`, in any case, and the old ids) finds nothing in `app/`, `components/`, `lib/`, `public/`, `README.md`, `CLAUDE.md`, `GAME-INTEGRATION-GUIDE.md`, `references/GAMES.md` and `.claude/`, except the Tetris music file name and the explanatory text of this rename in `CLAUDE.md`. Old specs, old migration files and `references/StarterGames/` are exempt.
- [ ] No pin id in `PINS`, `PIN_SPRITES` or the `pins` table starts with `asteroids-`, `arkanoid-`, `frogger-`, `space-invaders-`, `tetris-` or `pong-`; the five pins in the "Pins section references" table have the new names and ids, and the epic one is still `epic`.
- [ ] The almanac card and the pull result card show the new game title for every pin of a renamed game.
- [ ] A search of `components/pin-*.tsx`, `lib/pins/` and `lib/pins-db.ts` for the old game names, `Invader`, `Vaus` and `Mystery Ship` finds nothing.
- [ ] After the migration `games` holds the six new ids and no old one; the row counts of `scores`, `pins`, `user_pins`, `boss_awards` and `games` are the same as before; a score saved before the rename shows under the new game's leaderboard.
- [ ] `pins.game_id` and every `pins.id` prefix use the new ids; a user who owned a pin before the rename still owns it (`user_pins` rows unchanged in count) and sees it in the almanac.
- [ ] Saving a score and earning a credit work for each of the six renamed games.
- [ ] The Hall of Fame, home `LATEST SCORES` and the Royalty ranking show the new titles.
- [ ] `public/game-assets/arkanoid/spritesheet-breakout.png`, `ball-bounce.mp3`, `break-sound.mp3` and `public/game-assets/snake/fruits.png` no longer exist, and no code references them.
- [ ] Wall Wrecker plays in `retro`, `pastel` and `neon` with no console error, bricks, paddle, ball, capsules and explosions drawn from code, and both sound effects play.
- [ ] Snake shows 22 distinct fruits and the golden bonus in every existing skin with no console error.
- [ ] Wall Wrecker and Snake stay within the SPEC 12 frame-time target (measured with `references/perf/measure-fps.md`).

**Robo Vault paste**

- [ ] The password entry screen shows `PASTE`, `OK` and `BACK` in the option row, and `PASTE` reads the clipboard and fills the grid.
- [ ] `Ctrl+V` on the entry screen fills the grid with a valid password text and does nothing on any other Robo Vault screen.
- [ ] A password copied with the existing `COPY` button, pasted back and confirmed with `OK`, restores progress.
- [ ] Non-password text fills nothing and shows `NOT A PASSWORD`; with no clipboard access the screen shows `PRESS CTRL+V`.
- [ ] No `paste` handler is left on `window` after the entry screen closes or the engine is destroyed.

**Likes**

- [ ] `/games/[id]` shows `Likes` instead of `Plays` with the same size, font, color and spacing as the other stat cells; the word `Plays` no longer appears there.
- [ ] A signed-in user clicking `Likes` raises the count by 1 and sets `aria-pressed="true"`; clicking again lowers it by 1 and clears it; reloading keeps the state.
- [ ] Two accounts liking the same game show 2; one account cannot make it 2 by clicking twice.
- [ ] A guest sees the count; clicking goes to `/auth` and returns to the same game page after sign in.
- [ ] A failed request reverts the optimistic count.
- [ ] A signed-in client cannot `select`, `insert`, `update` or `delete` on `game_likes`; `anon` calling `toggle_game_like` fails.
- [ ] `plays` no longer exists in `lib/games.ts`.

**Pins**

- [ ] `PINS` has 215 entries: 121 common, 44 rare, 34 super rare, 12 ultra rare, 4 epic, unique names and ids, numbers 1 to 215; the `pins` table matches row for row (id, number, game, rarity).
- [ ] Marcy Delrre, Frankford Delrre and the Wingshot astronaut are `epic`, and the existing epic stays `epic`.
- [ ] The new counts per game are 20 / 20 / 12 / 4 / 8 and each of the five games has at least one rare or better pin.
- [ ] All 64 new sprites come from `lib/pins/sprites.ts` (16x16, at most 6 colors); no file in `public/game-assets/` is reused.
- [ ] The almanac shows 215 cards ordered `No. 001` to `No. 215`; the counter reads `OWNED n / 215`; unowned cards still show only number, silhouette and `???`.

**Machine**

- [ ] Clicking or tapping the crank pulls the selected cost; `Enter` and `Space` on the focused crank do the same.
- [ ] The cost options are a radio group: arrow keys move the selection, selecting does not pull, one option selected at a time.
- [ ] Unaffordable options cannot be selected; after a pull that leaves too little balance the selection drops to the highest affordable option; under 5 credits the crank is disabled and the not-enough-credits note shows.
- [ ] `100` is disabled when all 215 pins are owned.
- [ ] A guest sees the crank and selector disabled and the `SIGN IN TO COLLECT PINS` link.
- [ ] Clicking the crank plays a tick at once, the result plays a crank sound for its rarity, the reveal plays a reveal sound for its rarity.
- [ ] In `PIN_SFX_TIERS`, `crankMs`, `revealMs` and `voices` increase strictly from common to epic, and the epic reveal is at least 2.2 s.
- [ ] `SOUND OFF` silences tick, crank and reveal and stops one that is playing; the machine works the same muted.
- [ ] With Web Audio unavailable the machine still pulls and reveals with no console error.
- [ ] No `localStorage`, cookie or table stores the sound toggle or the selected cost.

**General**

- [ ] No `mix-blend-mode`, animated `mask-image` or full-screen animated layer is added (SPEC 12 rules); with `prefers-reduced-motion: reduce` the pull result still appears without the drop animation.
- [ ] `npm run lint` and `npm run build` pass; the console shows no new errors on `/`, `/library`, `/pins`, a game page and a play page of each renamed game.
- [ ] Supabase advisors show no new warning other than the accepted executable `security definer` functions (`get_game_likes`, `toggle_game_like`) and the `rls_enabled_no_policy` INFO for `game_likes`.

## Decisions

- **Yes:** one spec for everything, ordered so it can split into A (renames and art), B (Likes and paste), C (pins). Discarded: three specs; the request came as one plan. Recommended if the work stalls: split along those lines.
- **Yes:** full rename including ids and URLs (user decision). Accepted costs: old URLs and bookmarks stop working (static export cannot redirect), a data migration touching scores and pins, and a coordinated deploy. Discarded: titles only (leaves the old names in URLs and the database).
- **Yes:** `Street Jumper` (typo fixed with the user's confirmation).
- **Yes:** do the title step first (step 1) and the id step after, so the visible fix is committable before the risky migration.
- **Yes:** the rename migration moves rows by an explicit mapping and keeps all counts; foreign keys are found by query, not assumed. Discarded: deleting and re-inserting rows (would lose scores and owned pins).
- **Yes:** old migration files, old specs and `references/StarterGames/` keep the old names (history). `CLAUDE.md` notes the rename once.
- **Yes:** Arkanoid art redrawn in code (user decision), pre-rendered to offscreen canvases to keep frame time. Skins become palettes. Discarded: a new PNG sheet.
- **Yes:** Snake fruits also move to code run tables, same approach as Arkanoid and as the pins and other engines. The user asked to replace the fruit art but did not choose the method; this keeps the repo free of third-party sheets. Discarded: a new PNG sheet.
- **Yes:** replace the Arkanoid sounds and the Snake fruit art (user choice). **No:** replace the Tetris music in this spec (user did not select it); it stays flagged.
- **Yes:** rename the five pins whose names are the originals' own terms (`Vaus Paddle`, `Invader`, `Invader Bomb`, `Waving Invader`, `Mystery Ship`) and every pin id and label that names an old game (user request). New names are descriptive, not clever. **No:** renaming plain-word pins that only resemble an original (`Car`, `Frog`, `Log`): a plain word is not protectable. Discarded: renaming all 151 pins.
- **Yes:** pin renames ride on the game rename migration (one deploy, one set of counts). Rarity, sprite and number stay, so owners keep their pins.
- **Yes:** Likes through RPCs and a table with no client access, like credits and `boss_awards`. Discarded: client insert and delete under RLS policies (breaks the no-client-write rule).
- **Yes:** public count through `get_game_likes`, no public read of `game_likes`.
- **Yes:** guest click redirects to `/auth` with return-to (user choice).
- **Yes:** liked state is only the accent color plus `aria-pressed`, so the cell keeps its look.
- **Yes:** remove `plays` from `GAMES` (the stat is now Likes).
- **Yes:** paste on Robo Vault only fills the grid, `PASTE` is column 0 (then `OK`, `BACK`) like Marcy's. Discarded: auto-submit. Accepted cost: `OK` moves one column.
- **Yes:** 64 new pins (20 / 20 / 12 / 4 / 8): 3 epics fixed by the user, the other 61 as 30 / 14 / 11 / 6. Accepted: epic is 4 pins at the unchanged 1% and 3% odds, so each is rarer. Discarded: changing the odds.
- **Yes:** Pong and Tetris pins drawn for the pin only (user decision), under the new game ids.
- **Yes:** new pins numbered 152 to 215 so existing pin numbers never change. Players who owned all 151 become incomplete and the 100-credit pull reopens.
- **Yes:** Web Audio synthesis for machine sounds; tiered crank sound plays when the result arrives, with a rarity-free tick at click. Discarded: `.wav` files; guessing rarity client-side.
- **Yes:** `SOUND ON/OFF` toggle, default on, memory only, not tied to `prefers-reduced-motion`.
- **Yes:** the crank is the only trigger; the radio group only selects, and the selection drops to the highest affordable option after a pull.

## Risks

| Risk                                                                                                  | Mitigation                                                                                                                          |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| The rename migration is applied while the deployed client still uses old ids, so saves and pulls fail | Apply the migration and deploy the code in the same window; step 2 is one commit. Count rows before and after                       |
| A foreign key or function mentions an old id and breaks silently                                      | Step 2 lists every FK to `games(id)` and `pins(id)` and reads every function body that names an old id before writing the migration |
| Old links, bookmarks and shared URLs break                                                            | Accepted (user chose full rename). Static export cannot redirect                                                                    |
| Redrawn Arkanoid and Snake art costs frame time                                                       | Pre-render to offscreen canvases per skin and color; measure with `references/perf/measure-fps.md`                                  |
| Skins look different after palettes replace the CSS filters                                           | Palettes keep each skin's mood; compare in each skin before the step is done                                                        |
| The `pins` migration is applied before the client knows the new ids                                   | Ship step 8 (client catalog) before or with step 9; the UI reads `PIN_BY_ID`                                                        |
| Browsers block audio before a user gesture, iOS needs `resume()`                                      | Create and resume the `AudioContext` inside the crank click; any failure is swallowed                                               |
| A reveal sound plays while a new pull starts                                                          | `playCrankTick` and `setPinSfxMuted` stop playing voices first                                                                      |
| Like spam toggling                                                                                    | One row per user and game bounds data; a per-user rate limit is a future spec                                                       |
| `pull_pin` or another function hard-codes the catalog size                                            | Step 9 reads the function bodies and runs the 100-credit and 10,000-roll checks                                                     |
| A stale name stays in an agent or skill file                                                          | Acceptance criterion searches `.claude/`; the exemptions are listed                                                                 |
| Wrong paste layout                                                                                    | `parsePasswordText` accepts only the 25 grid labels; `decodePassword` still validates the checksum on `OK`                          |

## What is **not** in this spec

- The Tetris music.
- Redirects or aliases for the old URLs and ids.
- Renaming plain-word pins that only resemble an original (`Car`, `Frog`, `Log`).
- Gameplay, scoring or skin-id changes in renamed games.
- Who liked a game, likes elsewhere, guest likes.
- Volume slider, music on `/pins`, haptics for the machine, new odds or costs.
- Paste for any game other than Robo Vault.

Each one of those, if it lands, goes in its own spec.
