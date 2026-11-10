# SPEC 14 — Security hardening

> **Status:** Implemented
> **Depends on:** SPEC 06, SPEC 13
> **Date:** 2026-11-09
> **Objective:** Close the items of `references/security/security-checklist.md` that this static, Free-plan site can close: lock the `scores` insert policy to signed-in users, cap sign-up and sign-in attempts per IP, verify the password minimum, add the referrer policy, and record which items cannot be done here and why.

## Why this spec exists

The Supabase security advisor flagged two warnings:

- `rls_policy_always_true`: the policy `scores can be added` on `public.scores` is `INSERT` for `anon, authenticated` with `WITH CHECK (true)`.
- `auth_leaked_password_protection`: leaked password protection is off.

The checklist also asks for a password minimum, a sign-up rate limit and security headers.

The first warning is SPEC 13 step 10, which was never done. SPEC 13 is merged to `master` and its UI already blocks guests from saving. But `list_migrations` on 2026-11-09 shows no `require_signin_to_save_scores`, and the anonymous policy is still live. So anyone with the publishable key can insert any score with a REST call, and a banned user can do it too. Applying that migration now breaks nothing, because the production UI no longer offers guest saving.

Headers: the site is `output: "export"` on GitHub Pages. Next does not support `headers()` in `next.config.ts` for static exports (`node_modules/next/dist/docs/01-app/02-guides/static-exports.md`, "Unsupported Features"), and `next dev` errors when it is set. GitHub Pages cannot add custom response headers. Only headers that have a `<meta>` equivalent can be shipped.

## Scope

**In:**

- **Migration `require_signin_to_save_scores`**, exactly the SQL of SPEC 13 (migration B). It drops `scores can be added` and creates `signed-in users can add their own scores`. Apply it with MCP `apply_migration`, save the file under the assigned version, and regenerate `lib/supabase/database.types.ts`.
- **SQL tests from SPEC 13 step 10**, run with `execute_sql` inside a transaction using `set local role` and `set local request.jwt.claims`. Clean up any test rows afterwards.
- **Referrer policy:** add `referrer: "strict-origin-when-cross-origin"` to `metadata` in `app/layout.tsx`. Every page then gets `<meta name="referrer" content="strict-origin-when-cross-origin">`.
- **Sign-up rate limit (Dashboard, manual):** Authentication > Rate Limits, set "Rate limit for sign ups and sign ins" to **10 per 5 minutes per IP** (default 30).
- **Password minimum (verify only):** confirm the Dashboard says 8. Confirm a 7-char password sent straight to the Auth API (`signUp`, bypassing the form) is rejected.
- **Route protection, client side only.** The request was Next.js Proxy (`proxy.ts`). It cannot run here, so the protection is the client guard the site already has:
  - `/account/` redirects a signed-out visitor to `/auth/` (`components/account-panel.tsx`, effect on `useSession()`, written in SPEC 13). It is the only protected route.
  - The spec verifies it and records it in `CLAUDE.md`. It is a convenience, not security: the real protection is RLS on the database.
- **Record what cannot be done:**
  - Next.js Proxy (`proxy.ts`) is unsupported with `output: "export"` (static-exports guide, "Unsupported Features"). GitHub Pages has no server to run it, and the session lives in browser storage, not cookies, so a proxy could not read it anyway.
  - Leaked password protection needs the Supabase Pro plan, and the project is on Free. The advisor warning is accepted.
  - `X-Frame-Options`, `X-Content-Type-Options` and CSP `frame-ancestors` need real response headers. GitHub Pages cannot send them, and browsers ignore them in `<meta>`.
- **Docs:** update `references/security/security-checklist.md`: tick each item, or mark it blocked, with a one-line reason. Update `CLAUDE.md`:
  - Remove the "until that migration is applied, the old anonymous insert policy is still live" sentence. State that the cutover is applied.
  - Add the rate-limit value to the Dashboard settings list.
  - Add a short security note: referrer meta, header and Proxy limits on static export, `/account/` client guard is UX only, leaked-password protection blocked on Free.

**Out of scope (for future specs):**

- CAPTCHA (Turnstile or hCaptcha) on register, sign in or forgot.
- A Content-Security-Policy, in `<meta>` or otherwise.
- Moving hosting, or putting a proxy (Cloudflare, Netlify, Vercel) in front to get real headers.
- Next.js Proxy (`proxy.ts`) and server-side route protection. It needs a server host, cookie-based auth and dropping the static export. A future spec if the site ever leaves GitHub Pages.
- Guarding more routes. Guests keep playing every game and reading every leaderboard (SPEC 13 decision). Game play pages are not protected.
- Upgrading the Supabase plan.
- Extra score checks in the insert policy, such as a per-game score ceiling, an insert rate per user, or a name blocklist.
- A stronger password rule (longer minimum, required character types).
- Email confirmation on sign up.
- Changes to the `contact` Edge Function (it already has its own honeypot and rate limit).
- Automated tests (no test runner).

## Data model

No new tables, columns or client types. This spec changes one RLS policy (SQL below, copied from SPEC 13 migration B):

