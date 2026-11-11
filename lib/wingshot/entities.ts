// Target sprites: 16-wide run tables (1 char per pixel, drawn at x4), frame A per scene and kind.
// Frame B (the flap) is derived: wings move down 2 rows ("wings") or the tail swings ("tail").

import {
  SPRITE_SCALE,
  type Palette,
  type SceneId,
  type SpriteChar,
  type TargetKind,
} from "./constants";

export interface Target {
  id: number;
  kind: TargetKind;
  /** Counts toward the 10 targets of the round (a decoy does not). */
  quota: boolean;
  /** Index of the tick it fills in the quota row (quota targets only). */
  slot: number;
  state: "fly" | "fall" | "escape" | "gone";
  /** Integrated position before the wobble. */
  bx: number;
  by: number;
  vx: number;
  vy: number;
  /** Seconds since launch (engine clock). */
  age: number;
  /** Seconds left in the current fall or escape. */
  timer: number;
  phase: number; // wobble phase, rad
  flightTime: number; // s
  /** Drawn position (base plus wobble), updated every step. */
  x: number;
  y: number;
  spin: number; // rad, while falling
  flip: boolean; // true = faces left
}

/** "spin" = frame B is the sprite turned 180 degrees (tumbling), "mirror" = flipped left to right. */
type Flap = "wings" | "tail" | "spin" | "mirror";

interface SpriteDef {
  flap: Flap;
  rows: string[];
}

