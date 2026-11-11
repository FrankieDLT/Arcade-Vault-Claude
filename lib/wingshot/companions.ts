// Companions: 24x32 pixel figures (drawn at x4 = 96x128 px), two poses each.
// A figure is a list of filled rects [char, x, y, w, h] painted in order (a run table).
// Frame 1 of each pose is the table, frame 2 is its mirror image; the motion (bob, sway,
// spin, sit) is done by `companionMotion`. Comedy comes from movement only, no text.

import {
  COMPANION_H,
  COMPANION_W,
  SPRITE_SCALE,
  type CompanionId,
  type CompanionPose,
  type Palette,
  type SpriteChar,
} from "./constants";
import { easeOut } from "./utils";

type Rect = [SpriteChar, number, number, number, number];

const FIGURES: Record<CompanionId, Record<CompanionPose, Rect[]>> = {
  // Fisherman: yellow hat, blue overalls. Cheer holds a fish up, gag reels in an old boot.
  fisherman: {
    cheer: [
      ["d", 8, 24, 3, 5],
      ["d", 13, 24, 3, 5],
      ["o", 7, 29, 4, 3],
      ["o", 13, 29, 4, 3],
      ["j", 7, 14, 10, 10],
      ["h", 9, 16, 6, 8],
      ["j", 4, 14, 3, 8],
      ["s", 4, 22, 3, 2],
      ["j", 17, 9, 3, 7],
      ["s", 17, 7, 3, 2],
      ["s", 8, 7, 8, 7],
      ["e", 8, 12, 8, 3],
      ["o", 10, 9, 1, 1],
      ["o", 13, 9, 1, 1],
      ["o", 10, 12, 4, 1],
      ["h", 5, 5, 14, 2],
      ["h", 8, 1, 8, 5],
      ["d", 19, 0, 1, 7],
      ["a", 20, 0, 4, 3],
      ["b", 23, 1, 1, 1],
      ["o", 22, 1, 1, 1],
    ],
    gag: [
      ["d", 8, 24, 3, 5],
      ["d", 13, 24, 3, 5],
      ["o", 7, 29, 4, 3],
      ["o", 13, 29, 4, 3],
      ["j", 7, 14, 10, 10],
      ["h", 9, 16, 6, 8],
      ["j", 4, 14, 3, 8],
      ["s", 4, 22, 3, 2],
      ["j", 17, 15, 3, 7],
      ["s", 17, 22, 3, 2],
      ["s", 8, 7, 8, 7],
      ["e", 8, 12, 8, 3],
      ["o", 10, 13, 4, 1],
      ["h", 5, 8, 14, 3],
      ["h", 8, 4, 8, 5],
      ["d", 18, 25, 4, 5],
      ["d", 21, 28, 3, 2],
      ["c", 18, 25, 4, 1],
    ],
  },
  // Plague doctor: black coat, beak mask. Cheer raises a lantern, gag sneezes into a cloth.
  "plague-doctor": {
    cheer: [
      ["h", 6, 14, 12, 14],
      ["j", 6, 20, 12, 2],
      ["o", 7, 28, 4, 3],
      ["o", 13, 28, 4, 3],
      ["h", 3, 14, 3, 8],
      ["h", 17, 9, 3, 7],
      ["h", 8, 6, 8, 7],
      ["b", 8, 6, 8, 6],
      ["b", 12, 9, 9, 2],
      ["b", 19, 8, 2, 2],
      ["o", 9, 8, 2, 2],
      ["o", 13, 8, 2, 2],
      ["h", 5, 4, 14, 2],
      ["h", 8, 0, 8, 4],
      ["o", 19, 1, 5, 1],
      ["g", 19, 2, 5, 6],
      ["e", 20, 3, 3, 4],
      ["o", 19, 8, 5, 1],
    ],
    gag: [
      ["h", 6, 14, 12, 14],
      ["j", 6, 20, 12, 2],
      ["o", 7, 28, 4, 3],
      ["o", 13, 28, 4, 3],
      ["h", 3, 14, 3, 8],
      ["h", 16, 13, 3, 4],
      ["h", 8, 6, 8, 7],
      ["b", 8, 6, 8, 6],
      ["b", 12, 9, 7, 2],
      ["b", 17, 11, 3, 5],
      ["o", 9, 8, 2, 2],
      ["o", 13, 8, 2, 2],
      ["h", 5, 4, 14, 2],
      ["h", 8, 0, 8, 4],
      ["e", 17, 11, 6, 4],
      ["e", 21, 7, 2, 1],
      ["e", 22, 5, 1, 1],
    ],
  },
  // Astronaut: white suit, dark visor. Cheer gives a thumbs up (floats), gag spins with kicking boots.
  astronaut: {
    cheer: [
      ["h", 7, 23, 4, 6],
      ["h", 13, 23, 4, 6],
      ["d", 6, 29, 5, 3],
      ["d", 13, 29, 5, 3],
      ["d", 3, 14, 3, 8],
      ["h", 6, 13, 12, 10],
      ["j", 9, 15, 6, 3],
      ["c", 10, 16, 1, 1],
      ["g", 13, 16, 1, 1],
      ["h", 3, 14, 3, 7],
      ["h", 17, 13, 3, 4],
      ["h", 19, 9, 4, 6],
      ["e", 20, 6, 2, 3],
      ["h", 6, 1, 12, 12],
      ["o", 8, 4, 8, 6],
      ["a", 9, 5, 3, 2],
      ["e", 14, 8, 1, 1],
    ],
    gag: [
      ["h", 4, 23, 4, 7],
      ["h", 16, 23, 4, 7],
      ["d", 2, 29, 5, 3],
      ["d", 17, 29, 5, 3],
      ["d", 3, 14, 3, 8],
      ["h", 6, 13, 12, 10],
      ["j", 9, 15, 6, 3],
      ["h", 3, 10, 3, 6],
      ["h", 18, 10, 3, 6],
      ["h", 6, 1, 12, 12],
      ["o", 8, 4, 8, 6],
      ["e", 8, 4, 8, 6],
      ["d", 9, 6, 6, 1],
    ],
  },
  // Samurai: blue kimono, red sash, topknot. Cheer salutes with the sword, gag sits with the sword stuck.
  samurai: {
    cheer: [
      ["j", 6, 21, 12, 8],
      ["o", 6, 29, 5, 3],
      ["o", 13, 29, 5, 3],
      ["h", 6, 11, 12, 11],
      ["j", 6, 17, 12, 3],
      ["h", 3, 12, 3, 8],
      ["s", 3, 20, 3, 2],
      ["h", 17, 9, 3, 7],
      ["s", 17, 7, 3, 2],
      ["s", 8, 3, 8, 8],
      ["o", 8, 3, 8, 3],
      ["o", 10, 0, 4, 3],
      ["o", 10, 7, 1, 1],
      ["o", 13, 7, 1, 1],
      ["o", 10, 9, 4, 1],
      ["e", 21, 0, 2, 12],
      ["g", 19, 12, 6, 2],
      ["d", 21, 14, 2, 3],
    ],
    gag: [
      ["j", 4, 26, 16, 3],
      ["o", 2, 27, 3, 3],
      ["o", 19, 27, 3, 3],
      ["h", 6, 14, 12, 12],
      ["j", 6, 20, 12, 3],
      ["h", 3, 15, 3, 8],
      ["s", 3, 23, 3, 2],
      ["h", 18, 15, 3, 7],
      ["s", 18, 22, 3, 2],
      ["s", 8, 6, 8, 8],
      ["o", 8, 6, 8, 3],
      ["o", 10, 3, 4, 3],
      ["o", 10, 10, 1, 1],
      ["o", 13, 10, 1, 1],
      ["o", 10, 12, 4, 1],
      ["d", 19, 8, 3, 12],
      ["g", 19, 6, 3, 3],
      ["d", 21, 3, 1, 4],
    ],
  },
  // Coal miner: lamp helmet, sooty face, plum vest, pickaxe. Cheer raises a gold nugget,
  // gag: the pickaxe head flies off and dust showers him.
  "coal-miner": {
    cheer: [
      ["d", 7, 29, 4, 3],
      ["d", 13, 29, 4, 3],
      ["j", 8, 23, 3, 6],
      ["j", 13, 23, 3, 6],
      ["j", 7, 14, 10, 9],
      ["g", 7, 18, 10, 1],
      ["d", 7, 22, 10, 1],
      ["j", 4, 14, 3, 8],
      ["s", 4, 22, 3, 2],
      ["d", 2, 10, 2, 20],
      ["a", 0, 9, 8, 2],
      ["a", 0, 11, 2, 2],
      ["j", 17, 9, 3, 7],
      ["s", 17, 7, 3, 2],
      ["g", 18, 1, 5, 5],
      ["e", 19, 2, 1, 1],
      ["s", 8, 7, 8, 7],
      ["d", 8, 11, 8, 3],
      ["d", 8, 7, 2, 2],
      ["e", 9, 9, 2, 2],
      ["e", 13, 9, 2, 2],
      ["o", 10, 10, 1, 1],
      ["o", 14, 10, 1, 1],
      ["e", 10, 12, 4, 1],
      ["h", 7, 3, 10, 4],
      ["h", 6, 6, 12, 1],
      ["g", 10, 3, 4, 3],
      ["e", 11, 4, 2, 1],
    ],
    gag: [
      ["d", 7, 29, 4, 3],
      ["d", 13, 29, 4, 3],
      ["j", 8, 23, 3, 6],
      ["j", 13, 23, 3, 6],
      ["j", 7, 14, 10, 9],
      ["g", 7, 18, 10, 1],
      ["d", 7, 22, 10, 1],
      ["j", 4, 14, 3, 8],
      ["s", 4, 22, 3, 2],
      ["j", 17, 14, 3, 8],
      ["s", 17, 22, 3, 2],
      ["d", 2, 12, 2, 18],
      ["a", 19, 0, 5, 2],
      ["a", 22, 2, 2, 2],
      ["s", 8, 7, 8, 7],
      ["d", 8, 11, 8, 3],
      ["e", 9, 9, 2, 2],
      ["e", 13, 9, 2, 2],
      ["o", 10, 11, 4, 2],
      ["h", 7, 4, 10, 3],
      ["h", 6, 7, 12, 1],
      ["g", 10, 4, 4, 3],
      ["b", 6, 1, 1, 1],
      ["b", 9, 0, 1, 1],
      ["b", 15, 2, 1, 1],
      ["b", 12, 1, 1, 1],
      ["b", 17, 0, 1, 1],
    ],
  },
  // Deckhand: original 1920s rubber-hose sailor, cap, pie-cut eyes, noodle limbs, big white gloves.
  // Cheer = happy jig, gag = trips over a bucket.
  deckhand: {
    cheer: [
      ["o", 9, 22, 2, 7],
      ["o", 14, 22, 2, 3],
      ["o", 16, 24, 4, 2],
      ["o", 6, 29, 6, 3],
      ["o", 19, 22, 5, 3],
      ["o", 7, 13, 10, 10],
      ["a", 8, 14, 8, 8],
      ["e", 8, 16, 8, 1],
      ["e", 8, 19, 8, 1],
      ["j", 8, 21, 8, 2],
      ["o", 5, 9, 2, 5],
      ["o", 3, 5, 2, 5],
      ["o", 0, 0, 7, 7],
      ["e", 1, 1, 5, 5],
      ["o", 17, 9, 2, 5],
      ["o", 19, 5, 2, 5],
      ["o", 17, 0, 7, 7],
      ["e", 18, 1, 5, 5],
      ["o", 7, 4, 10, 9],
      ["o", 8, 3, 8, 11],
      ["e", 8, 5, 8, 8],
      ["e", 9, 4, 6, 10],
      ["o", 9, 6, 3, 3],
      ["o", 13, 6, 3, 3],
      ["e", 10, 6, 1, 1],
      ["e", 14, 6, 1, 1],
      ["o", 11, 9, 2, 1],
      ["o", 9, 11, 6, 1],
      ["o", 8, 0, 8, 3],
      ["e", 8, 2, 8, 1],
      ["o", 6, 3, 12, 1],
    ],
    gag: [
      ["o", 9, 22, 2, 7],
      ["o", 5, 29, 6, 3],
      ["o", 14, 22, 5, 2],
      ["o", 18, 21, 4, 2],
      ["c", 16, 25, 7, 6],
      ["o", 16, 24, 7, 1],
      ["o", 16, 31, 7, 1],
      ["o", 18, 26, 1, 4],
      ["o", 7, 13, 10, 10],
      ["a", 8, 14, 8, 8],
      ["e", 8, 16, 8, 1],
      ["e", 8, 19, 8, 1],
      ["j", 8, 21, 8, 2],
      ["o", 1, 15, 6, 2],
      ["o", 0, 11, 5, 5],
      ["e", 1, 12, 3, 3],
      ["o", 17, 15, 6, 2],
      ["o", 19, 11, 5, 5],
      ["e", 20, 12, 3, 3],
      ["o", 7, 5, 10, 9],
      ["o", 8, 4, 8, 11],
      ["e", 8, 6, 8, 8],
      ["e", 9, 5, 6, 10],
      ["o", 9, 7, 3, 3],
      ["o", 13, 7, 3, 3],
      ["e", 11, 7, 1, 1],
      ["e", 15, 7, 1, 1],
      ["o", 11, 12, 3, 2],
      ["o", 8, 1, 8, 3],
      ["e", 8, 3, 8, 1],
      ["o", 6, 4, 12, 1],
    ],
  },
};

