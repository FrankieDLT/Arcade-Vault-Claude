"use client";

import { useEffect, useRef } from "react";
import { PIN_SPRITES } from "@/lib/pins/sprites";

const GRID = 16;
const SILHOUETTE = "#2a2742";

type Props = {
  pinId: string;
  /** CSS size in px (the canvas itself is 16x16 and scaled up, no smoothing). */
  size?: number;
  /** Solid shape of the sprite, no colors. Used for pins not yet obtained. */
  silhouette?: boolean;
  className?: string;
};

/** Draws one pin once into a 16x16 canvas and stops: no animation loop. */
export function PinSprite({
  pinId,
  size = 64,
  silhouette = false,
  className,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const sprite = PIN_SPRITES[pinId];
    const ctx = canvas?.getContext("2d");
    if (!canvas || !sprite || !ctx) return;
    ctx.clearRect(0, 0, GRID, GRID);
    sprite.rows.forEach((row, y) => {
      for (let x = 0; x < GRID; x++) {
        const key = row[x];
        if (key === ".") continue;
        ctx.fillStyle = silhouette
          ? SILHOUETTE
          : (sprite.palette[key] ?? "#ff00ff");
        ctx.fillRect(x, y, 1, 1);
      }
    });
  }, [pinId, silhouette]);

  return (
    <canvas
      ref={ref}
      width={GRID}
      height={GRID}
      className={className}
      style={{ width: size, height: size, imageRendering: "pixelated" }}
      aria-hidden="true"
    />
  );
}
