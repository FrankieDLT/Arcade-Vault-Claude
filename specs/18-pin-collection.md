# SPEC 18 — Pin Collection (credits and candy-dispenser machine)

> **Status:** Implemented
> **Depends on:** SPEC 01, SPEC 06, SPEC 10, SPEC 13, SPEC 14
> **Date:** 2026-11-10
> **Objective:** Replace the dead `CREDITS · 03` nav pill with a real per-account credit balance earned at every non-zero Game Over, and add a `/pins` tab with a candy-dispenser machine that exchanges credits for collectible pixel-art pins, shown below it as an almanac with silhouettes for pins not yet obtained.

## Why this spec exists

The nav shows `CREDITS · 03` (`components/nav.tsx`, desktop bar and mobile drawer) but it is hard-coded and does nothing. This spec gives credits a meaning: a retention loop on top of the existing games, with no change to any engine.

Credits and pins are account data, so they follow the same rules as scores: Supabase, RLS, no client writes, every change through an RPC. The client only asks; the server rolls the dice, charges the credits and records the result. The pin art is **redrawn by us** as small pixel sprites. It must not reuse third-party sheets (Arkanoid sheet, Snake fruits, Tetris music) because the site is public (see the third-party asset note in `CLAUDE.md`).

## Scope

**In:**

- **Credits.** *(Changed after approval: play time, not one per run.)* One credit (also called a coin) per 30 seconds of active play, at most 5 per game, given at Game Over, for a signed-in, non-banned user whose score is greater than 0. The client reports the active play seconds; the server caps them at the real time since the last award. Applies to every catalog game, real and fake. Starting balance is 0.
- **Nav.** The `CREDITS · 03` pill (desktop bar and mobile drawer) shows the real balance (`CREDITS · 07`, two digits minimum, `99+` above 99) and links to `/pins`. A new nav tab `Pin Collection` (`/pins`) sits between `Hall of Fame` and `About`, with the same active-state rule as the other tabs. Guests see `CREDITS · 00`.
- **GAME OVER modal.** One extra line in the existing modal: `+N CREDITS` (`+1 CREDIT` for one) when awarded, nothing when not awarded. A guest sees no line (the existing `SIGN IN TO SAVE YOUR SCORE` block stays as is).
- **Route `/pins`.** Two stacked sections: the machine on top, the almanac below. Guests see both, with the machine disabled and a `SIGN IN TO COLLECT PINS` prompt linking to `/auth` (through the existing `av_auth_next` flow). The almanac for a guest shows every pin as a silhouette.
- **Machine (candy dispenser).** Pure CSS and DOM, no canvas, with a coin slot, a glass globe, a dispense chute and a capsule that opens to reveal the pin. Three buttons:
  - `5 CREDITS`: standard odds.
  - `10 CREDITS`: better rarity odds, biased to new pins.
  - `100 CREDITS`: guaranteed new pin, lowest rarity first.
  - A button is disabled when the balance is below its cost, while a pull is running, and (100 only) when the collection is complete. The pull result card shows the pin sprite, name, rarity, `NEW!` or `DUPLICATE · +N CREDITS`, and the new balance.
  - Animation respects `prefers-reduced-motion` (result shown without the drop animation).
- **Rarities and odds** (percent of pulls, not of the catalog):

  | Rarity     | Id           | 5 credits | 10 credits |
  | ---------- | ------------ | --------- | ---------- |
  | Common     | `common`     | 60        | 40         |
  | Rare       | `rare`       | 20        | 25         |
  | Super rare | `super-rare` | 15        | 22         |
  | Ultra rare | `ultra-rare` | 4         | 10         |
  | Epic       | `epic`       | 1         | 3          |

  Inside a rarity every pin has equal chance. The 10-credit pull rolls the table above; if the rolled pin is already owned it rerolls **once** and keeps the second result (new or not).