```sql
-- SPEC 13 migration B (cutover), applied by SPEC 14.
drop policy "scores can be added" on public.scores;

create policy "signed-in users can add their own scores" on public.scores
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    and not exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.banned
    )
  );
```

- File: `supabase/migrations/<assigned version>_require_signin_to_save_scores.sql`.
- `anon` has no insert policy after this.
- `insertScore` (`lib/scores-db.ts`) already maps `42501` to `ScoreSaveError` `banned` / `signin`. No client change.

One metadata field is added in `app/layout.tsx`:

```ts
export const metadata: Metadata = {
  title: { default: "Arcade Vault", template: "%s | Arcade Vault" },
  description: "Play games and compete for the highest score.",
  referrer: "strict-origin-when-cross-origin",
};
```

## Implementation plan

1. **Dashboard steps (user action, no code).** The user does these and tells Claude when done:
   - Authentication > Rate Limits: "Rate limit for sign ups and sign ins" = 10 per 5 minutes. Save.
   - Authentication > Providers > Email: confirm minimum password length is 8.
   - Claude cannot change these settings through MCP. Steps 2-4 do not depend on this step.
2. **Migration.** Before applying, check with `list_migrations` that `require_signin_to_save_scores` is not applied yet. Check with `pg_policies` that `scores can be added` still exists. Then:
   - Apply `require_signin_to_save_scores` with MCP `apply_migration`.
   - Save the file in `supabase/migrations/` with the version the tool assigned.
   - Regenerate `lib/supabase/database.types.ts` with `generate_typescript_types`.
   - Check: `pg_policies` shows only `signed-in users can add their own scores` as the `scores` insert policy.
3. **SQL tests.** Run with `execute_sql`, each case in its own transaction that ends with `rollback`, so no test row survives. Use `set local role` and `set local request.jwt.claims` with the `sub` of an existing test user. Cases:
   - (a) `anon` insert: rejected.
   - (b) `authenticated` insert with own `sub`: accepted, and `user_id` equals the `sub`.
   - (c) Same user after `update profiles set banned = true` in the same transaction: rejected.
   - (d) JWT with `is_anonymous: true`: rejected.
   - (e) Explicit `user_id` of another user: rejected.
   - Any row created outside a rolled-back transaction is deleted with admin SQL.
4. **Referrer meta.** Add `referrer` to `metadata` in `app/layout.tsx`. Run `npm run build`, then check that `out/index.html` contains `<meta name="referrer" content="strict-origin-when-cross-origin"/>`.
5. **App check.** Run `npm run dev`. Signed in: play a real game (for example Snake), save a score, and see it on the leaderboard. Signed out: game over shows `SIGN IN TO SAVE YOUR SCORE`. Leaderboards, Home LATEST SCORES and Hall of Fame load. Playwright captures go in `.pwScreencaps/`.
   - Route guard: with Playwright, open `/account/` signed out and confirm the redirect to `/auth/`. Signed in, confirm `/account/` shows the page.
6. **API checks.**
   - With the publishable key and no session, `POST /rest/v1/scores` returns an RLS error (401/403, code `42501`) and creates no row.
   - With no session, `supabase.auth.signUp` with a 7-char password returns a weak-password error.
   - After step 1, more than 10 sign-up or sign-in calls from one IP within 5 minutes return a rate-limit error (`over_request_rate_limit`). Use invalid credentials, so no accounts are created. Wait out the window afterwards.
7. **Advisors.** Run `get_advisors` (security). `rls_policy_always_true` is gone. `auth_leaked_password_protection` stays, and is accepted.
8. **Docs.**
   - Update `references/security/security-checklist.md`: each item gets `[x]` done, `[x]` verified, or `[ ] blocked`, plus one line of reason.
   - Update `CLAUDE.md` as listed in Scope.
   - Run `npm run lint` and `npm run build`.

## Acceptance criteria

- [ ] `list_migrations` shows `require_signin_to_save_scores`, and `supabase/migrations/` has the file with the same version.
- [ ] `pg_policies` for `public.scores` shows `scores are public` (SELECT) and `signed-in users can add their own scores` (INSERT, `authenticated`), and nothing else.
- [ ] An insert as `anon` is rejected (SQL test and REST call) and no row is created.
- [ ] A signed-in, not banned user saves a score from the UI, and the new row's `user_id` equals their auth id.
- [ ] A banned user is rejected, a JWT with `is_anonymous: true` is rejected, and an insert with another user's `user_id` is rejected.
- [ ] After the tests, `scores` has no leftover test rows.
- [ ] `lib/supabase/database.types.ts` is regenerated, not hand-edited.
- [ ] `get_advisors` (security) no longer lists `rls_policy_always_true`.
- [ ] Every page in `out/` has `<meta name="referrer" content="strict-origin-when-cross-origin"/>` (checked on `index.html` and `games/tetris/index.html`).
- [ ] `next.config.ts` has no `headers()` function. `npm run dev` and `npm run build` run without errors.
- [ ] Dashboard: the sign-up/sign-in rate limit is 10 per 5 minutes, and the minimum password length is 8 (confirmed by the user).
- [ ] A 7-char password sent straight to `signUp` is rejected by Supabase.
- [ ] Leaderboards, Home LATEST SCORES, TOP PLAYERS, BestScore and Hall of Fame still load, signed in and signed out.
- [ ] A guest at game over still sees `SIGN IN TO SAVE YOUR SCORE`.
- [ ] Opening `/account/` signed out redirects to `/auth/`; signed in it shows the account page.
- [ ] The repo has no `proxy.ts` or `middleware.ts`, and `output: "export"` still builds.
- [ ] `references/security/security-checklist.md` has every item ticked or marked blocked, with a reason.
- [ ] `CLAUDE.md` no longer says the anonymous insert policy is live. It lists the rate limit, and it has the security note.
- [ ] No new dependency, no server code. `npm run lint` and `npm run build` pass.

