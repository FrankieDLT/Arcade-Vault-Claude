# SPEC 04 — Supabase setup

> **Status:** Implemented
> **Depends on:** SPEC 03
> **Date:** 2026-11-04
> **Objective:** Install `@supabase/supabase-js` and `@supabase/ssr` and wire a browser client (built with `createBrowserClient`), documented env vars and a non-production health route into the Next.js app, without creating tables or changing any screen.

## Why this spec exists

The app stores its session (`av_user`) and scores (`av_scores`) in `localStorage` (`lib/storage.ts`). Moving them to Supabase touches auth, scores, leaderboards and the Home data, which is too much for one spec. This spec only lays the foundation: the dependency, the client, the env vars and a way to prove the connection works. Auth and scores come in later specs on top of it.

The Supabase project already exists (`reikrxgyfygfttnspsql`, linked in `.mcp.json`) and has no tables.

## Scope

**In:**

- Install `@supabase/supabase-js` and `@supabase/ssr`.
- Browser client in `lib/supabase/client.ts`, created with `createBrowserClient` from `@supabase/ssr`, lazily and reused (singleton), for use from client components only.
- Env vars `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, filled in the local `.env` and documented in `.env.example`.
- A clear error when either env var is missing, thrown when the client is requested (not at import time), so the build passes without them.
- Health route `GET /api/health/supabase` that checks the URL and the publishable key against the Supabase Auth API and returns `{ ok: true }` or `{ ok: false, error }`. It returns `404` when `NODE_ENV === "production"`.
- Note in `CLAUDE.md` about the Supabase client location and env vars.

**Out of scope (for future specs):**

- Supabase Auth (sign-up, sign-in, sessions, profiles). `av_user` and `lib/storage.ts` stay untouched.
- Persisting scores, leaderboard and Hall of Fame data. `av_scores` stays in `localStorage`.
- Real game stats (`plays`, `best`) and Home activity or top players.
- Any table, migration, RLS policy or generated database types.
- Server-side Supabase clients (`createServerClient`), cookie-based session refresh and a `proxy.ts` file. `@supabase/ssr` is used here only for the browser client.
- A service role key or any server-only Supabase secret.
- Guest-mode rules and migration of existing `localStorage` scores.
- Automated tests.

## Data model

This feature introduces no new data structures and no database objects.

```ts
// lib/supabase/client.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export function getSupabase(): SupabaseClient;
```

```ts
// app/api/health/supabase/route.ts
export type SupabaseHealth =
  | { ok: true }
  | { ok: false; error: "missing_env" | "unreachable" | "invalid_key" };
```

Conventions:

- `getSupabase()` reads `process.env.NEXT_PUBLIC_SUPABASE_URL` and `process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, throws if either is empty, creates the client with `createBrowserClient(url, key)` from `@supabase/ssr`, and caches it in a module-level variable. The cache keeps the singleton behavior explicit.
- `SupabaseClient` is imported as a type from `@supabase/supabase-js`, which is why both packages are installed.
- `lib/supabase/client.ts` is a plain module without `"use client"`; it must only be imported from client components.
- Health route mapping: `200` → `ok`, `500` → `missing_env`, `503` → `unreachable`, `401` → `invalid_key`, `404` → production.
- The health route calls the Supabase Auth settings endpoint (`<URL>/auth/v1/settings`) with the `apikey` header, using `fetch`. It does not use the stored session and never returns the URL or the key in the response.
- The health route is dynamic and never cached; `cacheComponents` rules apply (read the docs before writing it).
- No new `localStorage` keys.

## Implementation plan

Before step 1, read the relevant guides in `node_modules/next/dist/docs/` (Route Handlers, `cacheComponents`, environment variables) as required by `AGENTS.md`. Check the current Supabase docs (`search_docs`) for the publishable key name, the `createBrowserClient` signature in `@supabase/ssr` and the Auth settings endpoint. No UI work is involved, so `/frontend-design` is not needed.