- **100-credit pull.** Picks a random unowned pin from the most common rarity that still has unowned pins.
- **Duplicates.** The collection holds only one copy of each pin. A duplicate is never stored (no second row, no count): it is deleted on the spot and converted to credits by rarity: common 1, rare 2, super rare 3, ultra rare 5, epic 10. The primary key `(user_id, pin_id)` on `user_pins` enforces one copy at database level.
- **Pin catalog.** The collection starts with 151 different pins, divided by rarity in proportion to the odds (91 common, 30 rare, 23 super rare, 6 ultra rare, 1 epic; table below), drawn from real games with sprites, in three kinds: `enemy`, `powerup`, `character`.
- **Almanac.** A grid of cards, one per pin, ordered by number `No. 001` to `No. 151`. An owned card shows sprite, name, number, rarity color, source game and kind. An unowned card shows only the number, a solid silhouette of the sprite and `???` as name. A counter `OWNED 12 / 151` heads the section.
- **Persistence** in Supabase per account, server-side RPCs only (see Data model).
- **Sprite art.** Pixel run tables on a 16x16 grid in `lib/pins/sprites.ts`, drawn by us, rendered by a `PinSprite` canvas component with an optional silhouette mode.
- Migration applied with MCP `apply_migration`, `database.types.ts` regenerated, `CLAUDE.md` updated.
- UI designed with `/frontend-design`.

**Out of scope (for future specs):**

- Trading, gifting or selling pins; a pin shop that spends credits on a chosen pin.
- Showing pins on the account page, the leaderboard or next to a player name.
- Pin art for fake catalog games, Tetris and Pong (no sprites to base pins on). They still award credits.
- Credits for guests (localStorage mode). Guests earn nothing.
- Per-pin copy counts (`x3`). Only the fixed almanac number is shown.
- Sounds and haptics for the machine.
- Daily bonus, streaks, credit purchase, or any real-money path.
- Strong anti-farming. Only the 30 s cooldown (see Decisions).
- Changes to engines, the registry types or the score flow beyond the one `awardCredit` call at game over.
- Automated tests (no test runner is configured).

## Data model

Tables (migration `add_pin_collection`; the file name carries the version `apply_migration` assigns):

```sql
-- static catalog, manual copy of lib/pins/catalog.ts (same discipline as `games`)
create table public.pins (
  id        text primary key,          -- 'space-invaders-squid'
  number    int  not null unique,      -- 1..151, almanac order
  game_id   text not null references public.games(id),
  name      text not null,
  kind      text not null check (kind in ('enemy','powerup','character')),
  rarity    text not null check (rarity in
            ('common','rare','super-rare','ultra-rare','epic'))
);

create table public.credits (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  balance         int  not null default 0 check (balance >= 0),
  last_award_at   timestamptz
);

create table public.user_pins (
  user_id      uuid not null references auth.users(id) on delete cascade,
  pin_id       text not null references public.pins(id),
  obtained_at  timestamptz not null default now(),
  primary key (user_id, pin_id)
);
```

RLS on all three. `pins`: public select. `credits` and `user_pins`: a signed-in user selects only own rows (`user_id = auth.uid()`). No insert, update or delete policy for clients on any of them. Column grants follow the `scores` pattern: list columns explicitly, never `select *`.

RPCs (`security definer`, `set search_path = ''`, execute granted to `authenticated` only, never `anon`):

```sql
-- called at Game Over. Returns { awarded, balance, reason }.
-- reason: 'ok' | 'zero_score' | 'banned' | 'cooldown'
award_credit(p_game_id text, p_score int) returns jsonb

-- p_cost in (5, 10, 100) else error. Locks the credits row (for update),
-- checks balance, rolls, writes user_pins, applies duplicate refund,
-- all in one transaction.
-- Returns { pin_id, rarity, is_new, refund, balance }.
pull_pin(p_cost int) returns jsonb
```

`award_credit` rules: `auth.uid()` not null; `p_score` between 1 and 10,000,000 (0 gives `zero_score`); `p_game_id` exists in `games`; caller not `profiles.banned` (`banned`); at least 30 s since `credits.last_award_at` (`cooldown`); otherwise upsert `balance + 1` and set `last_award_at = now()`.

`pull_pin` rules: 5 uses the 5-credit column; 10 uses the 10-credit column plus the single reroll on owned; 100 requires at least one unowned pin (else error `collection_complete`) and picks randomly inside the lowest rarity with unowned pins. For 5 and 10 a duplicate adds the refund to the balance in the same transaction. Banned users may still pull (a ban only blocks scores and new credits).

Client structures:

