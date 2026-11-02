# SPEC 02 — Home screen

> **Status:** Implemented
> **Depends on:** SPEC 01
> **Date:** 2026-11-02
> **Objective:** Port the landing page of `references/templates/home-about/` to the Next.js App Router as an English, visuals-only Home at `/`, move the library to `/library`, and add a disabled "About" slot to the menu.

## Why this spec exists

SPEC 01 put the library at `/` because the prototype in `references/templates/` had no landing page. The newer prototype in `references/templates/home-about/` adds a Home page and an About page, and a nav with four entries. This spec adds the Home, frees `/` for it, and reserves the About slot in the menu. The About page itself is not built.

## Scope

**In:**

- New Home page at `/` with seven sections, copied visually from `home.jsx`: hero (floating pixel silhouettes, title, two CTAs, scroll hint), "Why Arcade Vault" (4 feature cards with pixel icons), "Games available now" (6 mini cards), stats strip, "Live activity" (latest scores ticker + top players list), pricing (single free plan + 3 FAQ items), final CTA.
- Scroll-reveal animation (`.reveal` → `.in`) driven by `IntersectionObserver` in a small client component.
- Library moved from `/` to `/library` (same component, no visual change).
- Nav (desktop links and mobile panel) updated to four entries: "Home" (`/`), "Library" (`/library`), "Hall of Fame" (`/hall-of-fame`), "About" (disabled, non-clickable, dimmed).
- Active-state logic: "Library" is active on `/library` and `/games/*`; "Home" only on `/`.
- Internal links that meant "the library" re-pointed to `/library`: Hall of Fame back button and the player game-over link.
- Home CSS ported from `references/templates/home-about/styles.css` into `app/globals.css`: only the rules that are missing (home, section, feature, mini-card, stats, activity, pricing, final CTA, reveal, silhouette and disabled-link rules).
- Static English mock data for the activity and top-players blocks in `lib/home.ts`.
- All Home copy translated to English. Numbers formatted with `en-US`, as in SPEC 01.
- Per-page `metadata` title for `/` and `/library`.

**Out of scope (for future specs):**

- The About page and its content (`about.jsx`). No `/about` route is created.
- Live or derived data on the Home (activity and top players are static mock rows; no `localStorage` merge).
- Real signup flow, pricing, billing or FAQ interactivity (FAQ items are static text).
- Changes to the auth redirect target (stays `/`, which is now the Home).
- Changes to the game, player, auth or Hall of Fame screens beyond the link fixes above.
- i18n, automated tests, SEO beyond the page title.

## Data model

```ts
// lib/home.ts
import type { GameColor } from "./types";

export interface Feature {
  icon: "GAMEPAD" | "FREE" | "TROPHY" | "ROCKET";
  title: string;
  desc: string;
  color: GameColor;
}

export interface ActivityRow {
  player: string;
  gameId: string;     // Game.id, resolved to the title for display
  score: number;
  ago: string;        // e.g. "2 min ago"
  color: GameColor;
}

export interface TopPlayer {
  rank: number;
  player: string;
  score: number;
}

export interface HomeStat {
  value: string;      // "12+", "THOUSANDS", "GLOBAL"
  unit: string;
  sub: string;
}
```

Conventions:

- `lib/home.ts` exports `FEATURES` (4), `ACTIVITY` (7), `TOP_PLAYERS` (5), `HOME_STATS` (3), `PRICING_FEATURES` (6 strings) and `FAQ` (3 `{ q, a }` items).
- The mini cards reuse `GAMES.slice(0, 6)` from `lib/games.ts`.
- `ActivityRow.gameId` uses the English ids from SPEC 01 (`Caída` → `drop`, `Glotón` → `chomper`, `Invasores` → `invaders`, `Rocas` → `rocks`, `Bloque Buster` → `brick-buster`, `Serpentina` → `serpentine`, `Ranaria` → `hopper`).
- No new `localStorage` keys. No new session state.

## Implementation plan

Before step 1, read the relevant guides in `node_modules/next/dist/docs/` (routing, `cacheComponents`, client components, metadata) as required by `AGENTS.md`. Invoke `/frontend-design` for all UI work, per `CLAUDE.md`.