/** Draws one pose into a 96x128 canvas. `mirror` draws the second animation frame. */
export function rasterizeCompanion(
  palette: Palette,
  id: CompanionId,
  pose: CompanionPose,
  mirror: boolean,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = COMPANION_W;
  canvas.height = COMPANION_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  if (mirror) {
    ctx.translate(COMPANION_W, 0);
    ctx.scale(-1, 1);
  }
  for (const [ch, x, y, w, h] of FIGURES[id][pose]) {
    ctx.fillStyle = palette.p[ch];
    ctx.fillRect(
      x * SPRITE_SCALE,
      y * SPRITE_SCALE,
      w * SPRITE_SCALE,
      h * SPRITE_SCALE,
    );
  }
  return canvas;
}

export interface CompanionSprites {
  cheer: [HTMLCanvasElement, HTMLCanvasElement];
  gag: [HTMLCanvasElement, HTMLCanvasElement];
}

export function buildCompanion(
  palette: Palette,
  id: CompanionId,
): CompanionSprites {
  return {
    cheer: [
      rasterizeCompanion(palette, id, "cheer", false),
      rasterizeCompanion(palette, id, "cheer", true),
    ],
    gag: [
      rasterizeCompanion(palette, id, "gag", false),
      rasterizeCompanion(palette, id, "gag", true),
    ],
  };
}