```ts
// lib/pins/catalog.ts (framework-free)
export type PinRarity =
  "common" | "rare" | "super-rare" | "ultra-rare" | "epic";
export type PinKind = "enemy" | "powerup" | "character";
export type Pin = {
  id: string;
  number: number;
  gameId: string;
  name: string;
  kind: PinKind;
  rarity: PinRarity;
};
export const PINS: Pin[]; // 151 entries
export const RARITY_ORDER: PinRarity[];
export const PULL_COSTS = [5, 10, 100] as const;
export const DUPLICATE_REFUND: Record<PinRarity, number>; // 1,2,3,5,10
export const RARITY_ODDS: Record<5 | 10, Record<PinRarity, number>>; // display only

// lib/pins/sprites.ts: palette + 16 row strings per pin id
export type PinSpriteDef = { palette: Record<string, string>; rows: string[] };
export const PIN_SPRITES: Record<string, PinSpriteDef>;
```

`RARITY_ODDS` in the client is for the info line under the machine only; the server is the only source of truth for the roll.

### Pin catalog (151)

The collection starts with **151 different pins**. The pins are divided by rarity in proportion to the pull odds (60 / 20 / 15 / 4 / 1 percent of 151, rounded so the total is exactly 151):

| Rarity | Share | Pins |
| --- | --- | --- |
| Common | 60% | 91 |
| Rare | 20% | 30 |
| Super rare | 15% | 23 |
| Ultra rare | 4% | 6 |
| Epic | 1% | 1 |

Rules for filling the list (done in step 2, the final list lives in `lib/pins/catalog.ts` and the migration seed):

- Every pin is one distinct sprite found in a real game with sprites: Space Invaders, Galactic DogFight, Arkanoid, Snake, Glowmaw, Frogger, Asteroids. Kinds: `enemy`, `powerup`, `character`.
- Step 2 starts with an inventory of the sprites each game really has (invader rows, DogFight ships and pods, Arkanoid power-ups and bricks, the 22 Snake fruits plus the golden bonus, Glowmaw drifters and pearl, Frogger vehicles, logs and turtles, Asteroids rock sizes, ship and saucer). If the inventory finds fewer than 151 distinct sprites, the gap is filled with a few generic pixel sprites (for example star, heart, coin, gem, mushroom, ghost, key, shield), kind `powerup` or `character`, `game_id` of the closest real game, **all rarity `common`**. Generic pins count inside the 91 commons, so the rarity totals never change. Generic pins are only used to fill the gap: real sprites come first, and no sprite is taken from fake games, Tetris or Pong.
- Rarity goes by how special the sprite is in its game: basic fodder (invader rows, fruits, rocks, bricks, cars) is common; the player ship, small power-ups and mid enemies are rare or super rare; Boss, capture-related sprites and golden items are ultra rare; the Space Invaders Mystery Ship is the epic pin.
- Real-sprite pins are spread across games so no single game holds more than 35, and every game holds at least one rare or better pin. This cap does not apply to generic pins.
- Names are unique across the catalog. Numbers `1..151` follow source game order, then kind, then name.

## Implementation plan

1. **Migration.** Write and apply `add_pin_collection` (tables, RLS, grants, seed of the 151 `pins` rows, `award_credit`, `pull_pin`). Verify with MCP `execute_sql` as a test user: award, cooldown, zero score, pull with insufficient balance, pull 100 with the collection complete. Regenerate `lib/supabase/database.types.ts`. The system still runs: nothing in the UI uses the tables yet.
2. **Catalog and art.** Create `lib/pins/catalog.ts` (151 pins, constants) and `lib/pins/sprites.ts` (151 sprites, 16x16, at most 6 colors each). Create `components/pin-sprite.tsx` (canvas, props `pinId`, `size`, `silhouette`). Check the catalog against the migration seed (ids, numbers, rarities identical). No visible change yet.
3. **Client data layer.** Create `lib/pins-db.ts` (`fetchCredits`, `fetchOwnedPins`, `awardCredit`, `pullPin`, client only, errors mapped to a `PinsError` kind). Create `components/credits-provider.tsx` (mounted in `app/layout.tsx`, `useCredits()` returns `{ balance, status, refresh, setBalance }`, loads on sign-in, resets on sign-out, `0` and `ready` for guests and for `unavailable`).
4. **Nav.** Replace both hard-coded `CREDITS · 03` with the real balance as a link to `/pins`; add the `Pin Collection` tab. Manual test: balance appears after sign-in, guest shows `00`.
5. **Award at Game Over.** In `components/game-player.tsx`, on game over for a signed-in user with score > 0 call `awardCredit(gameId, score)` once per run, update the provider balance, and show `+1 CREDIT` in the modal when `awarded`. A failed call shows nothing and never blocks SAVE SCORE or PLAY AGAIN.
6. **Almanac page.** Create `app/pins/page.tsx` and `components/pin-almanac.tsx` (cards, silhouettes, counter, rarity colors from page tokens, responsive 2 to 6 columns). Wire `fetchOwnedPins`. Machine section still a placeholder.
7. **Machine.** Create `components/pin-machine.tsx`: dispenser art in CSS, three buttons, pull flow (call `pullPin`, play the drop animation, result card, update balance and owned set at once). Errors (`insufficient`, `collection_complete`, network) shown inline in the machine, balance unchanged.
8. **Polish and docs.** Mobile layout under 768px (machine above almanac, buttons stacked), keyboard focus and `aria-live` result, `prefers-reduced-motion`. Update `CLAUDE.md` (routes, credits, tables, RPCs, catalog sync note) and `README` only if it lists routes.

