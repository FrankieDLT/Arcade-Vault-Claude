# SPEC 19 — A.I Made / Human Made tag and removal of mock games

> **Status:** Approved
> **Depends on:** SPEC 01, SPEC 02, SPEC 06, SPEC 18
> **Date:** 2026-11-10
> **Objective:** Give every game an origin (`🤖 A.I MADE`, `🧑 HUMAN MADE` or split `A.I. ASSISTED`) stored in `GAMES` and the `games` table, shown as a tag on the game detail page and as an emoji next to the PLAY button of the library card, and delete the 8 mock games from the catalog and the database.

## Why this spec exists

The site is public and the games have different authors. A visible origin tag is honest about who made each game and gives future games a place to declare it.

The 8 mock games (`brick-buster`, `drop`, `serpentine`, `chomper`, `invaders`, `rocks`, `hopper`, `pixel-duel`) run a fake simulation and overlap with real games. Every game must now carry a real origin, so the mocks go in the same change instead of being tagged.

## Scope

**In:**

- **Origin field.** New required field `origin: "ai" | "human" | "assisted"` on `Game` (`lib/types.ts`) and on every `GAMES` entry (`lib/games.ts`). All 9 real games are `ai`. No game is `human` or `assisted` yet; the values exist for future games.
- **Origin column in the database.** New column `games.origin` (`text not null`, check in `('ai','human','assisted')`), added by a migration, kept identical to `GAMES.origin` (manual-copy rule). The 9 remaining rows get `ai`. `database.types.ts` is regenerated.
- **Tag labels.** One table in `lib/games.ts` maps the origin to emoji, label and short name:

  | Origin     | Emoji                        | Detail tag text | Accessible name |
  | ---------- | ---------------------------- | --------------- | --------------- |
  | `ai`       | 🤖                           | `A.I MADE`      | `A.I Made`      |
  | `human`    | 🧑                           | `HUMAN MADE`    | `Human Made`    |
  | `assisted` | split 🤖 (left) + 🧑 (right) | `A.I. ASSISTED` | `A.I. Assisted` |

- **Split emoji.** No Unicode emoji is half robot, half human. `A.I. ASSISTED` uses a CSS composite in a new component `components/origin-emoji.tsx`: one inline box holding two copies of the emoji, `🤖` clipped to its left half and `🧑` clipped to its right half with a static `clip-path` (vertical split line). It scales with `font-size`, adds no image file and is used by both the card and the detail tag. The single-emoji origins render through the same component as plain text.
- **Detail page** (`app/games/[id]/page.tsx`, block `.detail-tags`): a new `<span>` with the emoji and the tag text (`🤖 A.I MADE`, `🧑 HUMAN MADE` or split emoji + `A.I. ASSISTED`), placed **first**, before the category. Same style as the other tags (`ARCADE`, `1 PLAYER`, `KEYBOARD / TOUCH`, `RETRO 1985`).
- **Library card** (`components/game-card.tsx`, used by `/library` and the home preview): only the emoji, in the `.row`, to the **left** of the visual PLAY button. The emoji span has `aria-label` (`A.I Made` / `Human Made` / `A.I. Assisted`) and the same text as `title`. No label text on the card.
- **Mock game removal, code.** Delete the 8 mock entries from `GAMES`. Delete `components/game-player.tsx` fake-simulation branch (random score timer and `.game-arena`) and its dead CSS. `getGameDefinition(gameId)` now always returns a definition for every catalog game. Delete the CSS covers used only by the mocks (`cover-bricks`, `cover-tetro`, `cover-snake`, `cover-glot`, `cover-invaders`, `cover-rocas`, `cover-rana`, `cover-duelo`) in `app/globals.css`, after checking that no other selector uses them.
- **Mock game removal, database.** One migration `remove_mock_games` (applied with MCP `apply_migration`, file in `supabase/migrations/` with the applied version) deletes the `scores` rows whose `game_id` is one of the 8 ids, then deletes the 8 `games` rows. Today only `drop` has a score (1 row); none of the 8 has `pins` rows. A second migration `add_games_origin` adds the column (see Data model). Each migration is its own file.
- **Catalog stat.** The home stat `12+ GAMES` in `lib/home.ts` becomes `9+ GAMES` (the catalog now has 9).
- **Docs.** Update `CLAUDE.md` (app state, Games section: no fake games, `origin` field, catalog sync, `GamePlayer` text), `references/GAMES.md` (remove the "Catalog-only games" section and the "stays a fake catalog entry" sentences, add an Origin column) and the `add-game` and `full-game-impl` skills so a new game spec and pipeline always set `origin`.
- UI designed with `/frontend-design`.