1. **Move the library.** Create `app/library/page.tsx` rendering `<Library />` with `metadata.title`. Leave `app/page.tsx` as a temporary placeholder that renders the same `<Library />`, so the app still works. Manual check: `/library` and `/` both render the library.
2. **Mock data.** Create `lib/home.ts` with the types and constants above. Nothing renders yet; `npm run build` passes.
3. **Home CSS.** Diff `references/templates/home-about/styles.css` against `app/globals.css` and append only the missing rules (hero, silhouettes, sections, features, mini-cards, stats, activity, pricing, final CTA, `.reveal`, disabled nav link). Do not edit existing rules unless a rule conflicts, and record any conflict in the commit message. No visible change yet.
4. **Home sections.** Create `components/home.tsx` (server component) with the seven sections, plus small presentational pieces in the same folder as needed: `FloatingSilhouettes` (8 inline SVGs), `FeatureIcon` (4 pixel SVGs) and `MiniCard` (`next/link` to `/games/[id]`). CTAs use `next/link`: "EXPLORE GAMES" and "INSERT COIN →" → `/library`, "CREATE ACCOUNT" and "START FREE →" → `/auth`, "VIEW ALL GAMES →" → `/library`, "VIEW HALL →" → `/hall-of-fame`. Home renders at `/` but is still unlinked from the nav.
5. **Scroll reveal.** Create `components/reveal-observer.tsx` (client; `useEffect` adds `.in` to every `.reveal` element when it enters the viewport, then unobserves; disconnects on cleanup; adds `.in` immediately when `prefers-reduced-motion: reduce` matches). Render it inside `Home`.
6. **Route swap.** Replace `app/page.tsx` with `<Home />` and `metadata.title`. `/` now shows the Home.
7. **Nav.** Update `components/nav.tsx`: add "Home" → `/`, change "Library" → `/library`, keep "Hall of Fame", add a disabled "About" item (a `<span aria-disabled="true">`, no `href`, dimmed, `cursor: not-allowed`) in both the desktop links and the mobile panel. The logo links to `/`. Active state: `/` exact for Home; `/library` and `/games/*` for Library.
8. **Link fixes.** Re-point to `/library` the Hall of Fame back button (`components/hall-of-fame.tsx`) and the game-over link in `components/game-player.tsx`. Leave `app/not-found.tsx` and the auth redirect pointing to `/`.
9. **Polish.** Run `npm run lint` and `npm run build`, then walk through `/`, `/library`, a game detail page and the Hall of Fame at 1280px and 375px.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish without errors.
- [ ] `/` renders the Home and `/library` renders the library; both respond 200 in `npm run dev`.
- [ ] The Home shows, in order: hero, "WHY ARCADE VAULT?", "GAMES AVAILABLE NOW", stats strip, "LIVE ACTIVITY", "PRICING", final CTA.
- [ ] The hero shows 8 floating silhouettes and two CTAs; "EXPLORE GAMES" goes to `/library` and "CREATE ACCOUNT" goes to `/auth`, both without a full page reload.
- [ ] The "Why" section shows exactly 4 feature cards; the games section shows exactly 6 mini cards, and clicking one navigates to `/games/[id]` for that game.
- [ ] The latest-scores ticker shows exactly 7 rows and the top-players list shows exactly 5 rows, with rows 1–3 styled as top1/top2/top3.
- [ ] Game names in the ticker match the English titles in `GAMES`.
- [ ] The pricing section shows one plan card with 6 benefit lines and 3 FAQ items.
- [ ] Sections with `.reveal` start hidden and gain the `in` class when scrolled into view; with `prefers-reduced-motion: reduce` they are visible on load.
- [ ] The desktop nav shows, in order: Home, Library, Hall of Fame, About. The mobile panel shows the same four plus the account link.
- [ ] "About" has no `href`, is visually dimmed, has `aria-disabled="true"`, and clicking it does not change the URL or close the mobile panel.
- [ ] "Home" is active only on `/`; "Library" is active on `/library` and `/games/brick-buster`; "Hall of Fame" is active on `/hall-of-fame`.
- [ ] The nav logo goes to `/`.
- [ ] The Hall of Fame back button and the player game-over link go to `/library`.
- [ ] Submitting the auth form still redirects to `/` and shows the Home.
- [ ] No visible Home string is in Spanish; no Home string uses `toLocaleString("es-ES")`.
- [ ] Reloading `/` with a stored `av_user` shows no React hydration warnings in the browser console.
- [ ] At 375px width the Home has no horizontal scroll, and the hamburger opens and closes the mobile panel.
- [ ] No Home screen requires a network request other than loading the app's own assets.
- [ ] The criteria of SPEC 01 that mention the library at `/` hold at `/library`.

## Decisions

- **Yes:** Home at `/`, library at `/library`. A landing page belongs at the root, and the prototype treats Library as its own nav item.
- **No:** Home at `/home` with library kept at `/`. Unconventional URL and it leaves the root as a functional page, not a landing.
- **No:** library at `/games`. It would sit next to `/games/[id]` but the user chose `/library`, matching the nav label.
- **Yes:** disabled "About" menu item instead of a link. Holds the place in the menu without a placeholder page or a 404.
- **No:** placeholder `/about` page and link-to-nothing. Each adds throwaway work or a broken click.
- **Yes:** all seven sections, including pricing. The user asked to copy the visual look of the home page.
- **Yes:** static English mock arrays in `lib/home.ts`. Same approach as SPEC 01 mock data; no hydration risk.
- **No:** deriving top players from `seededScores` and saved scores. More coherent data but extra code and client-only merge for a decorative block.
- **Yes:** `Home` as a server component with one small client component for the reveal observer. Keeps JS on the client minimal.
- **Yes:** auth redirect stays `/`. The post-login landing is now the Home; changing it is a product decision for a later spec.
- **Yes:** append only missing CSS to `app/globals.css`. Same rule as SPEC 01: no rewriting of the existing theme.

## Risks

| Risk                                                                                     | Mitigation                                                                                              |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| New prototype `styles.css` differs from the already-ported `globals.css` (class clashes). | Diff before appending (step 3); append only missing rules and note conflicts in the commit message.    |
| `.reveal` hides content (`opacity: 0`) if the observer never runs.                       | Observer adds `.in` on mount for reduced motion; sections still render server-side and become visible on scroll. |
| Old bookmarks or links to `/` expecting the library.                                     | Known and accepted; internal links are re-pointed in step 8.                                            |
| `cacheComponents` rules for static server components.                                    | Home uses only static imports, no dynamic APIs; read the Next 16 docs before step 4.                    |

## What is **not** in this spec

- The About page, or any `/about` route.
- Real data, backend or `localStorage` for the Home.
- Real pricing, billing or signup changes.
- Language switching or Spanish copy.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
