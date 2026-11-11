import { ORIGINS } from "@/lib/games";
import type { Origin } from "@/lib/types";

/**
 * Origin emoji. One entry in `ORIGINS[origin].emoji` renders as plain text;
 * two entries render as a split emoji (first = left half, second = right half).
 * `decorative` hides it from assistive tech when a text label sits next to it.
 */
export function OriginEmoji({
  origin,
  decorative = false,
}: {
  origin: Origin;
  decorative?: boolean;
}) {
  const { emoji, name } = ORIGINS[origin];
  const a11y = decorative
    ? ({ "aria-hidden": true } as const)
    : ({ role: "img", "aria-label": name, title: name } as const);

  return (
    <span className="origin-emoji" {...a11y}>
      {emoji.length === 1 ? (
        emoji[0]
      ) : (
        <>
          <span className="oe-left" aria-hidden="true">
            {emoji[0]}
          </span>
          <span className="oe-right" aria-hidden="true">
            {emoji[1]}
          </span>
        </>
      )}
    </span>
  );
}
