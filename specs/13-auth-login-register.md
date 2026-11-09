# SPEC 13 — Real login and register (Supabase Auth)

> **Status:** Approved
> **Depends on:** SPEC 01, SPEC 04, SPEC 06
> **Date:** 2026-11-09
> **Objective:** Replace the mock name-only login with real Supabase Auth: a sign in and register page (email + password, Google, GitHub), sign out, forgot and reset password, and an account page to change username and password, on the existing static export, and require sign in to save scores so a user can be banned from saving scores from the database side.

## Why this spec exists

`/auth` today (`components/auth-form.tsx`) accepts any values, or none, and stores a name in `localStorage` (`av_user`). There is no account, no check and no real session. The Google and GitHub buttons do nothing. SPEC 04 added the Supabase client and said Auth would come later; this is that spec.

The site is a static export on GitHub Pages (`CLAUDE.md`): no server, no cookies, no route handlers, no `proxy.ts`. Auth therefore runs fully in the browser with `getSupabase()`, and the session lives in the browser storage that `supabase-js` manages itself.

The user chose to keep sign in, register, OAuth, forgot password and account settings in one spec. That is large, so the implementation plan is split in small steps and every step leaves the site working.

Banning needs the database to know who is saving a score. Today `scores` has no user column and any anonymous client can insert (SPEC 06), so a banned person could just sign out and save as a guest. The user decided to **require sign in to save scores** and to enforce the ban in the database: a `profiles` table holds a `banned` flag and the `scores` insert policy refuses banned users. Guests can still play and read every leaderboard; they only cannot save. The ban is applied by hand with SQL (no admin UI).

## Scope

**In:**

- **Sign in and register** on `/auth` (`components/auth-form.tsx`, rewritten), with the existing two tabs `SIGN IN` / `CREATE ACCOUNT` and the existing `.auth-card` look:
  - Sign in: email + password.
  - Register: username + email + password + confirm password.
  - Google and GitHub buttons that call `supabase.auth.signInWithOAuth`.
  - `PLAY AS GUEST` stays: it signs out any session and goes to `/`.
  - Inline field errors from a pure validator, plus a form-level error line for Supabase errors, written in plain English.
- **Session** (`components/session-provider.tsx`, rewritten) reads the Supabase session (`auth.getSession()` on mount and `auth.onAuthStateChange`) and exposes `user`, `status` and `signOut`. `login` is removed. Signed out = guest, as today.
- **Sign out** in the nav: the signed-in name links to `/account/` and a separate `SIGN OUT` button calls `signOut`. Desktop bar and mobile panel.
- **Forgot password:** page `/auth/forgot/` (email field, `resetPasswordForEmail`) and page `/auth/reset/` (new password + confirm, `updateUser({ password })`) reached from the email link.
- **Account page** `/account/`: shows email (read-only), edit username, change password (hidden for OAuth-only accounts). Signed-out visitors are sent to `/auth/`.
- **Username** is stored in user metadata (`user_metadata.username`), set at sign up with `options.data`. OAuth users get a name derived from the provider profile (see Data model). The `profiles` table below does not hold the username.
- **Return to previous page:** after sign in or register the user goes back to the page they came from, else `/`. Works for the OAuth round trip.
- **Email confirmation is off** (Supabase Dashboard setting). A user can play right after registering. The UI still handles the "confirmation required" response without breaking (see Risks).
- **Dashboard setup checklist** (done by the user, not by code), written in the implementation plan: Auth URL configuration, redirect allow-list, minimum password length 8, Google and GitHub providers, confirm email off, anonymous sign-ins off.
- **Require sign in to save scores.** SAVE SCORE works only for signed-in users. A guest at game over sees `SIGN IN TO SAVE YOUR SCORE` with a link to `/auth/` instead of the name field and SAVE SCORE button. The anonymous insert on `scores` is removed in the database.
- **Ban from the database.** New table `profiles` (one row per auth user, created by a trigger) with `banned`, `ban_reason`, `banned_at`. New column `scores.user_id`. The `scores` insert policy rejects banned users, anonymous sign-ins and guests. An admin bans or unbans with SQL (Supabase SQL editor or MCP `execute_sql`); the ban takes effect on the user's next save, with no sign out needed.
- **Ban message.** A banned user who tries to save sees `THIS ACCOUNT CANNOT SAVE SCORES.`. They can still sign in, play, and read every leaderboard. Their old scores stay on the leaderboards.
- Two migrations: `add_profiles_and_score_user_id` (additive, applied early) and `require_signin_to_save_scores` (the cutover, applied last). `lib/supabase/database.types.ts` is regenerated, never hand-edited.
- Pure helper module `lib/auth.ts` (validators, username derivation, safe redirect path, error mapping).
- Remove `readUser` / `writeUser` and the `av_user` key from `lib/storage.ts`. An old `av_user` value left in a browser is ignored.
- Update `CLAUDE.md` (auth is real, routes, files, Dashboard settings, redirect rule) and the `/auth` mention in the About or nav text if any says "mock".
- UI designed with `/frontend-design` per `CLAUDE.md`, reusing the current auth styles (`.auth-card`, `.auth-tabs`, `.field`, `.btn`) and extending them only where the new pages need it.
- Verify with Playwright at 1280px and 375px. Captures go to `.pwScreencaps/`.

