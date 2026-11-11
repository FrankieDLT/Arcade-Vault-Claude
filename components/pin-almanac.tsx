"use client";

import { PinSprite } from "@/components/pin-sprite";
import type { OwnedStatus } from "@/components/pin-collection";
import { GAMES } from "@/lib/games";
import {
  KIND_LABEL,
  PINS,
  RARITY_LABEL,
  type Pin,
} from "@/lib/pins/catalog";

const GAME_TITLE: Record<string, string> = Object.fromEntries(
  GAMES.map((g) => [g.id, g.title]),
);

const numberLabel = (n: number) => `No. ${String(n).padStart(3, "0")}`;

/** An obtained pin: full sprite and every detail. */
function OwnedCard({ pin }: { pin: Pin }) {
  return (
    <li className="pin-card owned" data-rarity={pin.rarity}>
      <div className="pin-no">{numberLabel(pin.number)}</div>
      <PinSprite pinId={pin.id} size={72} />
      <div className="pin-name">{pin.name}</div>
      <div className="pin-rarity">{RARITY_LABEL[pin.rarity]}</div>
      <div className="pin-meta">
        {GAME_TITLE[pin.gameId] ?? pin.gameId} · {KIND_LABEL[pin.kind]}
      </div>
    </li>
  );
}

/**
 * A pin not yet obtained: only the number and a solid silhouette. No name, rarity
 * or game text is rendered for it (SPEC 18).
 */
function LockedCard({ pin }: { pin: Pin }) {
  return (
    <li className="pin-card locked" aria-label={`${numberLabel(pin.number)}, not collected`}>
      <div className="pin-no">{numberLabel(pin.number)}</div>
      <PinSprite pinId={pin.id} size={72} silhouette />
      <div className="pin-name">???</div>
    </li>
  );
}

export function PinAlmanac({
  owned,
  status,
  total,
}: {
  owned: ReadonlySet<string>;
  status: OwnedStatus;
  total: number;
}) {
  return (
    <section className="pin-almanac" aria-labelledby="almanac-title">
      <div className="almanac-head">
        <h2 id="almanac-title">ALMANAC</h2>
        <div className="almanac-count" aria-live="polite">
          OWNED {owned.size} / {total}
        </div>
      </div>
      {status === "error" && (
        <p className="pins-note" role="alert">
          Could not load your pins. Reload the page to try again.
        </p>
      )}
      <ul className="almanac-grid">
        {PINS.map((pin) =>
          owned.has(pin.id) ? (
            <OwnedCard key={pin.id} pin={pin} />
          ) : (
            <LockedCard key={pin.id} pin={pin} />
          ),
        )}
      </ul>
    </section>
  );
}
