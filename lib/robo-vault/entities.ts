// Robo Vault sprites and draw helpers. Sprites are pixel-art row tables (one char per
// pixel, '.' = transparent). Pure data and functions: the engine owns the caches.

export type SpriteRows = readonly string[];
export type SpritePalette = Record<string, string>;

const HERO_BODY: SpriteRows = [
  "...dddd...",
  "..dccccd..",
  ".dcckwwcd.",
  ".dcckkkcd.",
  "..dccccd..",
  "..ccddcc..",
  ".dccccccyy",
  ".dcdccccyy",
  "..ccccccc.",
  "..cddddcc.",
  "..cc..cc..",
];
const HERO_LEGS: Record<"idle" | "run1" | "run2" | "jump", SpriteRows> = {
  idle: ["..dc..cd..", "..dc..cd..", ".ddd..ddd."],
  run1: ["..dc..cd..", ".dc....cd.", ".dd....dd."],
  run2: ["..dcc.cd..", "...dc.cd..", "..ddd.ddd."],
  jump: [".dc....cd.", "dc......cd", "dd......dd"],
};

export type HeroLegs = keyof typeof HERO_LEGS;
/** `up-*` frames raise the buster arm: the hero looks up while aiming up. */
export type HeroFrame = HeroLegs | "crouch" | `up-${HeroLegs}`;
export const HERO_FRAMES: HeroFrame[] = [
  "idle", "run1", "run2", "jump", "crouch",
  "up-idle", "up-run1", "up-run2", "up-jump",
];
export const HERO_PALETTE: SpritePalette = {
  c: "#00f5ff",
  d: "#0a6aa8",
  w: "#ffffff",
  k: "#050c0a",
  y: "#f5ff00",
};
// Upper body with the buster arm raised along the head (11 rows, same size as HERO_BODY).
const HERO_BODY_UP: SpriteRows = [
  "...dddd.yy",
  "..dccccdyy",
  ".dcckwwcdy",
  ".dcckkkcdy",
  "..dccccdc.",
  "..ccddccc.",
  ".dcccccccc",
  ".dcdcccccc",
  "..ccccccc.",
  "..cddddcc.",
  "..cc..cc..",
];

export function heroRows(frame: HeroFrame): SpriteRows {
  if (frame.startsWith("up-")) {
    return [...HERO_BODY_UP, ...HERO_LEGS[frame.slice(3) as HeroLegs]];
  }
  // Crouch: head, torso and buster arm (8 rows) over folded legs = 9 rows.
  if (frame === "crouch") return [...HERO_BODY.slice(0, 8), "..dd..dd.."];
  return [...HERO_BODY, ...HERO_LEGS[frame as HeroLegs]];
}

export type EnemyKind = "walker" | "hopper" | "turret" | "flyer";

export const WALKER_A: SpriteRows = [
  "..aaaaaa..",
  ".aaaaaaaa.",
  "aabwaawbaa",
  "aaaaaaaaaa",
  ".aaaaaaaa.",
  ".kk.kk.kk.",
  "kk..kk..kk",
  "k...kk...k",
];
export const WALKER_B: SpriteRows = [
  "..aaaaaa..",
  ".aaaaaaaa.",
  "aabwaawbaa",
  "aaaaaaaaaa",
  ".aaaaaaaa.",
  "..kk.kk...",
  ".kk..kk.kk",
  "kk...k...k",
];
export const HOPPER_UP: SpriteRows = [
  "..aaaaaa..",
  ".aabaabaa.",
  ".awkaakwa.",
  ".aaaaaaaa.",
  "..aaaaaa..",
  "..k....k..",
  ".k......k.",
  ".k......k.",
  "kk......kk",
];
export const HOPPER_DOWN: SpriteRows = [
  "..aaaaaa..",
  ".aabaabaa.",
  ".awkaakwa.",
  ".aaaaaaaa.",
  "..aaaaaa..",
  "..bbbbbb..",
  ".kk....kk.",
  "kkk....kkk",
];
export const TURRET: SpriteRows = [
  "....kkkk....",
  "...kaaaak...",
  "..kaabbaak..",
  "kkkkabwbakkk",
  "kkkkkaakkkkk",
  "..kaaaaaak..",
  ".kaaaaaaaak.",
  ".kaabaabaak.",
  "kkkkkkkkkkkk",
  "kkkkkkkkkkkk",
];
export const FLYER_A: SpriteRows = [
  "b........b",
  "bb..aa..bb",
  ".bbaaaabb.",
  "..aawwaa..",
  "...aaaa...",
  "....kk....",
];
export const FLYER_B: SpriteRows = [
  "..........",
  ".b..aa..b.",
  "bbbaaaabbb",
  ".baawwaab.",
  "...aaaa...",
  "....kk....",
];
export const ENEMY_SIZE: Record<EnemyKind, { w: number; h: number; scale: number }> = {
  walker: { w: 30, h: 24, scale: 3 },
  hopper: { w: 24, h: 27, scale: 3 },
  turret: { w: 36, h: 30, scale: 3 },
  flyer: { w: 30, h: 18, scale: 3 },
};