**Out of scope (for future specs):**

- Filtering the library by origin (no new chip row).
- Per-game credits, or a link explaining the tags.
- A fourth origin value, or a score of "how much" A.I helped.
- Reading `games.origin` from Supabase in the UI (the UI keeps using `GAMES.origin`; the column is a catalog copy).
- Showing the tag on the Hall of Fame tabs, the pin almanac, the home mini-cards or the play page.
- Replacing the mocks with new real games.
- Automated tests (no test runner is configured).

## Data model

```ts
// lib/types.ts
export type Origin = "ai" | "human" | "assisted";

export interface Game {
  // ...existing fields (id, title, short, long, cat, cover, color, plays)
  /** Who made the game. Shown as a tag (detail) and an emoji (library card). */
  origin: Origin;
}
```

```ts
// lib/games.ts
// emoji: one entry = plain emoji; two entries = split (first = left half, second = right half)
export const ORIGINS: Record<
  Origin,
  { emoji: [string] | [string, string]; tag: string; name: string }
> = {
  ai: { emoji: ["🤖"], tag: "A.I MADE", name: "A.I Made" },
  human: { emoji: ["🧑"], tag: "HUMAN MADE", name: "Human Made" },
  assisted: {
    emoji: ["🤖", "🧑"],
    tag: "A.I. ASSISTED",
    name: "A.I. Assisted",
  },
};
```

Database: one new column on `games`, plus row deletes.

```sql
-- migration: add_games_origin
alter table public.games
  add column origin text not null default 'ai'
  check (origin in ('ai','human','assisted'));
alter table public.games alter column origin drop default;  -- future inserts must say it
```

The `games` row inserts of future games (`add_<id>_game` migrations) must include `origin`. Existing column grants and RLS on `games` are unchanged (public select). The second migration only deletes rows:

```sql
-- migration: remove_mock_games
delete from public.scores
 where game_id in ('brick-buster','drop','serpentine','chomper','invaders','rocks','hopper','pixel-duel');
delete from public.games
 where id in ('brick-buster','drop','serpentine','chomper','invaders','rocks','hopper','pixel-duel');
```

The `games` table stays a manual copy of `GAMES` (9 rows after this spec, now including `origin`).

## Implementation plan

1. Add `Origin`, `Game.origin` and `ORIGINS`. Add `origin: "ai"` to the 9 real entries in `GAMES`. The 8 mocks still exist at this point, so give them `origin: "ai"` temporarily to keep the build green. `npm run build` passes.
2. Create `components/origin-emoji.tsx` (plain and split rendering, `aria-label`, `title`) and its CSS in `app/globals.css`. Detail page: render the new first tag from `ORIGINS[game.origin]`. Check `/games/asteroids/`.
3. `GameCard`: render `OriginEmoji` left of the PLAY button. Add the layout CSS in `app/globals.css` (`.row` already holds the score badge and the button; keep the badge on the left edge and group emoji + button on the right). Check `/library` and the home preview at desktop and below 768 px.
4. Remove the 8 mock entries from `GAMES`. Search the repo for each mock id and fix every reference (`live-activity.tsx` only looks games up by id, confirm it has no mock id). `generateStaticParams` now yields only 9 pages per route.
5. `GamePlayer`: delete the fake simulation and the `.game-arena` branch. The player renders the registry `Canvas` for every catalog game. Remove CSS used only by the fake arena. Check that `lint` and `build` pass.
6. Delete the unused mock cover classes in `app/globals.css`. Change the home stat to `9+ GAMES`.
7. Write the `remove_mock_games` migration file and apply it with MCP `apply_migration`. Confirm with `execute_sql` (`select id from games`) that 9 rows remain and `select count(*) from scores where game_id = 'drop'` is 0.
8. Write the `add_games_origin` migration file and apply it with MCP `apply_migration`. Regenerate `lib/supabase/database.types.ts` (MCP `generate_typescript_types`). Confirm with `execute_sql` that all 9 rows have `origin = 'ai'`.
9. Update `CLAUDE.md`, `references/GAMES.md`, `.claude/skills/add-game/SKILL.md` and `.claude/skills/full-game-impl/SKILL.md`.

## Acceptance criteria

