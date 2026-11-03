# SPEC 03 — About page and contact email

> **Status:** Implemented
> **Depends on:** SPEC 01, SPEC 02
> **Date:** 2026-11-02
> **Objective:** Port the About + Contact page of `references/templates/home-about/` to `/about` in English, enable the "About" nav entry, and send the contact form as an email through Resend via a `POST /api/contact` Route Handler.

## Why this spec exists

SPEC 02 reserved a disabled "About" slot in the nav and left the About page out. The prototype in `references/templates/home-about/about.jsx` has an About section and a contact form whose "send" is fake (it only flips to a terminal-style success view). This spec builds the page and makes the form real: the message reaches the team inbox through Resend. The Resend API key is not available yet, so the code must work without it and fail gracefully until it is provided.

## Scope

**In:**

- New page at `/about` with two parts copied visually from `about.jsx`: About (kicker, title, mission text, 3 highlight cards with pixel icons), a pixel divider banner, and Contact (intro with 3 tips + form).
- Scroll-reveal on the divider and contact sections, reusing `components/reveal-observer.tsx` from SPEC 02.
- Contact form (client component): fields name, email, message; shake animation when a field is empty; terminal-style success view with "SEND ANOTHER MESSAGE"; a themed error line when the request fails.
- `POST /api/contact` Route Handler (`app/api/contact/route.ts`) that validates the body, applies the honeypot and rate limit, and sends the email with the `resend` package.
- Server-side validation: all fields required after trim, email format, max lengths.
- Honeypot field: hidden input; if filled, the server returns success without sending.
- In-memory rate limit per IP: 3 requests per 10 minutes; excess returns `429`.
- Email: from the Resend sandbox sender, to the address in `CONTACT_TO_EMAIL`, `replyTo` set to the visitor's email, subject and text body in English.
- Env vars `RESEND_API_KEY` and `CONTACT_TO_EMAIL`, documented in a committed `.env.example`.
- Nav: "About" becomes a real link to `/about` (desktop and mobile), active on `/about`.
- About/Contact CSS ported from `references/templates/home-about/styles.css` into `app/globals.css` (only missing rules; none exist today).
- All copy translated to English, including the terminal success lines.
- Per-page `metadata` title for `/about`.

**Out of scope (for future specs):**

- A verified sending domain and a custom "from" address (the sandbox sender is used).
- Auto-reply or confirmation email to the visitor.
- Persisting messages (no database, no `localStorage`).
- Distributed or persistent rate limiting (the in-memory limit is best-effort only).
- CAPTCHA, Turnstile or similar.
- HTML email templates (plain text body only).
- Obtaining or provisioning the Resend API key.
- i18n, automated tests, SEO beyond the page title.

## Data model

```ts
// lib/contact.ts
export const CONTACT_LIMITS = {
  name: 60,
  email: 254,
  message: 2000,
} as const;

export interface ContactPayload {
  name: string;
  email: string;
  message: string;
  website: string; // honeypot, must be "" for real users
}

export type ContactResponse =
  | { ok: true }
  | { ok: false; error: "invalid" | "rate_limited" | "send_failed" };

export function validateContact(input: unknown): ContactPayload | null;
```

Conventions:

- `validateContact` trims all strings, checks they are non-empty (except `website`), checks the email with a simple regex and the max lengths in `CONTACT_LIMITS`, and returns `null` on any failure.
- The rate limiter lives in `lib/rate-limit.ts` as a module-level `Map<string, number[]>` of timestamps keyed by IP (`x-forwarded-for`, first value, fallback `"unknown"`).
- HTTP mapping: `400` → `invalid`, `429` → `rate_limited`, `500` → `send_failed` (also used when `RESEND_API_KEY` or `CONTACT_TO_EMAIL` is missing), `200` → `ok`.
- Email: `from: "Arcade Vault <onboarding@resend.dev>"`, `to: process.env.CONTACT_TO_EMAIL`, `replyTo: payload.email`, `subject: "[Arcade Vault] Message from <name>"`.
- The `Resend` client is created inside the handler, not at module load, so the build passes without the key.
- No new `localStorage` keys. No new session state.