## Acceptance criteria

- [ ] `CREDITS · 03` no longer appears anywhere in the codebase.
- [ ] A signed-in user finishing any game with score > 0 sees `+1 CREDIT` in the GAME OVER modal and the nav balance rises by 1.
- [ ] A game over with score 0 awards nothing and shows no `+1 CREDIT` line.
- [ ] A second game over within 30 s of the last award awards nothing (balance unchanged), and SAVE SCORE still works.
- [ ] A banned user (`profiles.banned = true`) is awarded nothing.
- [ ] A guest earns nothing, sees `CREDITS · 00`, and on `/pins` the three buttons are disabled with a `SIGN IN TO COLLECT PINS` link to `/auth`.
- [ ] Calling `award_credit` or `pull_pin` as `anon` fails; a signed-in client cannot `insert`, `update` or `delete` on `credits` or `user_pins`.
- [ ] `/pins` is reachable from the `Pin Collection` nav tab and from the credits pill, on desktop and on the mobile drawer, and the tab shows active there.
- [ ] A 5-credit pull with balance 5 ends with balance `0 + refund` where refund is 0 for a new pin and 1 to 10 by rarity for a duplicate; the result card says `NEW!` or `DUPLICATE · +N CREDITS` correctly.
- [ ] Buttons are disabled when balance < cost; a forged `pull_pin(5)` call with balance 4 returns an error and changes nothing.
- [ ] `pull_pin(7)` returns an error.
- [ ] Over 10,000 simulated `pull_pin(5)` rolls on a test account (rolled in SQL, then cleaned), common is between 57% and 63% of rolls and epic between 0.5% and 1.5%.
- [ ] After pulling the same pin twice, `user_pins` has exactly one row for it, the second pull refunds the rarity amount, and the almanac count does not change.
- [ ] The pin counts per rarity in `PINS` and in the `pins` table are exactly 91 common, 30 rare, 23 super rare, 6 ultra rare and 1 epic (151 total, unique names).
- [ ] A 10-credit pull never has a lower epic rate than the 5-credit table in the same simulation (epic 3% vs 1%).
- [ ] A 100-credit pull always returns a new pin of the lowest rarity that still had unowned pins; after all commons are owned it returns a rare.
- [ ] With all 151 pins owned the 100-credit button is disabled and the RPC returns `collection_complete`.
- [ ] After a pull the almanac card flips from silhouette to full sprite without a reload, and `OWNED n / 151` increases by 1 for a new pin and stays for a duplicate.
- [ ] Every unowned card shows the number, a solid silhouette and `???`, and no name, rarity or game text appears in the DOM for it.
- [ ] The almanac shows exactly 151 cards ordered `No. 001` to `No. 151`; `PINS` in `lib/pins/catalog.ts` matches the `pins` table row for row (id, number, game, rarity).
- [ ] No sprite file or image from `public/game-assets/` is reused; all 151 sprites come from `lib/pins/sprites.ts`.
- [ ] No `mix-blend-mode`, no animated `mask-image` and no full-screen animated layer is added (SPEC 12 rules).
- [ ] With `prefers-reduced-motion: reduce` the result appears without the drop animation.
- [ ] `npm run lint` and `npm run build` pass; the console shows no new errors on `/pins`, `/` and a game page.
- [ ] Supabase advisors show no new warning other than the accepted executable `security definer` functions (record them in `CLAUDE.md`).

