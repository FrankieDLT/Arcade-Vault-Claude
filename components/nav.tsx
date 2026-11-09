"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { GamepadMenu } from "@/components/gamepad-menu";
import { getGameDefinition } from "@/components/game-registry";
import { useSession } from "@/components/session-provider";
import { rememberNextPath } from "@/lib/auth-redirect";

export function Nav() {
  const pathname = usePathname();
  const { user, signOut } = useSession();
  const [open, setOpen] = useState(false);

  const inHome = pathname === "/";
  const inLibrary =
    pathname.startsWith("/library") || pathname.startsWith("/games");
  const inHall = pathname.startsWith("/hall-of-fame");
  const inAbout = pathname.startsWith("/about");
  const inAuth = pathname.startsWith("/auth");
  const inAccount = pathname.startsWith("/account");
  // Remember where the user was, so sign in can send them back (SPEC 13).
  const rememberHere = () => rememberNextPath(pathname);
  // GamePad menu: only on /games/<id>/play of a game that has an on-screen pad.
  const playId = /^\/games\/([^/]+)\/play\/?$/.exec(pathname)?.[1];
  const hasPad = !!playId && !!getGameDefinition(playId)?.touch?.pad;
  const close = () => setOpen(false);

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo" onClick={close}>
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link href="/" className={inHome ? "active" : ""}>
            Home
          </Link>
          <Link href="/library" className={inLibrary ? "active" : ""}>
            Library
          </Link>
          <Link href="/hall-of-fame" className={inHall ? "active" : ""}>
            Hall of Fame
          </Link>
          <Link href="/about" className={inAbout ? "active" : ""}>
            About
          </Link>
        </div>
        <div className="spacer"></div>
        {hasPad && <GamepadMenu />}
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CREDITS · 03</span>
        </div>
        {user ? (
          <>
            <Link href="/account" className="btn ghost auth-btn">
              {user.name}
            </Link>
            <button
              type="button"
              className="btn ghost nav-signout"
              onClick={signOut}
            >
              SIGN OUT
            </button>
          </>
        ) : (
          <Link href="/auth" className="btn auth-btn" onClick={rememberHere}>
            Sign in
          </Link>
        )}
        <button
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menu"
          aria-expanded={open}
        >
          ≡
        </button>
      </nav>

      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={close}
      ></div>
      <aside
        className={"av-mobile-panel" + (open ? " open" : "")}
        inert={!open}
      >
        <div
          className="pixel neon-cyan"
          style={{ fontSize: 11, marginBottom: 16 }}
        >
          MENU
        </div>
        <Link href="/" className={inHome ? "active" : ""} onClick={close}>
          Home
        </Link>
        <Link
          href="/library"
          className={inLibrary ? "active" : ""}
          onClick={close}
        >
          Library
        </Link>
        <Link
          href="/hall-of-fame"
          className={inHall ? "active" : ""}
          onClick={close}
        >
          Hall of Fame
        </Link>
        <Link href="/about" className={inAbout ? "active" : ""} onClick={close}>
          About
        </Link>
        {user ? (
          <>
            <Link
              href="/account"
              className={inAccount ? "active" : ""}
              onClick={close}
            >
              Account
            </Link>
            <button
              type="button"
              className="av-mobile-signout"
              onClick={() => {
                close();
                void signOut();
              }}
            >
              Sign out
            </button>
          </>
        ) : (
          <Link
            href="/auth"
            className={inAuth ? "active" : ""}
            onClick={() => {
              rememberHere();
              close();
            }}
          >
            Sign in
          </Link>
        )}
        <div style={{ flex: 1 }}></div>
        <div
          className="pixel"
          style={{
            fontSize: 9,
            color: "var(--ink-faint)",
            letterSpacing: "0.16em",
          }}
        >
          CREDITS · 03
        </div>
      </aside>
    </>
  );
}