- [ ] Every entry in `GAMES` has `origin`, and `npm run build` fails if one is missing (the field is required in the type).
- [ ] `/games/<id>/` shows `🤖 A.I MADE` as the first tag for each of the 9 games.
- [ ] A test game set to `origin: "human"` shows `🧑 HUMAN MADE` on the detail page and `🧑` on the card (checked locally, then reverted).
- [ ] A test game set to `origin: "assisted"` shows the split emoji (robot on the left half, human on the right half, vertical split line) plus `A.I. ASSISTED` on the detail page, and only the split emoji on the card (checked locally, then reverted).
- [ ] The split emoji keeps both halves aligned at the card size and at the detail-tag size.
- [ ] `select origin, count(*) from games group by origin` returns one row: `ai`, 9.
- [ ] Inserting a `games` row without `origin`, or with a value outside the three, fails.
- [ ] `lib/supabase/database.types.ts` lists `origin` on `games` and was regenerated, not hand-edited.
- [ ] The library card shows only the emoji, left of the PLAY button; no `A.I MADE` text appears on any card.
- [ ] The card emoji has `aria-label="A.I Made"` and `title="A.I Made"` (or the Human Made / A.I. Assisted equivalents).
- [ ] The card layout does not overflow or wrap at 360 px, 768 px and 1280 px wide.
- [ ] `/library` lists exactly 9 games; the home preview lists 6 real games.
- [ ] `/games/drop/`, `/games/rocks/` and the other 6 mock ids return the `not-found` page.
- [ ] `components/game-player.tsx` contains no `.game-arena` and no random score timer.
- [ ] `select count(*) from games` returns 9 and `select count(*) from scores where game_id in (<8 mock ids>)` returns 0.
- [ ] The migration file exists in `supabase/migrations/` and carries the version `apply_migration` assigned.
- [ ] The Hall of Fame game tabs and the pin almanac still render without errors.
- [ ] The home stat reads `9+ GAMES`.
- [ ] `npm run lint` and `npm run build` pass; the console has no new errors on `/`, `/library`, `/games/snake/` and `/games/snake/play/`.
- [ ] `CLAUDE.md`, `references/GAMES.md` and both skills mention `origin` and no longer describe fake games.

## Decisions

- **Yes:** `origin` is required on `Game`. A future game cannot ship without declaring it.
- **Yes:** all 9 current games are `ai`. The user chose this default; `human` stays available but unused.
- **Yes:** emoji `🧑` for human (not `👨` or `👤`), chosen by the user.
- **Yes:** the tag is the first one on the detail page, so the origin is read before the category.
- **Yes:** the card shows only the emoji, with `aria-label` and `title`, so the meaning is not lost for screen readers or hover users.
- **Yes:** delete the scores of mock games in the migration. They are test scores on fake games; the user accepted the loss. Migration-only DB change (project rule).
- **Yes:** third origin `assisted` (`A.I. ASSISTED`), added by the user after approval, for games made by a person with A.I help.
- **Yes:** the split emoji is a CSS composite of 🤖 and 🧑 (user-approved option). No Unicode emoji exists for it.
- **Yes:** `games.origin` column, added by the user after approval, as a catalog copy of `GAMES.origin`. Default `'ai'` only to fill the 9 existing rows, then dropped so future game migrations must set it.
- **No:** inline SVG for the split emoji. It would not match the OS emoji of the other two tags.
- **No:** reading `origin` from Supabase in the UI. `GAMES` stays the UI source (static export, no fetch needed).
- **No:** keep the mocks and tag them. They have no real author and the user asked to delete them.
- **No:** move the `drop` score to `tetris`. It would mix a fake-game score into a real leaderboard.
- **No:** an origin filter in the library. Not requested; a future spec can add it.

## Risks

| Risk                                                                      | Mitigation                                                                                       |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| A deleted mock id is still linked or bookmarked                           | The routes return `not-found`; no redirect is added (the site is new).                           |
| A missed reference to a mock id breaks the build or a page                | Step 4 searches every mock id; acceptance checks `build` and the Hall of Fame and almanac pages. |
| The migration deletes a score row the user wanted                         | Only 1 row exists (`drop`), already reviewed; confirm the count before applying.                 |
| Emoji renders differently per OS (🧑 shows as a gendered or plain figure) | Accepted; the `aria-label` and tag text carry the meaning.                                       |
| Card row gets crowded on phones                                           | Acceptance checks 360 px; the badge text may shrink, the emoji and PLAY stay.                    |
| `GAMES.origin` and `games.origin` drift apart                             | Same manual-copy rule as the other `games` fields; every `add_<id>_game` migration sets it.      |
| Split emoji halves misalign (emoji glyph widths differ per OS font)       | Both copies share one fixed-width box and `font-size`; checked at two sizes in acceptance.       |

## What is **not** in this spec

- An RPC for `origin`, or reading `origin` from Supabase in the UI.
- Library filtering or sorting by origin.
- New real games to replace the removed mocks.
- Origin on the Hall of Fame, home mini-cards, pin almanac or play page.
- Any engine change.