const SPRITES: Record<SceneId, Record<TargetKind, SpriteDef>> = {
  // leaping minnow, darting trout, golden carp, old boot
  lake: {
    common: {
      flap: "tail",
      rows: [
        "................",
        ".......oooo.....",
        "..oo.oobbaaoo...",
        ".ooooaabbaaaaeo.",
        ".oaaaaaaaaaaaoo.",
        "..oo.occccccoo..",
        "......oooooo....",
      ],
    },
    quick: {
      flap: "tail",
      rows: [
        "................",
        "....oooooooo....",
        "oo.obbbbaaaaoo..",
        "oooaaaaaaaaaaeo.",
        "oooorrrrrrrrraoo",
        "oo.occccccccoo..",
        "....oooooooo....",
      ],
    },
    rare: {
      flap: "tail",
      rows: [
        "................",
        "......oooooo....",
        "...oooggggggoo..",
        "o.ooggbbggggggo.",
        "ooogggggggggggeo",
        "o.ooggccggggggo.",
        "...oooggggggoo..",
        "......oooooo....",
      ],
    },
    decoy: {
      flap: "tail",
      rows: [
        "................",
        "....oooo........",
        "....odddo.......",
        "....odddo.......",
        "....odddoo......",
        "....odddddoooo..",
        "...oddddddddddo.",
        "...oddddddddddo.",
        "...occcccccccco.",
        "...oooooooooooo.",
      ],
    },
  },
  // moth, bat, glow firefly, barn owl
  moors: {
    common: {
      flap: "wings",
      rows: [
        "................",
        "oo............oo",
        "obbo..o..o..obbo",
        "obbbo.oaao.obbbo",
        ".obbboaaaaobbbo.",
        "..obbbaaaabbbo..",
        "...oobaccabboo..",
        ".....oaaaao.....",
        "......o..o......",
      ],
    },
    quick: {
      flap: "wings",
      rows: [
        "................",
        "o.o..........o.o",
        "oao.o......o.oao",
        "oddooo.oo.oooddo",
        ".oddddoddodddddo",
        "..oodddaadddoo..",
        "....oodddddoo...",
        "......ooeo......",
      ],
    },
    rare: {
      flap: "wings",
      rows: [
        "................",
        "..oo........oo..",
        ".obbo..gg..obbo.",
        ".obbbo.gg.obbbo.",
        "..obbboggobbbo..",
        "....ooggggoo....",
        ".....oggggo.....",
        "......gggg......",
        ".......gg.......",
      ],
    },
    decoy: {
      flap: "wings",
      rows: [
        "................",
        "..o..oooooo..o..",
        "..ooobbbbbbooo..",
        "..obbeeooeebbo..",
        "..obbeeooeebbo..",
        "..obbbbccbbbbo..",
        "...obbbccbbbo...",
        "...oobbbbbboo...",
        ".....oo..oo.....",
      ],
    },
  },
  // alien pigeon, swift drone-bird, golden pigeon, satellite
  orbit: {
    common: {
      flap: "wings",
      rows: [
        "................",
        "oo............oo",
        "obo....c.....obo",
        "obbo..oaao..obbo",
        ".obbooaaaaoobbo.",
        "..obbaaaaaabbo..",
        "...ooaaeaaaoo...",
        "....oaaaaaao....",
        ".....oo..oo.....",
      ],
    },
    quick: {
      flap: "wings",
      rows: [
        "................",
        "oo............oo",
        "oco..........oco",
        ".occo.oooo.occo.",
        "..occoddddocco..",
        "...oodrddrdoo...",
        "....oddddddo....",
        ".....oddddo.....",
        "......o..o......",
      ],
    },
    rare: {
      flap: "wings",
      rows: [
        "................",
        "oo............oo",
        "obo....c.....obo",
        "obbo..oggo..obbo",
        ".obbooggggoobbo.",
        "..obbggggggbbo..",
        "...oogggeggoo...",
        "....ogggggoo....",
        ".....oo..oo.....",
      ],
    },
    decoy: {
      flap: "wings",
      rows: [
        "................",
        "................",
        "obbbo..oo..obbbo",
        "obbbo.oddo.obbbo",
        "obbbooddddoobbbo",
        "obbbo.oddo.obbbo",
        "obbbo..oo..obbbo",
        ".......cc.......",
        "......c..c......",
      ],
    },
  },
  // paper crane, paper swallow, gold crane, paper lantern
  origami: {
    common: {
      flap: "wings",
      rows: [
        "................",
        "oo............oo",
        "obbo........obbo",
        ".obbbo..oo.obbbo",
        "..obbboaaobbbo..",
        "...ooobaaboo....",
        "......oaaaoo..oo",
        ".......oaaaaaoo.",
        "........oooo..o.",
      ],
    },
    quick: {
      flap: "wings",
      rows: [
        "................",
        "o..............o",
        "oo............oo",
        "obo....oo....obo",
        ".obbo.occoobbo..",
        "..obbboccobbo...",
        "....ooaaaaoo....",
        "......oaao......",
        "......o..o......",
      ],
    },
    rare: {
      flap: "wings",
      rows: [
        "................",
        "oo............oo",
        "obbo........obbo",
        ".obbbo..oo.obbbo",
        "..obbbogggobbo..",
        "...ooobggboo....",
        "......ogggoo..oo",
        ".......ogggggoo.",
        "........oooo..o.",
      ],
    },
    decoy: {
      flap: "wings",
      rows: [
        "................",
        ".......oo.......",
        "......orro......",
        ".....orrrrro....",
        "....orrccrrro...",
        "....orrccrrro...",
        ".....orrrrro....",
        "......orro......",
        ".......oo.......",
        "......o..o......",
      ],
    },
  },
  // tumbling rock, rock shard, gold nugget, old pickaxe
  mine: {
    common: {
      flap: "spin",
      rows: [
        "................",
        "....oooooo......",
        "...obbbbaaoo....",
        "..obbbaaaaaaoo..",
        ".obbaaaaaadaaao.",
        ".obaaaaaaaaddao.",
        "..oaaaaaaadddo..",
        "..ooaaaaaddoo...",
        "....oooooooo....",
      ],
    },
    quick: {
      flap: "spin",
      rows: [
        "................",
        "o...........oo..",
        ".oo.......ooaoo.",
        "..ooo...oobbaao.",
        "o.oaaooobbaaaaao",
        "..oooaaaaaaaddoo",
        "o...ooaaaaddoo..",
        "......oooooo....",
      ],
    },
    rare: {
      flap: "spin",
      rows: [
        "................",
        ".....ooooo......",
        "...oogggggoo....",
        "..ogggeegggoo...",
        ".ogggeeggggggo..",
        ".ogggggggggddo..",
        "..oggggggdddoo..",
        "...oogggdddoo...",
        ".....ooooooo....",
      ],
    },
    decoy: {
      flap: "spin",
      rows: [
        "................",
        "...oooooooooo...",
        ".oorrrrrrrrrroo.",
        "oorrooooddooorro",
        "oo...odddo...oo.",
        ".....odddo......",
        ".....odddo......",
        ".....odddo......",
        ".....odddo......",
        "......ooo.......",
      ],
    },
  },
  // musical note, star spark, gold note, tin can
  cartoon: {
    common: {
      flap: "mirror",
      rows: [
        "................",
        ".......ooo......",
        ".......oaaoo....",
        ".......oa.aaoo..",
        ".......oa...aoo.",
        ".......oa....ao.",
        ".......oa.......",
        "..oooo.oa.......",
        ".oaaaaooa.......",
        ".oabaaaoa.......",
        ".oaaaaaao.......",
        "..oooooo........",
      ],
    },
    quick: {
      flap: "mirror",
      rows: [
        "................",
        ".......oo.......",
        ".......obo......",
        "o.....obbo......",
        ".o..oooobboooo..",
        "..oobbbbbcbbbbo.",
        ".o..oooobboooo..",
        "o.....obbo......",
        ".......obo......",
        ".......oo.......",
      ],
    },
    rare: {
      flap: "mirror",
      rows: [
        "................",
        ".......ooo......",
        ".......oggoo....",
        ".......og.ggoo..",
        ".......og...goo.",
        ".......og....go.",
        ".......og.......",
        "..oooo.og.......",
        ".ogggggoog......",
        ".ogeggggog......",
        ".ogggggggo......",
        "..oooooooo......",
      ],
    },
    decoy: {
      flap: "mirror",
      rows: [
        "................",
        "...oooooooooo...",
        "...obbbbbbbbo...",
        "...oooooooooo...",
        "...occccccccco..",
        "...oceeeeeeeco..",
        "...oceooeooeco..",
        "...oceeeeeeeco..",
        "...occccccccco..",
        "...oooooooooo...",
      ],
    },
  },
};

