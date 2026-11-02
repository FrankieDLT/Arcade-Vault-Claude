# SPEC 01 — MVP visual screens

> **Status:** Approved
> **Depends on:** None
> **Date:** 2026-11-02
> **Objective:** Port the five screens of the prototype in `references/templates/` (library, game detail, player, auth, hall of fame) to the Next.js App Router as English, TypeScript, visuals-only pages backed by mock data.

## Why this spec exists

The repo is the Create Next App scaffold plus the global theme already ported to `app/globals.css` and `app/layout.tsx` (fonts, `av-bg`, `av-noise`, `av-app`). The prototype is a Spanish, single-page React-in-the-browser app that routes through a JSON hash. This spec turns it into real routes, translates all copy to English, and keeps every interaction purely visual. No gameplay, backend or real auth exists after this spec.

## Scope

**In:**

- Real App Router routes for the five screens plus a shared shell (nav, mobile menu, footer).
- Library: hero, search by title, category chips, game grid with tilt-on-hover cards, empty state.
- Game detail: cover, tags, description, stat strip, "play now" and "back" actions, per-game top-10 leaderboard.
- Player: HUD (player, score, lives, level), CRT frame with decorative arena, simulated score ticker, pause overlay, "end" button, game-over modal with save-score and restart.
- Auth: sign-in / create-account tabs, guest button, social buttons (non-functional), mock login.
- Hall of Fame: per-game tabs, podium (top 3), ranking table, "your best" row when logged in.
- Mock data ported from `data.jsx` and translated to English (UI copy, game titles, ids, descriptions, categories).
- Mock session in `localStorage` (`av_user`) and mock saved scores in `localStorage` (`av_scores`), merged into the Hall of Fame and the game detail leaderboard.
- Numbers formatted with `en-US`, dates as `DD/MM/YYYY` as in the seeded data.
- Responsive behaviour already defined in the prototype CSS (mobile nav panel).

**Out of scope (for future specs):**

- Any real gameplay (input handling, collisions, game loops).
- Real authentication (credentials, OAuth for Google/GitHub, sessions, protected routes).
- Backend, database or API for scores; cross-device persistence.
- Server-side validation or anti-cheat for scores.
- i18n / language switching (UI is English only).
- Automated tests (no test runner is configured).
- Changes to the global theme in `app/globals.css`, other than fixes needed to render the ported screens.

## Data model

```ts
// lib/types.ts
export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export interface Game {
  id: string;        // URL slug, e.g. "brick-buster"
  title: string;     // uppercase display title, e.g. "BRICK BUSTER"
  short: string;     // card description
  long: string;      // detail description
  cat: Category;
  cover: string;     // CSS class from globals.css, e.g. "cover-bricks"
  color: GameColor;  // accent for the card's play button
  best: number;      // global best score (mock)
  plays: string;     // formatted plays count, e.g. "12.4K"
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;      // "DD/MM/YYYY"
}

export interface SessionUser {
  name: string;      // uppercase, max 10 chars
}

export interface SavedScore {
  game: string;      // Game.id
  score: number;
  name: string;
  at: number;        // Date.now()
}
```

Conventions:

- `lib/games.ts` exports `GAMES` (8 games) and `CATEGORIES = ["ALL", ...]`; `lib/scores.ts` exports `seededScores(seed, count)` ported unchanged (deterministic, so server and client render the same rows).
- Game ids are the English slugs of the translated titles. The mapping from the prototype is: `bloque-buster` → `brick-buster`, `caida` → `drop`, `serpentina` → `serpentine`, `gloton` → `chomper`, `invasores` → `invaders`, `rocas` → `rocks`, `ranaria` → `hopper`, `duelo-pixel` → `pixel-duel`. Titles are the uppercase equivalents (`BRICK BUSTER`, `DROP`, …).
- `localStorage` keys: `av_user` (`SessionUser | null`) and `av_scores` (`SavedScore[]`). Both are read only inside client components after mount, to avoid hydration mismatches.
- Cover classes (`cover-bricks`, `cover-tetro`, …) already exist in `app/globals.css` and keep their names.

## Implementation plan

Before step 1, read the relevant guides in `node_modules/next/dist/docs/` (routing, `cacheComponents`, dynamic params, client components) as required by `AGENTS.md`. Invoke `/frontend-design` for all UI work, per `CLAUDE.md`.