## Implementation plan

Before step 1, read the relevant guides in `node_modules/next/dist/docs/` (Route Handlers, `cacheComponents`, client components, metadata, environment variables) as required by `AGENTS.md`. Invoke `/frontend-design` for all UI work, per `CLAUDE.md`.

1. **Dependency and env.** Run `npm install resend`. Create `.env.example` with `RESEND_API_KEY=` and `CONTACT_TO_EMAIL=` and a comment on each. Confirm `.env*` is gitignored and `.env.example` is still committed (add a `!.env.example` rule if needed). `npm run build` passes.
2. **Contact logic.** Create `lib/contact.ts` (limits, types, `validateContact`) and `lib/rate-limit.ts` (`isRateLimited(key, limit, windowMs)`). Nothing is wired yet; `npm run build` passes.
3. **Route Handler.** Create `app/api/contact/route.ts` with `POST`: parse JSON (invalid JSON → `400`), honeypot check, rate limit, validation, Resend send. Manual check with `curl`: invalid body → `400`; missing key → `500`; fourth request within 10 minutes → `429`; filled honeypot → `200` and no send.
4. **About CSS.** Diff `references/templates/home-about/styles.css` against `app/globals.css` and append only the missing About/Contact rules (about hero, highlight row, divider, contact grid, tips, form fields, `.shake`, terminal success, caret). Record any conflict in the commit message. No visible change yet.
5. **About sections.** Create `components/about.tsx` (server component) with the About hero, highlights, divider and the Contact intro, plus `HighlightIcon` (3 pixel SVGs: heart, browser, plant) in the same folder. Render `<RevealObserver />` inside it.
6. **Contact form.** Create `components/contact-form.tsx` (client): controlled fields, hidden honeypot input (`name="website"`, `tabIndex={-1}`, `autoComplete="off"`, visually hidden, `aria-hidden`), client-side empty check with the shake animation, `fetch("/api/contact")` with a `sending` state that disables the button, terminal success view using the visitor's uppercase name, and an error line for `invalid`, `rate_limited` and `send_failed`. On error the typed values are kept. Render it inside `About`.
7. **Route and metadata.** Create `app/about/page.tsx` rendering `<About />` with `metadata.title`. `/about` now works but is still unlinked in the nav.
8. **Nav.** Update `components/nav.tsx`: replace the disabled "About" `<span>` with a `next/link` to `/about` in both the desktop links and the mobile panel; active when the pathname is `/about`. Remove the disabled-link styling if nothing else uses it.
9. **Polish.** Run `npm run lint` and `npm run build`, then walk through `/about` at 1280px and 375px, including a real send once the API key is available.

## Acceptance criteria

- [ ] `npm run lint` and `npm run build` finish without errors, with no `RESEND_API_KEY` set.
- [ ] `/about` responds 200 and shows, in order: kicker "ABOUT", title, mission text, 3 highlight cards, divider, contact intro with 3 tips, contact form.
- [ ] The desktop nav and the mobile panel show "About" as a link to `/about`, without a full page reload; it is active only on `/about`.
- [ ] Submitting the form with any empty field does not call the API and shakes the form.
- [ ] A successful submit disables the button while sending, then shows the terminal view with `THANKS, <NAME IN UPPERCASE>`.
- [ ] "SEND ANOTHER MESSAGE" returns to an empty form.
- [ ] `POST /api/contact` with a valid body, a valid `RESEND_API_KEY` and `CONTACT_TO_EMAIL` returns `{ ok: true }` and the email arrives at that address with `Reply-To` equal to the visitor's email.
- [ ] `POST /api/contact` with an empty field, an invalid email, or a field over its max length returns `400` and `{ ok: false, error: "invalid" }`, and sends nothing.
- [ ] `POST /api/contact` with a non-empty `website` field returns `200` and sends nothing.
- [ ] The fourth request from the same IP within 10 minutes returns `429` and `{ ok: false, error: "rate_limited" }`.
- [ ] With `RESEND_API_KEY` or `CONTACT_TO_EMAIL` missing, the endpoint returns `500` and `{ ok: false, error: "send_failed" }`, and the form shows the error line while keeping the typed text.
- [ ] The API key is never present in client bundles or in any response body.
- [ ] `.env.example` is committed; no real key is committed.
- [ ] Sections with `.reveal` start hidden and gain `in` when scrolled into view; with `prefers-reduced-motion: reduce` they are visible on load.
- [ ] No visible About string and no email subject or body is in Spanish.
- [ ] Loading `/about` shows no React hydration warnings in the browser console.
- [ ] At 375px width `/about` has no horizontal scroll.
- [ ] The criteria of SPEC 02 about the nav still hold, except that "About" is now an enabled link.