const W = 16;
const pad = (row: string): string =>
  row.length >= W ? row.slice(0, W) : row + ".".repeat(W - row.length);

/** Frame B: wings drop 2 rows, or the tail columns swing 1 row. */
function deriveFrameB(def: SpriteDef): string[] {
  const rows = def.rows.map(pad);
  if (def.flap === "mirror")
    return rows.map((r) => r.split("").reverse().join(""));
  if (def.flap === "spin") {
    return rows
      .slice()
      .reverse()
      .map((r) => r.split("").reverse().join(""));
  }
  if (def.flap === "tail") {
    const grid = ["", ...rows, ""].map((r) => r.split(""));
    const out = grid.map((r) => r.slice());
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < 4; c++) out[r][c] = r > 0 ? grid[r - 1][c] : ".";
    }
    return out.map((r) => r.join(""));
  }
  const mid = Math.max(3, Math.floor(rows.length / 2));
  const shift = 2;
  const out = rows.map((r, i) => (i < mid ? ".".repeat(W) : r).split(""));
  for (let i = 0; i < mid; i++) {
    const j = i + shift;
    for (let c = 0; c < W; c++) {
      const ch = rows[i][c];
      if (ch === ".") continue;
      if (j < mid || out[j][c] === ".") out[j][c] = ch;
    }
  }
  return out.map((r) => r.join(""));
}

export function spriteFrames(scene: SceneId, kind: TargetKind): string[][] {
  const def = SPRITES[scene][kind];
  return [def.rows.map(pad), deriveFrameB(def)];
}

/** Rasterizes pixel rows into a canvas, SPRITE_SCALE px per pixel, centered in 16x16 cells. */
export function rasterize(
  rows: string[],
  palette: Palette,
  scale = SPRITE_SCALE,
  size = 16,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size * scale;
  canvas.height = size * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const top = Math.max(0, Math.floor((size - rows.length) / 2));
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === ".") continue;
      const color = palette.p[ch as SpriteChar];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, (top + y) * scale, scale, scale);
    }
  }
  return canvas;
}

export type SpriteSet = Record<
  TargetKind,
  [HTMLCanvasElement, HTMLCanvasElement]
>;

export function buildSprites(scene: SceneId, palette: Palette): SpriteSet {
  const set = {} as SpriteSet;
  for (const kind of ["common", "quick", "rare", "decoy"] as const) {
    const [a, b] = spriteFrames(scene, kind);
    set[kind] = [rasterize(a, palette), rasterize(b, palette)];
  }
  return set;
}

export function drawTarget(
  ctx: CanvasRenderingContext2D,
  sprites: SpriteSet,
  t: Target,
  clock: number,
): void {
  const frame = Math.floor((clock + t.phase) * 8) % 2 === 0 ? 0 : 1;
  const img = sprites[t.kind][t.state === "fall" ? 1 : frame];
  ctx.save();
  ctx.translate(Math.round(t.x), Math.round(t.y));
  if (t.spin) ctx.rotate(t.spin);
  if (t.flip) ctx.scale(-1, 1);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  ctx.restore();
}