1. **Dependency.** Run `npm install @supabase/supabase-js @supabase/ssr`. `npm run build` passes.
2. **Env vars.** Using the Supabase MCP (`get_project_url`, `get_publishable_keys`), add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the local `.env`. Add both, with comments, to `.env.example` with empty values. Keep the existing `SUPABASE_DB_PASSWORD=` line. Confirm `.env` is still ignored.
3. **Browser client.** Create `lib/supabase/client.ts` with `getSupabase()` as described, using `createBrowserClient` from `@supabase/ssr`. Nothing imports it yet; `npm run build` passes with and without the env vars.
4. **Health route.** Create `app/api/health/supabase/route.ts` with `GET`: return `404` in production, `500` `missing_env` if a var is empty, `503` `unreachable` if the fetch throws or the response is `5xx`, `401` `invalid_key` if Supabase rejects the key, `200` otherwise. Manual check with `curl` against `npm run dev` for the valid case, and with a temporarily wrong URL and wrong key for the failure cases.
5. **Docs.** Add to `CLAUDE.md` (Configuration notes) the location of the client, the two env vars and the health route. Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish without errors, with and without the Supabase env vars set.
- [ ] `@supabase/supabase-js` and `@supabase/ssr` are in `dependencies` in `package.json`.
- [ ] `lib/supabase/client.ts` creates the client with `createBrowserClient` imported from `@supabase/ssr`.
- [ ] No `proxy.ts` and no `lib/supabase/server.ts` exist.
- [ ] `.env.example` lists `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` with empty values; `.env` is not tracked by git.
- [ ] `GET /api/health/supabase` in `npm run dev` with valid env vars returns `200` and `{ "ok": true }`.
- [ ] With `NEXT_PUBLIC_SUPABASE_URL` empty, the route returns `500` and `{ "ok": false, "error": "missing_env" }`.
- [ ] With a URL that does not resolve, the route returns `503` and `{ "ok": false, "error": "unreachable" }`.
- [ ] With a wrong publishable key, the route returns `401` and `{ "ok": false, "error": "invalid_key" }`.
- [ ] With `NODE_ENV=production` (`npm run build` then `npm run start`), the route returns `404`.
- [ ] No health response body contains the project URL or the key.
- [ ] `getSupabase()` called without env vars throws an error naming the missing variable.
- [ ] `getSupabase()` returns the same instance on repeated calls.
- [ ] `git status` shows no changes under `app/` except `app/api/health/supabase/route.ts`, and no changes to `lib/storage.ts`, `components/` or `app/globals.css`.
- [ ] Auth, library, game and Hall of Fame screens behave as before: sign-in still stores `av_user` and scores still go to `av_scores`.
- [ ] The Supabase project still has no tables (`list_tables` returns an empty list).

## Decisions

- **Yes:** setup only, in its own spec. Auth, scores and stats each change many screens; one spec for all would be too big.
- **No:** bundling auth or scores here. They depend on this spec and each deserves its own review.
- **Yes:** install `@supabase/ssr` now and build the browser client with `createBrowserClient`. Decided by the user. It fits the current client-side `SessionProvider`, and a later server-side spec can add `createServerClient` and `proxy.ts` without replacing the browser client.
- **Yes:** install `@supabase/supabase-js` explicitly next to `@supabase/ssr`. The Supabase docs install both, and the code imports the `SupabaseClient` type from `supabase-js`.
- **No:** server client, cookie session refresh and `proxy.ts` in this spec. Not needed while Supabase is used only from client components.
- **Yes:** lazy singleton `getSupabase()`. The build and the rest of the app work without env vars, same approach as the Resend client in SPEC 03.
- **Yes:** publishable key with the `NEXT_PUBLIC_` prefix. It is designed for browsers and is protected by RLS once tables exist.
- **No:** service role key. Not needed with a client-only setup, and a leak would bypass RLS.
- **Yes:** `.env.example` keeps the existing `SUPABASE_DB_PASSWORD=` line. It is unused by the app and removing it is out of scope.
- **Yes:** health route as the verification. Decided by the user over a throwaway script or a UI indicator; it is repeatable with `curl` and adds no UI to remove later.
- **Yes:** health route returns `404` in production. The user chose a "dev-only" route; this stops it from being a public probe.
- **Yes:** health check against the Auth settings endpoint, not a table query. The project has no tables, and this still validates both the URL and the key.
- **No:** database tables, migrations or generated types. Decided by the user: wiring only. Types are generated when the first table exists.

## Risks

| Risk                                                                                 | Mitigation                                                                                                 |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| The Auth settings endpoint does not reject a wrong key as expected.                  | Check the docs and verify with the wrong-key `curl` in step 4; switch to another keyed endpoint if needed. |
| `NEXT_PUBLIC_*` values are inlined at build time, so changing them needs a rebuild.  | Document in `.env.example`; restart `npm run dev` after editing `.env`.                                    |
| `cacheComponents` rules for Route Handlers that read `process.env` and call `fetch`. | Use a `GET` handler that reads request-time data; read the Next 16 docs before step 4.                     |
| Client-only setup limits later server-side reads of Supabase data.                   | Accepted; a future spec adds `lib/supabase/server.ts` and `proxy.ts` without changing the browser client.  |
| `createBrowserClient` stores the session in cookies, not `localStorage`.             | No effect now (no Auth in this spec); review when the Auth spec is written.                                |
| A real key committed by mistake.                                                     | Only `.env.example` is committed, with empty values; `.env` stays in `.gitignore`.                         |

## What is **not** in this spec

- Auth, profiles or sessions.
- Saving scores or leaderboards in the database.
- Tables, migrations, RLS or generated types.
- Server-side Supabase clients, cookie session refresh or `proxy.ts`.
- Service role key.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