**Out of scope (for future specs):**

- A ban admin UI, temporary bans (expiry), appeals, ban emails, and hiding or deleting the old scores of a banned user. Bans are set by hand with SQL. If wanted, old scores are hidden or deleted by hand with SQL too.
- Linking old score rows to accounts. Rows saved before this spec keep `user_id` null.
- Stopping a banned person from registering a second account. A ban is per account.
- Keeping the score of a run when a guest signs in at game over. That score is lost; the guest plays again after signing in.
- Unique usernames, avatars, public profile pages, "my scores" views, and moving the username into `profiles` (it stays in `user_metadata`).
- Magic link, phone login, other OAuth providers, MFA, passkeys.
- Email confirmation on sign up, custom email templates, custom SMTP (Resend for Supabase Auth mails).
- Delete account, change email, session list, "sign out everywhere".
- A real "Terms" page. The text `BY ENTERING YOU ACCEPT THE ARCADE HALL TERMS` stays as it is.
- Server-side auth (cookies, `proxy.ts`, server client, service role key). The site is static.
- Rate limiting or CAPTCHA beyond what Supabase Auth gives by default.
- Automated tests (no test runner is configured).

## Data model

### Database (two migrations)

**Migration A, `add_profiles_and_score_user_id`.** Additive: anonymous saving keeps working after it, so it can be applied early.

```sql
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  banned     boolean not null default false,
  ban_reason text,                 -- admin note, never readable by clients
  banned_at  timestamptz,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile is readable" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
revoke all on public.profiles from anon, authenticated;
grant select (id, banned) on public.profiles to authenticated;
-- No insert/update/delete policy: clients cannot change a profile.

-- Trigger on auth.users insert: create the profile row
-- (security definer, set search_path = '', on conflict do nothing).
-- Backfill: insert a profile for every existing auth.users row.

alter table public.scores
  add column user_id uuid default auth.uid() references auth.users (id) on delete set null;
revoke select on public.scores from anon, authenticated;
grant select (id, game_id, name, score, created_at) on public.scores to anon, authenticated;
-- user_id is not readable through the public API. Existing queries already list columns.
```

**Migration B, `require_signin_to_save_scores`.** The cutover, applied last (see step 10).

```sql
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

`anon` has no insert policy any more. `user_id` is filled by the column default `auth.uid()`; the client sends nothing new. A user with no profile row is treated as not banned (the trigger and backfill make that case rare).

Ban and unban are done by an admin, with a role that bypasses RLS (Supabase SQL editor or MCP `execute_sql`). Both snippets go in `CLAUDE.md`:

```sql
-- ban
update public.profiles
   set banned = true, ban_reason = 'cheating', banned_at = now()
 where id = (select id from auth.users where email = 'user@example.com');
-- unban
update public.profiles
   set banned = false, ban_reason = null, banned_at = null
 where id = (select id from auth.users where email = 'user@example.com');
```

Client change in `lib/scores-db.ts`: `insertScore` keeps its signature and column names. It throws a typed error:

```ts
export type ScoreSaveFailure = "banned" | "signin" | "other";
export class ScoreSaveError extends Error {
  constructor(readonly kind: ScoreSaveFailure) {
    super(kind);
  }
}
```

On a Postgres RLS error (`code` `42501`), `insertScore` reads the caller's own `profiles.banned` and throws `banned` if true, else `signin` (expired session or not signed in). Any other error throws `other`. The client never caches the ban flag, so a ban or unban applies on the next save. UI texts: `banned` shows `THIS ACCOUNT CANNOT SAVE SCORES.`, `signin` shows `SIGN IN TO SAVE YOUR SCORE.`, `other` keeps `COULD NOT SAVE SCORE. TRY AGAIN.`.

### Client types and helpers

Session type (`lib/types.ts`), replaces the current `SessionUser`:

```ts
export type AuthProvider = "email" | "google" | "github";