## Decisions

- **Yes:** English copy for the page and the email. Consistent with SPEC 01 and SPEC 02.
- **Yes:** Route Handler at `POST /api/contact`. Decided by the user over a Server Action.
- **No:** Server Action. Simpler and not publicly callable, but the user preferred an explicit API route.
- **Yes:** Resend sandbox sender `onboarding@resend.dev` to an address in `CONTACT_TO_EMAIL`. Works without a domain; switching to a verified domain later is a one-line change.
- **No:** auto-reply to the visitor. Needs a verified domain to reach arbitrary addresses.
- **Yes:** `replyTo` set to the visitor's email. Replying from the inbox goes straight to the visitor.
- **Yes:** server-side validation. The client check can be bypassed.
- **Yes:** honeypot field. Cheap bot defense with no dependency.
- **Yes:** in-memory rate limit. Accepted as best-effort, since serverless instances do not share memory.
- **No:** Upstash/Redis rate limiting or CAPTCHA. Extra services for a contact form; a later spec if abuse appears.
- **Yes:** an inline error line on failure, keeping the typed text. Not selected explicitly, but the form needs some failure behavior and losing the user's message is worse.
- **Yes:** `.env.example` documenting both variables. The key is provided later, so the setup must be written down.
- **Yes:** `Resend` client created inside the handler. The build and the rest of the app work without the key.
- **Yes:** `About` as a server component with the form as the only client component besides the reveal observer.
- **Yes:** append only missing CSS to `app/globals.css`. Same rule as SPEC 01 and SPEC 02.

## Risks

| Risk                                                                                   | Mitigation                                                                                              |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| The API key is not available during implementation, so the real send cannot be tested. | Verify validation, honeypot, rate limit and the missing-key `500` path locally; do the real send in step 9 when the key exists. |
| Sandbox sender only delivers to the Resend account owner's email.                      | Set `CONTACT_TO_EMAIL` to that address; document it in `.env.example`.                                   |
| In-memory rate limit resets on restart and is not shared between serverless instances. | Accepted and documented; upgrade path is a separate spec.                                               |
| `x-forwarded-for` can be spoofed, so the limit can be bypassed.                        | Accepted for an MVP; the honeypot and server validation still apply.                                    |
| Visitor input in the email subject could carry line breaks.                            | Strip control characters from `name` before building the subject; validate the email format.            |
| `cacheComponents` rules for Route Handlers and static server components.               | `POST` is never cached; `About` uses only static imports; read the Next 16 docs before steps 3 and 5.   |
| `.reveal` hides content if the observer never runs.                                    | Same mitigation as SPEC 02: the observer handles reduced motion and sections render server-side.        |

## What is **not** in this spec

- A verified domain or custom sender address.
- Auto-reply email to the visitor.
- Storing messages anywhere.
- Persistent or distributed rate limiting, or CAPTCHA.
- HTML email templates.
- Provisioning the Resend API key.
- Automated tests.

Each one of those, if it lands, goes in its own spec.
