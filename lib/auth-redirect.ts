import { safeNextPath } from "@/lib/auth";

// Where to send the user after sign in (SPEC 13). Lives in sessionStorage so it
// survives the OAuth round trip. Every access is guarded: with no storage the
// user simply goes to "/".
export const AUTH_NEXT_KEY = "av_auth_next";

/** Remembers the page the user came from. Ignores /auth pages and unsafe paths. */
export function rememberNextPath(path: string): void {
  try {
    const safe = safeNextPath(path);
    if (safe === "/" && path !== "/") return;
    window.sessionStorage.setItem(AUTH_NEXT_KEY, safe);
  } catch {
    // storage blocked: fall back to "/"
  }
}

/** Reads and clears the remembered path. Always returns a safe same-site path. */
export function takeNextPath(): string {
  try {
    const stored = window.sessionStorage.getItem(AUTH_NEXT_KEY);
    window.sessionStorage.removeItem(AUTH_NEXT_KEY);
    return safeNextPath(stored);
  } catch {
    return "/";
  }
}