export interface CompanionMotion {
  dx: number;
  dy: number;
  /** rad, around the middle of the figure */
  rot: number;
  frame: 0 | 1;
}

/** Motion of a visible companion; `t` = seconds since it finished rising. */
export function companionMotion(
  id: CompanionId,
  pose: CompanionPose,
  t: number,
): CompanionMotion {
  const frame: 0 | 1 = Math.floor(t * 5) % 2 === 0 ? 0 : 1;
  if (pose === "cheer") {
    const hop = Math.abs(Math.sin(t * 9)) * 10;
    if (id === "astronaut") {
      return {
        dx: 0,
        dy: -16 - Math.sin(t * 4) * 6,
        rot: Math.sin(t * 3) * 0.08,
        frame,
      };
    }
    if (id === "deckhand") {
      // jig: quick hops, sway side to side
      return {
        dx: Math.sin(t * 6) * 8,
        dy: -Math.abs(Math.sin(t * 12)) * 12,
        rot: Math.sin(t * 6) * 0.12,
        frame: Math.floor(t * 10) % 2 === 0 ? 0 : 1,
      };
    }
    return { dx: 0, dy: -hop, rot: 0, frame };
  }
  switch (id) {
    case "coal-miner":
      // dust shower: flinches and shakes
      return {
        dx: Math.sin(t * 36) * 3,
        dy: 4 * Math.abs(Math.sin(t * 5)),
        rot: Math.sin(t * 36) * 0.05,
        frame,
      };
    case "deckhand": {
      // trips: pitches forward, then flops and wobbles
      const fall = easeOut(Math.min(1, t / 0.3));
      return {
        dx: 10 * fall,
        dy: 8 * fall,
        rot: 0.45 * fall + Math.sin(t * 12) * 0.05 * fall,
        frame,
      };
    }
    case "astronaut":
      return {
        dx: 0,
        dy: -28,
        rot: Math.PI * easeOut(Math.min(1, t / 0.55)) + Math.sin(t * 14) * 0.1,
        frame,
      };
    case "samurai": {
      // trips: tilts, then drops to sitting
      const fall = Math.min(1, t / 0.35);
      return {
        dx: -6 * fall,
        dy: 0,
        rot: -0.35 * Math.sin(fall * Math.PI),
        frame,
      };
    }
    case "plague-doctor":
      return {
        dx: Math.sin(t * 40) * 3,
        dy: 0,
        rot: Math.sin(t * 40) * 0.04,
        frame,
      };
    default:
      return { dx: 0, dy: 0, rot: Math.sin(t * 7) * 0.12, frame };
  }
}
