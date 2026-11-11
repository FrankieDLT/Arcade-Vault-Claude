"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCredits } from "@/components/credits-provider";
import { PinSprite } from "@/components/pin-sprite";
import { rememberNextPath } from "@/lib/auth-redirect";
import { PinsError, pullPin, type PullResult } from "@/lib/pins-db";
import {
  DUPLICATE_REFUND,
  PIN_BY_ID,
  RARITY_LABEL,
  RARITY_ODDS,
  RARITY_ORDER,
  type PullCost,
} from "@/lib/pins/catalog";

const DROP_MS = 1500;
// The opened capsule leaves the tray this long after the pin is revealed.
const CLEAR_MS = 3000;

// Offsets (px) the globe capsules tumble through while a pull runs, per capsule and step.
const wobble = (i: number, k: number) =>
  Math.round(Math.sin(i * 2.1 + k * 1.7) * 38);

const BUTTONS: { cost: PullCost; hint: string }[] = [
  { cost: 5, hint: "Standard odds" },
  { cost: 10, hint: "Better odds, favors new pins" },
  { cost: 100, hint: "Guaranteed new pin, lowest rarity first" },
];

const ERROR_TEXT: Record<PinsError["kind"], string> = {
  insufficient: "Not enough credits. Finish a game to earn more.",
  collection_complete: "You already own every pin.",
  signin: "Sign in to collect pins.",
  network: "Could not reach the machine. Try again.",
};

// Fixed capsule layout inside the globe (percent of the globe box).
const GLOBE_CAPSULES: { x: number; y: number; c: string }[] = [
  { x: 24, y: 72, c: "b" },
  { x: 46, y: 78, c: "a" },
  { x: 68, y: 74, c: "c" },
  { x: 84, y: 58, c: "a" },
  { x: 16, y: 52, c: "c" },
  { x: 34, y: 54, c: "a" },
  { x: 56, y: 56, c: "b" },
  { x: 72, y: 40, c: "b" },
  { x: 24, y: 34, c: "b" },
  { x: 44, y: 36, c: "c" },
  { x: 58, y: 22, c: "a" },
  { x: 36, y: 20, c: "c" },
];

type Phase = "idle" | "dropping" | "revealed";