export interface SessionUser {
  /** Uppercase, 1-20 chars. From user_metadata.username, else derived. */
  name: string;
  email: string | null;
  /** Provider of the sign in that built this session. */
  provider: AuthProvider;
  /** True when the account has an email + password identity (can change password). */
  hasPassword: boolean;
}
```

Provider context (`components/session-provider.tsx`):

```ts
interface SessionContextValue {
  user: SessionUser | null;
  /** "loading" until the first getSession() resolves; the server and first client render are "loading". */
  status: "loading" | "ready" | "unavailable";
  signOut: () => Promise<void>;
}
```

`unavailable` means `getSupabase()` threw (missing env vars). The site then behaves as guest and the auth pages show `Sign in is not available right now.` instead of crashing.

Supabase user metadata (written by `signUp` and `updateUser`):

```ts
{
  username: string;
} // uppercase, 1-20 chars, already validated
```

`lib/auth.ts` (framework-free: no `react`, `next` or `@supabase` imports):

```ts
export interface FieldErrors {
  [field: string]: string | undefined;
}

export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 8;

export function validateUsername(v: string): string | null; // 1-20 chars, A-Z a-z 0-9 _ -
export function validateEmail(v: string): string | null;
export function validatePassword(v: string): string | null; // >= 8 chars
export function validateConfirm(pw: string, confirm: string): string | null;

/** Username for a Supabase user: metadata first, else provider name, else "PLAYER1". */
export function deriveUsername(
  meta: Record<string, unknown>,
  email: string | null,
): string;

/** Returns `path` only if it is a same-site path ("/x", not "//x", not "/auth..."); else "/". */
export function safeNextPath(path: string | null | undefined): string;

/** Maps a Supabase auth error ({ code?, message }) to one plain English sentence. */
export function authErrorMessage(err: {
  code?: string;
  message: string;
}): string;
```

Rules:

- Username: trimmed, matches `^[A-Za-z0-9_-]{1,20}$`, stored uppercase. The score name is the username cut to 10 chars, because `scores.name` allows 10. Not unique.
- `deriveUsername`: `user_metadata.username` if present, else the first non-empty of `full_name`, `name`, `user_name`, then the email prefix. Uppercase, remove every character outside `A-Z 0-9 _ -`, cut to 20, fall back to `PLAYER1` when empty. Not written back to Supabase.
- Error mapping covers at least: `invalid_credentials`, `user_already_exists`, `weak_password`, `over_request_rate_limit` / `over_email_send_rate_limit`, `same_password`, network failure, and a generic fallback `Something went wrong. Try again.`.
- Sign in with a wrong email and with a wrong password return the same message (`Wrong email or password.`). Forgot password returns the same success message whether or not the email exists.

Redirect memory: `sessionStorage` key `av_auth_next` holds the path to return to. Written by the nav `Sign in` link on click (the current pathname), read and cleared by `/auth` after a successful sign in or after the OAuth return, and validated with `safeNextPath`. All reads and writes are wrapped in try/catch; with no storage the user goes to `/`.

Routes (App Router, all client forms inside thin server pages like `app/auth/page.tsx`):

| Route           | File                           | Component              |
| --------------- | ------------------------------ | ---------------------- |
| `/auth/`        | `app/auth/page.tsx` (existing) | `AuthForm` (rewritten) |
| `/auth/forgot/` | `app/auth/forgot/page.tsx`     | `ForgotForm` (new)     |
| `/auth/reset/`  | `app/auth/reset/page.tsx`      | `ResetForm` (new)      |
| `/account/`     | `app/account/page.tsx`         | `AccountPanel` (new)   |

Redirect URLs sent to Supabase (built with the base path, so they work on GitHub Pages and locally): OAuth `redirectTo` = `<origin><basePath>/auth/`, password reset `redirectTo` = `<origin><basePath>/auth/reset/`. `<basePath>` comes from `lib/base-path.ts`.

Conventions:

- All new UI text is English. Errors are one plain sentence.
- Every page and component that calls Supabase is a client component. No server code.
- Browser storage for the session is whatever `@supabase/ssr` `createBrowserClient` uses by default. The app adds no key for it.
- `user` is `null` on the server render and on the first client render, so there is no hydration mismatch (same pattern as today).

## Implementation plan

Before step 2, invoke `/frontend-design` for the auth pages and the nav change, per `CLAUDE.md`. Before any routing code, read the relevant guide in `node_modules/next/dist/docs/` (`01-app`) for pages under static export.

1. **Supabase Dashboard setup (user action, no code).** The user does these and tells Claude when done:
   - Authentication > URL Configuration: Site URL `https://frankiedlt.github.io/Arcade-Vault-Claude/`. Redirect allow-list: `https://frankiedlt.github.io/Arcade-Vault-Claude/**` and `http://localhost:3000/**`.
   - Authentication > Providers > Email: enabled, `Confirm email` OFF, minimum password length 8.
   - Authentication > Providers > Google and GitHub: enabled, with the client ID and secret from the user's own OAuth apps. The callback URL shown by Supabase goes into each OAuth app.
   - Authentication > Sign In / Providers: `Allow anonymous sign-ins` OFF (default). Anonymous sign-ins would give guests the `authenticated` role.
   - Claude can read the project URL and check advisories with the Supabase MCP, but cannot change these settings. Every step except the OAuth one (step 7) can be built and tested without the OAuth providers.