## Decisions

- **Yes:** Supabase per account with RPCs. Odds, charging and ownership must not be editable from the browser. Guests earn nothing, like SAVE SCORE.
- **No:** localStorage mode. Cheatable and lost with browser data; guest merge on sign-in adds complexity.
- **Yes:** `pins` catalog table plus a client copy in `lib/pins/catalog.ts`. The server needs the pool to roll; the UI needs it for silhouettes. Same manual-sync rule as `games`.
- **Yes:** odds percentages apply to pulls, not to the catalog share. the 151 pins are split 91/30/23/6/1 so catalog shares match the odds (user decision).
- **Yes:** 10-credit pull = shifted table plus one reroll on an owned pin. Delivers "better odds at rarities and new" with a simple rule. Discarded: roll twice and keep the rarer (ignores "new").
- **Yes:** 100-credit pull takes the lowest rarity left. Matches "guarantee new, prioritizing low rarities". Discarded: rarity-weighted among unowned (lets epic jump the queue).
- **Yes:** duplicate refund scales by rarity (1, 2, 3, 5, 10) instead of the flat 1 in the original wording. User decision. Expected refund per pull (about 1.75 at 5 credits, 2.4 at 10) stays far below the cost, so the economy cannot loop.
- **Changed:** credits are now 1 per 30 s of active play, max 5 per game (`award_credit(p_game_id, p_score, p_seconds)`); the fixed 30 s cooldown became the real-time cap on the reported seconds. Earlier decision, kept for history: `award_credit` with score > 0, not banned and a 30 s cooldown. Discarded: tie to saved score (players who skip SAVE SCORE lose the coin); no cooldown (trivial farming by ending runs with END).
- **Yes:** the cooldown means very short runs can award no coin. Accepted: simplest limit that blocks END-spam.
- **Yes:** if the games have fewer than 151 distinct sprites, the gap is filled with generic common sprites (user decision). Discarded: lowering the 151 target, or promoting filler to higher rarities.
- **Yes:** pin number is fixed almanac order; no per-pin copy count. User decision.
- **Yes:** credits for every game over, fake games included, because the user said "each Game Over". Only pins are limited to games with real sprites.
- **Yes:** pins are redrawn run-table sprites, not the existing PNG sheets, to avoid third-party license issues.
- **Yes:** banned users can still spend credits they already hold; a ban targets leaderboard integrity, and new credits are blocked.
- **Yes:** route `/pins` and nav label `Pin Collection`, pill links to it.
- **No:** rarity-gated pin pool per game or per player level. Not asked.

## Risks

| Risk                                                        | Mitigation                                                                                                                                    |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Credit farming by short or scripted runs                    | 30 s cooldown, score > 0, ban check. A client can still lie about the score; accepted for this spec, a score-verified award is a future spec. |
| Fewer than 151 real sprites exist in the games | Step 2 inventories first and fills the gap with generic common pins (star, heart, gem, ...); counts stay 91/30/23/6/1. |
| `pins` table and `lib/pins/catalog.ts` drift                | Acceptance criterion compares them; `CLAUDE.md` documents the sync rule.                                                                      |
| Concurrent pulls double-spend                               | `pull_pin` locks the `credits` row with `for update` inside one transaction.                                                                  |
| 151 canvases on the almanac slow the page                    | Each `PinSprite` draws once into a tiny canvas and stops; no animation loop.                                                                  |
| Advisor warns about executable `security definer` functions | Accepted, same as `royalty_of_games`; grants limited to `authenticated`.                                                                      |

## What is **not** in this spec

- Trading, gifting, selling or choosing a specific pin.
- Pins on the account page, leaderboard or next to names.
- Pin art for fake games, Tetris or Pong.
- Credits or pins for guests.
- Per-pin copy counts.
- Sounds, haptics, daily bonuses or any real-money path.
- Score-verified, cheat-proof credit awards.

Each one of those, if it lands, goes in its own spec.