export function PinMachine({
  signedIn,
  sessionLoading,
  ownedCount,
  total,
  onObtained,
}: {
  signedIn: boolean;
  sessionLoading: boolean;
  ownedCount: number;
  total: number;
  onObtained: (pinId: string) => void;
}) {
  const { balance, setBalance } = useCredits();
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<PullResult | null>(null);
  const [error, setError] = useState<PinsError["kind"] | null>(null);
  const [cleared, setCleared] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (clearTimer.current) clearTimeout(clearTimer.current);
    },
    [],
  );

  const complete = signedIn && ownedCount >= total;
  const busy = phase === "dropping";

  const disabledFor = (cost: PullCost) =>
    !signedIn || busy || balance < cost || (cost === 100 && complete);

  const pull = async (cost: PullCost) => {
    if (disabledFor(cost)) return;
    if (clearTimer.current) clearTimeout(clearTimer.current);
    setError(null);
    setResult(null);
    setCleared(false);
    setPhase("dropping");
    try {
      const r = await pullPin(cost);
      setBalance(r.balance);
      setResult(r);
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const reveal = () => {
        setPhase("revealed");
        onObtained(r.pinId);
        clearTimer.current = setTimeout(() => setCleared(true), CLEAR_MS);
      };
      if (reduced) reveal();
      else timer.current = setTimeout(reveal, DROP_MS);
    } catch (err) {
      setPhase("idle");
      setError(err instanceof PinsError ? err.kind : "network");
    }
  };

  const pin = result ? PIN_BY_ID[result.pinId] : undefined;

  return (
    <section className="pin-machine" aria-labelledby="machine-title">
      <h2 id="machine-title" className="sr-only">
        Pin machine
      </h2>

      <div className="pm-cabinet" data-phase={phase} data-cleared={cleared}>
        <div className="pm-globe" aria-hidden="true">
          {GLOBE_CAPSULES.map((c, i) => (
            <span
              key={i}
              className={`pm-cap pm-cap-${c.c}`}
              style={
                {
                  left: `${c.x}%`,
                  top: `${c.y}%`,
                  "--x1": `${wobble(i, 1)}px`,
                  "--y1": `${wobble(i, 2)}px`,
                  "--x2": `${wobble(i, 3)}px`,
                  "--y2": `${wobble(i, 4)}px`,
                  "--x3": `${wobble(i, 5)}px`,
                  "--y3": `${wobble(i, 6)}px`,
                } as React.CSSProperties
              }
            />
          ))}
          <span className="pm-glare" />
        </div>
        <div className="pm-coil" aria-hidden="true" />
        <div className="pm-base">
          <div className="pm-lever" aria-hidden="true">
            <span className="pm-lever-arm" />
            <span className="pm-lever-ball" />
            <span className="pm-lever-base" />
          </div>
          <div className="pm-sign">
            <span className="pm-coin" aria-hidden="true" />
            <div className="pm-balance">
              <span className="pm-balance-l">CREDITS</span>
              <span className="pm-balance-v">
                {String(balance).padStart(2, "0")}
              </span>
            </div>
          </div>
          <div className="pm-tray" aria-hidden="true">
            <div className="pm-capsule">
              <span className="pm-half pm-top" />
              <span className="pm-half pm-bottom" />
              {phase === "revealed" && result && (
                <span className="pm-prize" data-rarity={result.rarity}>
                  <PinSprite pinId={result.pinId} size={56} />
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="pm-controls">
        <div className="pm-buttons">
          {BUTTONS.map(({ cost, hint }) => (
            <button
              key={cost}
              type="button"
              className="btn pm-btn"
              disabled={disabledFor(cost)}
              onClick={() => pull(cost)}
            >
              <span className="pm-btn-cost">{cost} CREDITS</span>
              <span className="pm-btn-hint">{hint}</span>
            </button>
          ))}
        </div>

        {!signedIn && !sessionLoading && (
          <Link
            href="/auth"
            className="btn yellow pm-signin"
            onClick={() => rememberNextPath("/pins")}
          >
            SIGN IN TO COLLECT PINS
          </Link>
        )}
        {complete && (
          <p className="pins-note">
            Collection complete. The 100 credit pull is closed.
          </p>
        )}

        <div className="pm-result" aria-live="polite">
          {error && (
            <p className="pins-note pins-error" role="alert">
              {ERROR_TEXT[error]}
            </p>
          )}
          {phase === "dropping" && <p className="pins-note">Dispensing...</p>}
          {phase === "revealed" && result && pin && (
            <div className="pm-card" data-rarity={result.rarity}>
              <PinSprite pinId={result.pinId} size={96} />
              <div className="pm-card-body">
                <div className="pm-card-name">{pin.name}</div>
                <div className="pm-card-rarity">
                  {RARITY_LABEL[result.rarity]}
                </div>
                <div
                  className={"pm-card-tag" + (result.isNew ? " is-new" : "")}
                >
                  {result.isNew
                    ? "NEW!"
                    : `DUPLICATE · +${result.refund} CREDITS`}
                </div>
                <div className="pm-card-balance">
                  BALANCE {String(result.balance).padStart(2, "0")}
                </div>
              </div>
            </div>
          )}
        </div>

        <table className="pm-odds">
          <caption>Pull odds and duplicate refund</caption>
          <thead>
            <tr>
              <th scope="col">Rarity</th>
              <th scope="col">5 credits</th>
              <th scope="col">10 credits</th>
              <th scope="col">Duplicate</th>
            </tr>
          </thead>
          <tbody>
            {RARITY_ORDER.map((r) => (
              <tr key={r} data-rarity={r}>
                <th scope="row">{RARITY_LABEL[r]}</th>
                <td>{RARITY_ODDS[5][r]}%</td>
                <td>{RARITY_ODDS[10][r]}%</td>
                <td>+{DUPLICATE_REFUND[r]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
