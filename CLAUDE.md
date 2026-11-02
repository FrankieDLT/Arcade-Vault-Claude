# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arcade Vault: an online platform to play games and compete for the highest score. The project follows spec-driven development (`/spec` and `/spec-impl`, skills from `Klerith/fernando-skills`, installed with `npx skills@latest add Klerith/fernando-skills`). The README is written in Spanish.

The repo is currently the untouched Create Next App scaffold (`app/page.tsx` is the default starter page). No game, auth, or scoring code exists yet.

## Commands

```bash
npm run dev     # next dev
npm run build   # next build
npm run start   # next start
npm run lint    # eslint (flat config, eslint.config.mjs)
```

No test runner is configured.

## Next.js version warning

Next 16.4.4 / React 19.3 — APIs differ from what you may know. Per `AGENTS.md`, read the relevant guide in `node_modules/next/dist/docs/` (`01-app`, `02-pages`, `03-architecture`, `04-community`) before writing Next.js code, and heed deprecation notices. `next dev` re-adds the AGENTS.md block itself.

## Configuration notes

- `next.config.ts` enables `cacheComponents`, `partialPrefetching`, and `experimental.agentFeedback`. `cacheComponents` changes caching/rendering semantics for the App Router, so check the docs before using data fetching or dynamic APIs.
- Tailwind v4 is wired through a Turbopack rule (`@tailwindcss/turbopack` on `*.css`), not PostCSS.
- Path alias: `@/*` maps to the repo root (not `src/`). Routes live in `app/` at the root.

## Design reference

`resources/templates/` holds the UI prototype to implement, not app code: `Arcade Vault.html` plus `.jsx` files (`app`, `auth`, `biblioteca`, `data`, `detalle`, `nav`, `reproductor`, `salon`) and `styles.css`. These map to the intended screens: auth, game library, game detail, player, and leaderboard ("salón"). Mock data is in `data.jsx`. Port these into the Next.js `app/` router as TypeScript components.