## Decisions

- **Yes:** apply SPEC 13 migration B unchanged. User decision. The SQL was already designed and approved in SPEC 13, and the guest-blocking UI is already on `master`, so the cutover breaks nothing.
- **No:** extra checks in the insert policy (score ceilings per game, rate per user). Not asked for, and it would need per-game knowledge in SQL. Future spec.
- **Yes:** referrer policy as a `<meta>` tag through the Metadata API (`referrer` field). User decision. It is the only checklist header with a working `<meta>` form.
- **No:** `headers()` in `next.config.ts`. It is unsupported with `output: "export"`, it errors in `next dev`, and GitHub Pages ignores it anyway.
- **No:** `X-Frame-Options` and `X-Content-Type-Options` in `<meta>`. Browsers ignore them there, so adding them would only look like protection. Recorded as blocked by hosting.
- **No:** a CSP meta tag. User decision. Next's inline scripts need `'unsafe-inline'`, which weakens it a lot, and a wrong `connect-src` would break Supabase calls.
- **No:** moving hosting or adding a proxy to get real headers. Too large for this spec.
- **No:** Next.js Proxy (`proxy.ts`) for route protection. User asked for it, and it was checked: unsupported on static export, no server on GitHub Pages, and the Supabase session is in browser storage, so a proxy cannot see it. SPEC 13 and `CLAUDE.md` already rule out `proxy.ts`.
- **Yes:** client-side guard for `/account/` only. User decision, after being offered a server-host switch. It already exists from SPEC 13, so this spec verifies and documents it. It is UX, not security: anyone can read the static page code, and the data is protected by RLS.
- **No:** guarding game play pages. It would reverse the SPEC 13 decision that guests can play.
- **No:** leaked password protection. The project is on the Free plan, and the feature needs Pro. The advisor warning is accepted and recorded.
- **Yes:** sign-up/sign-in rate limit 10 per 5 minutes per IP, set in the Dashboard. User decision. That is enough for a real person retrying, and a third of the default.
- **No:** CAPTCHA. User decision. It would need a new widget, script and Dashboard secret. Future spec if bots show up.
- **Yes:** password minimum stays 8, verified at the API, with no code change. User decision. It is already enforced in both `lib/auth.ts` (`PASSWORD_MIN`) and the Dashboard.
- **Yes:** the SQL tests run in transactions that roll back. No test data survives, and no cleanup step can be forgotten.
- **Yes:** tick and annotate `references/security/security-checklist.md`. User decision. The checklist then shows what is done and what is blocked.

## Risks

| Risk                                                                                                          | Mitigation                                                                                                            |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| An old cached build in a visitor's browser still offers guest SAVE SCORE. After the cutover, that save fails. | `insertScore` already maps `42501` to `SIGN IN TO SAVE YOUR SCORE.`. Only stale tabs are affected.                    |
| The rate limit test locks the tester's own IP out of sign in for up to 5 minutes.                             | Run it last, with invalid credentials, and wait out the window.                                                       |
| Shared IPs (school, office) hit 10 per 5 minutes.                                                             | Accepted. The value can be raised in the Dashboard without code.                                                      |
| `set local role` tests behave differently from real REST calls.                                               | Step 6 also checks with a real REST call, and step 5 checks a real signed-in save.                                    |
| The leaked-password warning stays open and gets misread later as forgotten work.                              | The checklist and `CLAUDE.md` record it as blocked by the Free plan.                                                  |
| Someone later adds `headers()` to `next.config.ts` thinking it works.                                         | `CLAUDE.md` security note states it is unsupported on static export.                                                  |
| Someone adds `proxy.ts` for route protection. It breaks the export build or is ignored on GitHub Pages.       | `CLAUDE.md` security note states Proxy is unsupported here. An acceptance criterion checks that no `proxy.ts` exists. |
| The `/account/` guard is mistaken for real security.                                                          | The spec and `CLAUDE.md` call it UX only. Data protection is RLS.                                                     |

## What is **not** in this spec

- CAPTCHA, CSP, a proxy or new hosting, a plan upgrade.
- Score sanity rules in RLS, stronger password rules, email confirmation.
- Contact Edge Function changes, automated tests.

Each one, if it lands, goes in its own spec.