2. **Helpers and types.** Create `lib/auth.ts` with the validators, `deriveUsername`, `safeNextPath` and `authErrorMessage`. Replace `SessionUser` in `lib/types.ts`. Do not change consumers yet; keep a temporary compatible shape so `npm run lint` and `npm run build` still pass.
3. **Migration A, profiles and `scores.user_id`.** Apply `add_profiles_and_score_user_id` with MCP `apply_migration`, save the file in `supabase/migrations/` with the version the tool assigned, regenerate `lib/supabase/database.types.ts` with `generate_typescript_types`. The insert policy is unchanged, so anonymous saving, leaderboards and Home still work. Check: `list_tables` shows `profiles` with RLS on; `get_advisors` (security) shows nothing new; a public API request that selects `user_id` from `scores` is denied; leaderboards still load; registering a test user (after step 4) creates its `profiles` row.
4. **Session provider on Supabase, nav sign out, email sign in and register.** Rewrite `components/session-provider.tsx` (`getSession`, `onAuthStateChange`, build `SessionUser`, `signOut`, `status`, catch a throwing `getSupabase()` as `unavailable`). Rewrite `components/auth-form.tsx`: tabs, validation, `signInWithPassword`, `signUp` with `options.data.username`, error line, loading state on the submit button, redirect to `safeNextPath`. `PLAY AS GUEST` keeps its behavior. Update `components/nav.tsx`: signed-in name links to `/account/`, `SIGN OUT` button, `Sign in` link writes `av_auth_next`. Redirect signed-in visitors away from `/auth/`. Check: register, sign out, sign in, reload keeps the session, nav shows the name, SAVE SCORE prefills the name.
5. **Cleanup of the mock.** Remove `readUser`, `writeUser`, `USER_KEY` and `memoryUser` from `lib/storage.ts` and any import of them. Grep for `av_user` and `login(` to confirm none is left outside `specs/` and `references/`. Lint and build pass.
6. **Save-score gate.** In `lib/scores-db.ts` add `ScoreSaveError` and the error mapping from the Data model (`insertScore` signature unchanged). In `components/game-player.tsx`: a guest at game over sees `SIGN IN TO SAVE YOUR SCORE` with a link to `/auth/` (writes `av_auth_next` with the current play path, same as the nav link) and no name field or SAVE SCORE button; a signed-in user keeps the current name field (prefilled with `user.name`, still editable) and SAVE SCORE; the three failure kinds show their texts. Check: signed-in save works and the row has `user_id` set (column default from migration A); guest sees the prompt and no request is sent. Until step 10 the old anonymous policy is still live, so the UI is the only gate.
7. **OAuth.** Wire the `GOOGLE` and `GITHUB` buttons to `signInWithOAuth` with `redirectTo` as in the Data model. On return, `/auth/` waits for the session, reads `av_auth_next`, and redirects. Show a visible `Signing you in…` state during the return. Check with the real providers; if a provider is not configured yet, the button shows the mapped error instead of failing silently.
8. **Forgot and reset password.** Create `app/auth/forgot/page.tsx` + `components/forgot-form.tsx` and `app/auth/reset/page.tsx` + `components/reset-form.tsx`. Add a `Forgot password?` link under the password field on the sign in tab. Reset page: wait for the recovery session (`PASSWORD_RECOVERY` event or existing session), show the form; with no valid recovery session show `This reset link is invalid or has expired.` with a link to `/auth/forgot/`. After success go to `/` signed in.
9. **Account page.** Create `app/account/page.tsx` + `components/account-panel.tsx`: read-only email, username form (`updateUser({ data: { username } })`), password form (new + confirm, `updateUser({ password })`) only when `hasPassword`, success and error lines, signed-out redirect to `/auth/`. Nav link already points here from step 4.
10. **Migration B, the cutover.** Apply `require_signin_to_save_scores` with MCP `apply_migration`, save the file with the assigned version, regenerate types. Apply it right before merging the branch to `master`: from that moment the production build that still offers guest SAVE SCORE fails to save. Then test with `execute_sql` inside a transaction using `set local role` and `set local request.jwt.claims`: `anon` insert rejected; signed-in user insert accepted with `user_id` set; the same user after `banned = true` rejected; after unban accepted; a JWT with `is_anonymous: true` rejected; `user_id` of another user rejected. Delete the test score rows afterwards with admin SQL.
11. **Docs.** Update `CLAUDE.md` (auth section, routes, files, Dashboard settings, the redirect rule and the `av_auth_next` key, the `profiles` table, `scores.user_id`, the sign in rule for saving scores, the ban and unban SQL snippets, the column grants on `scores` and the rule to list columns in queries). Run `npm run lint` and `npm run build`.
12. **Verification walkthrough.** Playwright at 1280px and 375px on a build served with `NEXT_PUBLIC_BASE_PATH=/Arcade-Vault-Claude` and on `npm run dev`. Also check the ban end to end with a test account: save a score, ban it with the SQL snippet, try to save again (message shown, no row), unban, save again. Create test accounts with fake addresses on a reserved domain (for example `*@example.com`), and delete them from the project afterwards (`execute_sql` on `auth.users`, with user approval). Captures in `.pwScreencaps/`. Run `get_advisors` (security) and record anything new.