// Masters: 5 head rows (per Master) + 11 shared body rows = 14 x 16 pixels, drawn at x3.
const MASTER_BODY: SpriteRows = [
  "..kaaaaaaaak..",
  ".kabbaaaabbak.",
  "kkabbaaaabbakk",
  "kkaaaaaaaaaakk",
  "kk.aaaaaaaa.kk",
  "...aaaaaaaa...",
  "...aabbbbaa...",
  "...aaaaaaaa...",
  "..kaaa..aaak..",
  "..kaa....aak..",
  ".kkkk....kkkk.",
];
const MASTER_HEAD: Record<string, SpriteRows> = {
  frostbyte: [
    "..b...bb...b..",
    "..bb.bbbb.bb..",
    "...kaaaaaak...",
    "..kawwaawwak..",
    "..kaaaaaaaak..",
  ],
  embercore: [
    "......bb......",
    "....bbbbbb....",
    "...bbbbbbbb...",
    "..kawwaawwak..",
    "..kaaaaaaaak..",
  ],
  galeforce: [
    "b............b",
    "bb..........bb",
    "bbb.kaaaak.bbb",
    "..kawwaawwak..",
    "..kaaaaaaaak..",
  ],
  tidebreaker: [
    "....bbbbbb....",
    "...bwwwwwwb...",
    "..kbwaaaawbk..",
    "..kawwaawwak..",
    "..kaaaaaaaak..",
  ],
};
export function masterRows(id: string): SpriteRows {
  return [...(MASTER_HEAD[id] ?? MASTER_HEAD.frostbyte), ...MASTER_BODY];
}
export const MASTER_PALETTES: Record<string, SpritePalette> = {
  frostbyte: { a: "#58c8f0", b: "#e8fbff", k: "#0e3a5a", w: "#ffffff" },
  embercore: { a: "#d8481c", b: "#ffd24a", k: "#3a0e08", w: "#fff2c0" },
  galeforce: { a: "#4cc47a", b: "#f2fff0", k: "#0e3a22", w: "#ffffff" },
  tidebreaker: { a: "#2a78d8", b: "#9fe8ff", k: "#0a1e48", w: "#ffffff" },
};
export const MASTER_SIZE = { w: 42, h: 48, scale: 3 };

export const SAM_SAUCER: SpriteRows = [
  "........kkkkkkkk........",
  ".......kwwwwwwwwk.......",
  "......kwrrwwwwrrwk......",
  ".....kwwwwwwwwwwwwk.....",
  "..kkaaaaaaaaaaaaaaaakk..",
  "kaabbaabbaabbaabbaabbaak",
  "kaaaaaaaaaaaaaaaaaaaaaak",
  ".kkkaaaaaaaaaaaaaaaakkk.",
  "...kkkkkkkkkkkkkkkkkkkk.",
  ".....yy....yy....yy.....",
];
export const SAM_SAUCER_SIZE = { w: 72, h: 30, scale: 3 };
export const SAM_MECH: SpriteRows = [
  "....kkkkkkkk....",
  "...kwwwwwwwwk...",
  "...kwrrwwrrwk...",
  "...kwwwwwwwwk...",
  "....kkkkkkkk....",
  ".kk.aaaaaaaa.kk.",
  "kaakabbbbbbakaak",
  "kaakaaaaaaaakaak",
  "kaak.aaaaaa.kaak",
  ".kk..aabbaa..kk.",
  "....aaaaaaaa....",
  "....aaaaaaaa....",
  "...kaaa..aaak...",
  "...kaaa..aaak...",
  "...kaaa..aaak...",
  "..kkaaa..aaakk..",
  ".kkkkkk..kkkkkk.",
];
export const SAM_MECH_SIZE = { w: 48, h: 51, scale: 3 };
export const SAM_PALETTE: SpritePalette = {
  a: "#b04ad0",
  b: "#f5ff00",
  k: "#2a0a38",
  w: "#f6e8ff",
  r: "#ff3b3b",
  y: "#ffd24a",
};

export function enemyPalette(accent: string, accent2: string): SpritePalette {
  return { a: accent, b: accent2, k: "#0c1418", w: "#ffffff" };
}

/** Longest row width and row count; used to validate and scale a sprite. */
export function spriteSize(rows: SpriteRows): { w: number; h: number } {
  return { w: Math.max(...rows.map((r) => r.length)), h: rows.length };
}

/** Draws a sprite into a fresh canvas, 1 canvas pixel per sprite pixel. */
export function buildSprite(
  rows: SpriteRows,
  palette: SpritePalette,
): HTMLCanvasElement {
  const { w, h } = spriteSize(rows);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      const color = palette[rows[y][x]];
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  return canvas;
}

/** Draws a prebuilt sprite with its top-left at (x, y), scaled, optionally mirrored. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  x: number,
  y: number,
  scale: number,
  flip = false,
): void {
  const w = sprite.width * scale;
  const h = sprite.height * scale;
  if (flip) {
    ctx.save();
    ctx.translate(Math.round(x + w), Math.round(y));
    ctx.scale(-1, 1);
    ctx.drawImage(sprite, 0, 0, w, h);
    ctx.restore();
  } else {
    ctx.drawImage(sprite, Math.round(x), Math.round(y), w, h);
  }
}