1. **Types and data.** Create `lib/types.ts`, `lib/games.ts` (translated mock games) and `lib/scores.ts` (`seededScores`). Nothing renders yet; `npm run build` passes.
2. **Session and score storage helpers.** Create `lib/storage.ts` (typed, try/catch-guarded read/write of `av_user` and `av_scores`) and `components/session-provider.tsx` (client context exposing `user`, `login`, `signOut`, loaded in an effect after mount). Wrap `children` in `app/layout.tsx`.
3. **Shell.** Create `components/nav.tsx` (client; logo, links "Library" and "Hall of Fame", credits counter, sign-in/user button, hamburger with mobile panel and backdrop; active state via `usePathname`) and `components/footer.tsx`. Render both from `app/layout.tsx` around `<main className="av-main">`.
4. **Library page.** Replace `app/page.tsx`. Create `components/library.tsx` (client: search + category state, hero, grid, empty state) and `components/game-card.tsx` (tilt effect, `next/link` to `/games/[id]`). Manual check: filter by text and chip.
5. **Game detail page.** Create `app/games/[id]/page.tsx` (async `params`, `generateStaticParams` over `GAMES`, `notFound()` for unknown ids) and `components/leaderboard.tsx` (shared by detail and Hall of Fame rows, merging seeded rows with matching `SavedScore` entries from `localStorage` on the client).
6. **Player page.** Create `app/games/[id]/play/page.tsx` and `components/game-player.tsx` (client: HUD, CRT frame, decorative arena, simulated score ticker, pause overlay, game-over modal with save and restart, "Exit" back to `/games/[id]`).
7. **Auth page.** Create `app/auth/page.tsx` and `components/auth-form.tsx` (client: tabs, fields, mock login to `SessionProvider`, guest button, inert social buttons, redirect to `/` via `useRouter`).
8. **Hall of Fame page.** Create `app/hall-of-fame/page.tsx` and `components/hall-of-fame.tsx` (client: game tabs, podium, table, "your best" row when `user` is set, back button).
9. **Polish and metadata.** Add per-page `metadata` titles, make `app/not-found.tsx` match the theme, run `npm run lint` and `npm run build`, and walk through every route manually.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish without errors.
- [ ] Routes `/`, `/games/brick-buster`, `/games/brick-buster/play`, `/auth` and `/hall-of-fame` respond 200 in `npm run dev`.
- [ ] `/games/does-not-exist` and `/games/does-not-exist/play` render the not-found page.
- [ ] All 8 games render in the library grid; selecting a category chip shows only games of that category; selecting `ALL` shows all 8.
- [ ] Typing "xyz" in the library search shows the "NO RESULTS" empty state.
- [ ] Clicking a game card or its "PLAY" button navigates to `/games/[id]` without a full page reload.
- [ ] The detail page shows the game's tags, description, stat strip and exactly 10 leaderboard rows, with rows 1–3 styled as top1/top2/top3.
- [ ] "PLAY NOW" navigates to `/games/[id]/play`; "Exit" in the player returns to `/games/[id]`.
- [ ] In the player, the score increases automatically while not paused and stops while paused; "PAUSE" shows the "PAUSED" overlay and the button label changes to "RESUME".
- [ ] "END" opens the game-over modal with the final score; saving shows "SCORE SAVED" and writes an entry to `localStorage` key `av_scores`; "PLAY AGAIN" resets score to 0, lives to 3 and level to 1.
- [ ] After saving a score for a game, that entry appears in that game's detail leaderboard and in its Hall of Fame table when its score ranks in the visible rows.
- [ ] Submitting the auth form with any values (or none) stores `av_user` with an uppercase name of at most 10 characters and redirects to `/`; the nav then shows that name instead of "Sign in".
- [ ] "PLAY AS GUEST" redirects to `/` with no `av_user` set; clicking the user button in the nav clears `av_user`.
- [ ] Switching between the "SIGN IN" and "CREATE ACCOUNT" tabs shows/hides the email field.
- [ ] The Hall of Fame shows a podium and a 12-row table for the selected game tab; changing tab changes the rows; the "your best" row appears only when logged in.
- [ ] No visible UI string, game title or description is in Spanish.
- [ ] Reloading any page with a stored `av_user` shows no React hydration warnings in the browser console.
- [ ] At a 375px viewport width the desktop links are hidden and the hamburger opens and closes the mobile panel.
- [ ] No screen requires a network request other than loading the app's own assets.

## Decisions

- **Yes:** real App Router routes (`/`, `/games/[id]`, `/games/[id]/play`, `/auth`, `/hall-of-fame`). Shareable URLs and idiomatic Next.js.
- **No:** porting the hash-based single-page router. It is a prototype artifact and fights `cacheComponents`.
- **Yes:** mock session and scores in `localStorage`, matching the prototype. Real auth and persistence need a backend and belong in later specs.
- **No:** static-only auth screen. A visible logged-in state in the nav is needed to review the Hall of Fame "your best" row.
- **Yes:** translate all UI copy, game titles, ids and descriptions to English. Decided by the user; deviates from the prototype and the Spanish README on purpose.
- **Yes:** `components/` and `lib/` at the repo root, with `app/` for routes only. Matches the `@/*` alias and keeps routes thin.
- **No:** colocated `_components/` folders. Components are shared across routes (leaderboard, session provider).
- **Yes:** player with prototype parity (simulated ticker, pause, game-over modal). It validates the whole visual flow end to end without gameplay.
- **Yes:** server components for pages and static data; client components only where state, effects or `localStorage` are needed.
- **No:** touching `app/globals.css` beyond fixes. The theme was already ported in a previous change.

## Risks

| Risk                                                                                  | Mitigation                                                                                          |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `cacheComponents` requires dynamic data (`params`) to be handled explicitly.          | Use `generateStaticParams` and read the Next 16 docs before step 5; wrap runtime access in Suspense. |
| `localStorage` reads cause hydration mismatches.                                      | Read storage only in effects after mount; render the guest state on the server.                     |
| `localStorage` unavailable (private mode, quota).                                     | All storage helpers are try/catch-guarded and fall back to in-memory state; screens still render.   |
| Prototype CSS class names may not all exist in `app/globals.css` after the first port. | Compare against `references/templates/styles.css` during steps 3–8 and add only missing rules.     |
| `CLAUDE.md` mentions `resources/templates/`, but the templates live in `references/templates/`. | Treat `references/templates/` as the source; fix the path in `CLAUDE.md` separately.                |

## What is **not** in this spec

- Real gameplay for any of the 8 games.
- Real authentication, OAuth or protected routes.
- Backend, database or API for users and scores.
- Language switching or Spanish copy.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