## Acceptance criteria

Register and sign in:

- [ ] `/auth/` shows tabs `SIGN IN` and `CREATE ACCOUNT`; the register tab has username, email, password and confirm password fields; the sign in tab has email and password.
- [ ] Submitting an empty or invalid form shows an inline error per bad field and sends no request to Supabase.
- [ ] Username `ABCDEFGHIJKLMNOPQRSTU` (21 chars) and `a b` (space) are rejected; `px_kai` is accepted and shown as `PX_KAI`.
- [ ] A password of 7 chars is rejected inline; a mismatched confirm shows an inline error.
- [ ] Registering a new valid account signs the user in at once (no email step), the nav shows the uppercase username, and `auth.users` has the row with `user_metadata.username` set.
- [ ] Registering an existing email shows a plain English error and does not sign in.
- [ ] Signing in with a wrong password and with an unknown email both show `Wrong email or password.`.
- [ ] The submit button is disabled and shows a loading state while the request runs; no double submit is possible.
- [ ] Any Supabase error shows one plain sentence, never a raw JSON or stack trace.

Session and nav:

- [ ] Reloading any page keeps the user signed in; closing and reopening the browser keeps it too.
- [ ] The nav shows `Sign in` when signed out and the name plus `SIGN OUT` when signed in, in the desktop bar and the mobile panel at 375px.
- [ ] Clicking `SIGN OUT` ends the session, the nav returns to `Sign in`, and a reload stays signed out.
- [ ] `PLAY AS GUEST` goes to `/` with no session.
- [ ] A signed-in visitor who opens `/auth/` is redirected away from it.
- [ ] Clicking `Sign in` from `/games/tetris/` and completing sign in returns to `/games/tetris/`; from `/` returns to `/`. A forged `av_auth_next` such as `//evil.com` or `https://evil.com` sends the user to `/`.
- [ ] SAVE SCORE prefills the signed-in username cut to 10 chars, and the name stays editable (free text, 1-10 chars) when saving.
- [ ] A guest at game over sees `SIGN IN TO SAVE YOUR SCORE` with a link to `/auth/`, no name field and no SAVE SCORE button, and no request to `scores` is sent.
- [ ] Reloading `/`, `/auth/` and `/games/tetris/play/` signed in and signed out shows no React hydration warning.
- [ ] With `NEXT_PUBLIC_SUPABASE_URL` empty, the site still loads, the nav shows `Sign in`, and `/auth/` shows `Sign in is not available right now.` with no crash.

OAuth:

- [ ] `GOOGLE` and `GITHUB` start the provider flow, return to the site, and end signed in with a username derived from the provider profile (uppercase, at most 20 chars, only `A-Z 0-9 _ -`).
- [ ] The OAuth round trip works on GitHub Pages (base path `/Arcade-Vault-Claude`) and on `localhost:3000`.
- [ ] An OAuth-only account does not see the password section on `/account/`.

Forgot, reset and account:

- [ ] `/auth/forgot/` shows the same success message for a registered and an unregistered email.
- [ ] The reset email link opens `/auth/reset/`; a valid link shows the new password form; setting a password of 8+ chars signs the user in and the new password works on the next sign in.
- [ ] Opening `/auth/reset/` with no valid recovery session shows `This reset link is invalid or has expired.` and a link to `/auth/forgot/`.
- [ ] `/account/` signed out redirects to `/auth/`; signed in it shows the email (not editable) and the current username.
- [ ] Changing the username on `/account/` updates the nav name without a reload and `user_metadata.username` in `auth.users`; invalid usernames are rejected with the same rules as register.
- [ ] Changing the password on `/account/` with 8+ matching chars shows a success line; the old password stops working.

Ban and saving scores (database side):

- [ ] After migration A, `profiles` exists with RLS on; registering a user creates its `profiles` row with `banned = false`; a signed-in client can read its own `id` and `banned` and nothing else (`ban_reason` and other users' rows are denied).
- [ ] No client role can insert, update or delete a `profiles` row: a signed-in user who sends `update profiles set banned = false` through the API changes nothing.
- [ ] A public API request selecting `user_id` from `scores` is denied; leaderboards, Home LATEST SCORES and TOP PLAYERS, and BestScore still load.
- [ ] After migration B, an `anon` insert on `scores` through the REST API is rejected and no row is created.
- [ ] After migration B, a signed-in, not banned user saves a score and the new row has `user_id` equal to their auth id.
- [ ] A signed-in user cannot insert a score with another user's `user_id`, and a JWT with `is_anonymous: true` cannot insert.
- [ ] After `update public.profiles set banned = true ...` for a user, that user's next SAVE SCORE fails, the UI shows `THIS ACCOUNT CANNOT SAVE SCORES.`, and no row is created. A direct REST insert with the same session is rejected too.
- [ ] The ban applies without the user signing out or reloading, and unbanning (`banned = false`) lets the next save succeed, also without signing out.
- [ ] A banned user can still sign in, play every game, open leaderboards, and use `/account/`; their old scores stay on the leaderboards.
- [ ] An expired or missing session at save time shows `SIGN IN TO SAVE YOUR SCORE.`, not the ban message.
- [ ] The ban and unban SQL snippets in `CLAUDE.md` work as written against the live project.
- [ ] Both migration files are in `supabase/migrations/` with the versions assigned by `apply_migration`, and `lib/supabase/database.types.ts` is regenerated (not hand-edited) and includes `profiles` and `scores.user_id`.

Rules and regressions:

- [ ] `lib/auth.ts` imports nothing from `react`, `next` or `@supabase`.
- [ ] No server code was added: no route handler, cookie, server action, `proxy.ts`, server Supabase client or service role key; `output: "export"` still builds.
- [ ] Only two migrations are added (`add_profiles_and_score_user_id`, `require_signin_to_save_scores`); `games` and the rest of `scores` are unchanged; `insertScore` keeps its signature and `fetch*` functions keep their columns.
- [ ] No new dependency.
- [ ] `av_user` is no longer written or read anywhere in `app/`, `components/` or `lib/`; the only new browser key owned by the app is `sessionStorage` `av_auth_next`.
- [ ] Leaderboards, Hall of Fame, the contact form and all play pages behave as before.
- [ ] Every new page works at 375px with no horizontal scroll.
- [ ] All new UI text is English.
- [ ] `npm run lint` and `npm run build` finish without errors.
- [ ] `get_advisors` (security) shows no new warning caused by this spec.

## Decisions

- **Yes:** real Supabase Auth instead of keeping the mock. User decision. The mock accepts any value and gives no real session.
- **Yes:** email + password, Google and GitHub. User decision. The mock page already drew both OAuth buttons.
- **No:** magic link. Not requested; password login covers it.
- **Yes:** email confirmation OFF. User decision. Fewer steps, no redirect and inbox state to build now. The cost is that fake emails can register; this is acceptable because no private data and no score ownership depend on the account yet.
- **Yes:** username stays in `user_metadata`, even though a `profiles` table now exists. The table holds only ban state, so the name has one source of truth and OAuth name derivation needs no trigger logic. Cost: two users can share a name, as they can today with free-text score names.
- **Yes:** a `profiles` table (`banned`, `ban_reason`, `banned_at`). User decision, for the ban. **No:** unique usernames and the username inside it; that goes with a future profile spec.
- **Yes:** username rule `A-Z a-z 0-9 _ -`, 1-20 chars, stored uppercase. User decision: 20, not 10. `scores.name` stays 1-10 chars, so SAVE SCORE cuts the prefilled name to 10. The old mock allowed any text; spaces and symbols are now rejected so names stay readable on the leaderboard.
- **Yes:** OAuth usernames are derived from the provider profile and not written back. User decision. No extra "pick a name" step. The account page lets the user set a real one, which then wins over the derived one.
- **Yes:** password minimum 8 chars, confirm field on register. User decision. Also set in the Supabase Dashboard so the server enforces it, not only the form.
- **Yes:** keep `PLAY AS GUEST`. User decision. Guest = no session, as today.
- **Yes:** require sign in to save scores, with `scores.user_id` filled by the column default `auth.uid()`. User decision. **This reverses the anonymous insert of SPEC 06.** A ban cannot work while guests can save, because a banned user would sign out and save as a guest. Guests still play and read all leaderboards.
- **No:** ban by name, or ban only while signed in. Both are trivially bypassed.
- **Yes:** the ban lives in the database and is enforced by the `scores` insert policy, not by the UI. The UI only picks the message. A client that skips the UI is still blocked.
- **Yes:** ban and unban by hand with SQL (SQL editor or MCP `execute_sql`). No admin page, no ban API. Smallest thing that works, and no role or admin account to secure.
- **Yes:** old scores of a banned user stay, and the user sees a clear message. User decision. Hiding or deleting old scores is done by hand if ever wanted.
- **No:** banning through Supabase Auth `banned_until`. It blocks sign in entirely; the goal is only to block saving scores.
- **Yes:** two migrations. A (profiles, trigger, `user_id`) is additive and safe to apply early. B (policy swap) is the only breaking change and is applied last, right before the merge, so the live site keeps saving until the new UI ships.
- **Yes:** column-level grants on `scores` (`user_id` not readable) and on `profiles` (`ban_reason` not readable), so public clients cannot learn who owns a score or why someone was banned.
- **Yes:** the insert policy also rejects JWTs with `is_anonymous = true`, and the Dashboard keeps anonymous sign-ins off. Anonymous sign-ins would otherwise get the `authenticated` role and bypass the sign in rule.
- **Yes:** the client never caches the ban flag. On a policy error it reads `profiles.banned` once to choose between the ban message and the sign in message, so ban and unban apply on the next save.
- **Yes:** the score name stays editable free text (1-10 chars). Tying it to the username is a different decision.
- **Yes:** return to the previous page after sign in, else `/`. User decision. Stored in `sessionStorage` (`av_auth_next`) and not in a `?next=` query, because the OAuth `redirectTo` must match the Supabase allow-list and a query string can break that match, and because reading the query on a static page needs `useSearchParams` and a Suspense boundary.
- **Yes:** `safeNextPath` accepts only same-site paths. Stops an open redirect through a tampered `av_auth_next`.
- **Yes:** forgot password, reset page and account settings (change username and password) in this spec. User decision, after being offered a split into a later spec. It makes this spec large, so it is delivered in nine independent steps.
- **Yes:** forgot password answers the same whether or not the email exists, and sign in uses one message for wrong email and wrong password. No account enumeration.
- **Yes:** the nav keeps no dropdown: name links to `/account/`, `SIGN OUT` is its own button. A dropdown already exists for GamePad; two menus in the bar would crowd 375px.
- **Yes:** a signed-in visitor on `/auth/` is redirected away. Stops a signed-in user from seeing a form that would create a second session.
- **Yes:** the session provider has a `status` and an `unavailable` state so missing env vars do not crash the whole site, since `getSupabase()` throws on empty variables and the provider sits in `app/layout.tsx`.
- **Yes:** remove the `av_user` helpers in `lib/storage.ts`. Dead code after this spec; leaving it invites a second source of truth. `av_scores` helpers are left as they are (already unused, not part of this spec).
- **Yes:** configuration that lives in the Supabase Dashboard is a manual checklist (step 1). The Supabase MCP has no tool to change Auth settings.
- **No:** server-side auth, cookies, `proxy.ts`. The site is a static export on GitHub Pages.
- **No:** changing the "ARCADE HALL TERMS" line. There is no terms page; building one is a different spec.

## Risks

| Risk                                                                                                                                                  | Mitigation                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google or GitHub OAuth is not configured when step 5 runs.                                                                                            | Step 1 is the user's checklist. Every step except step 7 works without it. The buttons show the mapped Supabase error, never fail silently. Acceptance for OAuth stays unchecked until the providers exist. |
| OAuth or reset redirect is rejected because the URL is not in the allow-list (GitHub Pages path `/Arcade-Vault-Claude/`, `trailingSlash`, localhost). | Allow-list uses the `/**` wildcard for both origins. Redirect URLs are built from `lib/base-path.ts`. Step 9 tests both origins.                                                                            |
| Supabase's built-in email sender has a low hourly limit, so reset emails may be rejected during testing or traffic.                                   | Map `over_email_send_rate_limit` to `Too many emails sent. Try again in a few minutes.`. Custom SMTP (Resend) is out of scope; a follow-up spec if the limit bites.                                         |
| Email confirm is turned ON later or by mistake: `signUp` returns a user with no session.                                                              | The register flow checks for a missing session and shows `Account created. Check your email to confirm it.` instead of redirecting as signed in.                                                            |
| Hydration mismatch because the session exists only in the browser.                                                                                    | `user` is `null` and `status` is `loading` on the server render and first client render; the session is read in an effect.                                                                                  |
| Password recovery link opens a page where the recovery session is not ready yet (PKCE code exchange is async).                                        | The reset page waits for the `PASSWORD_RECOVERY` event or `getSession()` before showing the form or the expired message. Checked in step 9 with a real email.                                               |
| `updateUser({ password })` may require a recent sign in if the Dashboard has `Secure password change` ON.                                             | Keep it OFF (default). If an error comes back, show the mapped message and note the setting in `CLAUDE.md`.                                                                                                 |
| Fake or test accounts pile up in `auth.users`.                                                                                                        | Step 9 deletes the test accounts it created, with user approval.                                                                                                                                            |
| Users can no longer log in with any value, so people used to the mock see failed logins.                                                              | The sign in tab errors are explicit, `CREATE ACCOUNT` is one tab away, `PLAY AS GUEST` stays.                                                                                                               |
| Open redirect through `av_auth_next`.                                                                                                                 | `safeNextPath` allows only same-site paths and is covered by an acceptance criterion.                                                                                                                       |
| Migration B is applied before the new UI is live: the current production build offers guest SAVE SCORE and would fail.                                | Migration B is its own step, applied right before merging to `master`. Migration A is additive and breaks nothing.                                                                                          |
| A banned user registers a new account and saves again (email confirmation is off).                                                                    | Accepted: a ban is per account. Email confirmation or CAPTCHA would raise the cost; both are out of scope and can come in a later spec.                                                                     |
| Anonymous sign-ins get turned on in the Dashboard and give guests the `authenticated` role.                                                           | The Dashboard checklist keeps them off, and the insert policy rejects `is_anonymous` JWTs.                                                                                                                  |
| A guest who signs in at game over loses the score of that run.                                                                                        | Accepted and written in the scope. The prompt text tells the guest to sign in; the guest plays again. A later spec can keep a pending score.                                                                |
| `revoke select` on `scores` columns breaks any query that uses `select *`, now or in future code.                                                     | All current queries list columns. `CLAUDE.md` states the rule. `get_advisors` and the leaderboard checks run in step 3.                                                                                     |
| The trigger that creates `profiles` fails and blocks sign up.                                                                                         | The trigger is minimal (`security definer`, `on conflict do nothing`) and the register flow is tested right after migration A.                                                                              |
| Banned user sees the failure only after the game ends.                                                                                                | Accepted: the DB is the source of truth and the UI never caches the flag. A pre-check at game over can come later.                                                                                          |

## What is **not** in this spec

- A ban admin UI, temporary bans, appeals, ban emails, hiding old scores of a banned user, protection against ban evasion with a new account.
- Linking old score rows to accounts, and keeping a guest's score through sign in.
- Unique usernames, avatars, public profiles, the username inside `profiles`.
- Magic link, phone login, other providers, MFA.
- Email confirmation, custom email templates, custom SMTP.
- Delete account, change email, session management.
- A terms page.
- Server-side auth (cookies, `proxy.ts`, server client, service role key).
- Automated tests.

Each one of those, if it lands, goes in its own spec.
