// Marcy the Vampire Hunter entities: pixel run tables (1 char per pixel) and enemy / boss tables.
// Framework-free: no react or next imports, no module-level game state.
import type { Hero } from "./password";

export type SpriteRows = readonly string[];
export type SpritePalette = Record<string, string>;

export function spriteSize(rows: SpriteRows): { w: number; h: number } {
  let w = 0;
  for (const r of rows) w = Math.max(w, r.length);
  return { w, h: rows.length };
}

export function buildSprite(rows: SpriteRows, palette: SpritePalette): HTMLCanvasElement {
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

// ---------------------------------------------------------------- heroes (10 x 20, drawn at x3)

export type HeroFrame = "idle" | "runA" | "runB" | "air" | "crouch";

const HERO_TOP = [
  "...hhhh...",
  "..hhhhhh..",
  "..hhssss..",
  "..hssesh..",
  "...ssss...",
  "..cccccc..",
  ".ccCccCcc.",
  ".ccCccCcc.",
  ".sccccccs.",
  ".dccccccd.",
  "..cccccc..",
  "..dddddd..",
  "..cccccc..",
  "..ccccccc.",
];

const HERO_LEGS: Record<Exclude<HeroFrame, "crouch">, string[]> = {
  idle: ["..cc..cc..", "..cc..cc..", "..bb..bb..", "..bb..bb..", ".bbb..bbb.", ".bbb..bbb."],
  runA: ["...cc.cc..", "..cc...cc.", "..bb...bb.", ".bb.....bb", ".bbb....bb", ".........."],
  runB: ["..cc.cc...", ".cc...cc..", ".bb...bb..", "bb.....bb.", "bb....bbb.", ".........."],
  air: ["..cc..cc..", "..bb..bb..", ".bbb..bbb.", "..........", "..........", ".........."],
};

const CROUCH_TAIL = [".dccccccd.", "..dddddd..", "..bbbbbb..", ".bbb..bbb."];

/** Rows of a hero frame. Marcy gets long hair; Frankford a scarf. */
export function heroRows(hero: Hero, frame: HeroFrame): string[] {
  const top = HERO_TOP.slice();
  if (hero === "marcy") {
    top[3] = ".hhssesh..";
    top[4] = ".hhssss...";
    top[5] = ".hhcccccc.";
    top[6] = ".hcCccCcc.";  } else {
    top[5] = "..aaaaaa..";
    top[6] = ".ccaccCcc.";
  }
  if (frame === "crouch") return [...top.slice(0, 9), ...CROUCH_TAIL];
  return [...top, ...HERO_LEGS[frame]];
}

export const HERO_PALETTES: Record<Hero, SpritePalette> = {
  marcy: { h: "#2a1330", s: "#f0d4c4", c: "#1f7a3a", C: "#46b868", d: "#0e3a1c", b: "#1a1020", e: "#1a1020", a: "#46b868" },
  frankford: { h: "#d8dce8", s: "#e8c8b0", c: "#2f4a78", C: "#5a7ab8", d: "#14223c", b: "#12121c", e: "#12121c", a: "#c9a45c" },
};

// ---------------------------------------------------------------- enemy and boss body plans

export const PLAN_WALKER_A: SpriteRows = [
  "...aaaa.....",
  "..aaaaaa....",
  "..aeaaea....",
  "..aaaaaa....",
  "...aaaa.....",
  "..bbbbbb.b..",
  ".bbbbbbbbb..",
  ".bb.bbbb.bb.",
  "...bbbbbb...",
  "...bbbbbb...",
  "...bb..bb...",
  "...bb..bb...",
  "..kkk..kkk..",
  "..kkk..kkk..",
];
export const PLAN_WALKER_B: SpriteRows = [
  "...aaaa.....",
  "..aaaaaa....",
  "..aeaaea....",
  "..aaaaaa....",
  "...aaaa.....",
  "..bbbbbb.b..",
  ".bbbbbbbbb..",
  ".bb.bbbb.bb.",
  "...bbbbbb...",
  "...bbbbbb...",
  "..bb....bb..",
  ".bb......bb.",
  ".kk......kk.",
  "kkk......kkk",
];
export const PLAN_FLYER_A: SpriteRows = [
  "b..........b",
  "bb...aa...bb",
  "bbb.aaaa.bbb",
  "bbbbaeeabbbb",
  ".bbbbaabbbb.",
  "..bbbbbbbb..",
  "...b....b...",
  "............",
];
export const PLAN_FLYER_B: SpriteRows = [
  "............",
  "...b....b...",
  "..bbbaabbb..",
  ".bbbaeeabbb.",
  "bbbbbaabbbbb",
  "bbb.aaaa.bbb",
  "bb...aa...bb",
  "b..........b",
];
export const PLAN_CRAWLER_A: SpriteRows = [
  "..........aa..",
  "....bbbb.aaea.",
  "..bbbbbbbaaaa.",
  ".bbbbbbbbbbaa.",
  "bbbbbbbbbbbb..",
  ".kk.kk..kk.kk.",
  "kk.kk....kk.kk",
];
export const PLAN_CRAWLER_B: SpriteRows = [
  "..........aa..",
  "....bbbb.aaea.",
  "..bbbbbbbaaaa.",
  ".bbbbbbbbbbaa.",
  "bbbbbbbbbbbb..",
  "..kk.kk.kk.kk.",
  "kk.kk...kk.kk.",
];
export const PLAN_SHOOTER_A: SpriteRows = [
  "...aaaa...",
  "..aaaaaa..",
  "..aeaaea..",
  "..aaaaaa..",
  "...bbbb...",
  "..bbbbbbb.",
  ".bbbbbbbbb",
  ".bbbbbbbbb",
  ".bbbbbbbb.",
  ".bbbbbbbb.",
  "..kkkkkk..",
  "..kkkkkk..",
];
export const PLAN_SHOOTER_B: SpriteRows = [
  "...aaaa...",
  "..aaaaaa..",
  "..aeaaea..",
  "..aaaaaa..",
  "...bbbb...",
  "b.bbbbbb.b",
  "bb.bbbb.bb",
  ".bbbbbbbbb",
  ".bbbbbbbb.",
  ".bbbbbbbb.",
  "..kkkkkk..",
  "..kkkkkk..",
];
export const PLAN_JUMPER: SpriteRows = [
  "....aaaa..",
  "...aaaaaa.",
  "...aeaaea.",
  "...aaaaaa.",
  "..bbbbbb..",
  ".bbbbbbbb.",
  "bbbbbbbbb.",
  "bb.bbbb.bb",
  "bb.bbbb.bb",
  ".k......k.",
  ".k......k.",
  "kk......kk",
];
export const PLAN_MEDUSA_A: SpriteRows = [
  ".b..b.bb.b..b.",
  "b.b.bbaabb.b.b",
  ".bbbaaaaaabbb.",
  "b.baaaaaaaab.b",
  "..baaeaaeaab..",
  "..baaaaaaaab..",
  "b.baaakkaaab.b",
  ".b.baaaaaab.b.",
  "b..baaaaaab..b",
  "....baaaab....",
  ".....bbbb.....",
];
export const PLAN_MEDUSA_B: SpriteRows = [
  "b.b..bbb..b.b.",
  ".b.bbbaabbb.b.",
  "b.bbaaaaaabb.b",
  ".b.aaaaaaaa.b.",
  "..baaeaaeaab..",
  "..baaaaaaaab..",
  "b.baaakkaaab.b",
  ".b.baaaaaab.b.",
  "b..baaaaaab..b",
  "....baaaab....",
  ".....bbbb.....",
];
export const PLAN_CHARGER: SpriteRows = [
  "....kkkkk.....",
  "...kaaaaak....",
  "...kaeaaak....",
  "...kaaaaak....",
  "....kkkkk.....",
  "..bbbbbbbbbb..",
  ".bbbbbbbbbbbb.",
  "bbbbbbbbbbbbb.",
  "bbb.bbbbbb.bbb",
  "bb..bbbbbb..bb",
  "....bbbbbb....",
  "....bb..bb....",
  "....bb..bb....",
  "...kkk..kkk...",
  "...kkk..kkk...",
  "..kkkk..kkkk..",
];

export const PLAN_BOSS_HUMANOID: SpriteRows = [
  "....aaaaaa....",
  "...aaaaaaaa...",
  "...aeaaaaea...",
  "...aaaaaaaa...",
  "....aaaaaa....",
  "..bbbbbbbbbb..",
  ".bbbbbbbbbbbb.",
  "bbbcbbbbbbcbbb",
  "bb.bbbbbbbb.bb",
  "bb.bbbbbbbb.bb",
  "...bbbbbbbb...",
  "...bbbbbbbb...",
  "...bbbddbbb...",
  "..bbbb..bbbb..",
  "..bbbb..bbbb..",
  "..bbbb..bbbb..",
  "..kkkk..kkkk..",
  "..kkkk..kkkk..",
  ".kkkkk..kkkkk.",
  ".kkkkk..kkkkk.",
];
export const PLAN_BOSS_COLOSSUS: SpriteRows = [
  "....aaaaaaaaaa....",
  "...aaaaaaaaaaaa...",
  "...aaeeaaaaeeaa...",
  "...aaaaaaaaaaaa...",
  "....aakkkkkkaa....",
  "..bbbbbbbbbbbbbb..",
  ".bbbbbbbbbbbbbbbb.",
  "bbbbbcbbbbbbcbbbbb",
  "bbbb.bbbbbbbb.bbbb",
  "bbb..bbbbbbbb..bbb",
  "aaa..bbbbbbbb..aaa",
  "aaa..bbbbbbbb..aaa",
  ".....bbbbbbbb.....",
  ".....bbbbbbbb.....",
  "...bbbb....bbbb...",
  "...bbbb....bbbb...",
  "...bbbb....bbbb...",
  "..kkkkk....kkkkk..",
  "..kkkkk....kkkkk..",
  "..kkkkk....kkkkk..",
];
export const PLAN_BOSS_FLOATER: SpriteRows = [
  "......aaaa......",
  ".....aaaaaa.....",
  ".....aeaaea.....",
  ".....aaaaaa.....",
  "....bbbbbbbb....",
  "..bbbbbbbbbbbb..",
  ".bbbbcbbbbcbbbb.",
  "bbbb.bbbbbb.bbbb",
  "bbb..bbbbbb..bbb",
  "bb...bbbbbb...bb",
  "b....bbbbbb....b",
  ".....bbbbbb.....",
  "......bbbb......",
  ".....bb..bb.....",
  "....bb....bb....",
  "...bb......bb...",
];

/** Blue flame for the filled cells of a password grid: two frames, drawn scaled to the cell. */
export const FLAME_A: SpriteRows = [
  "....o.....",
  "...oo.o...",
  "...ooooo..",
  "..ooommoo.",
  "..oommmmo.",
  ".oommiimmo",
  ".oommiimmo",
  ".oommmmmmo",
  "..ooommmo.",
  "...oooooo.",
];
export const FLAME_B: SpriteRows = [
  ".....o....",
  "...o.oo...",
  "..ooooo...",
  ".ooommooo.",
  ".oommmmmo.",
  ".oommiimmo",
  ".oommiimmo",
  ".oommmmmmo",
  "..ooommmo.",
  "...oooooo.",
];
export const FLAME_PALETTE: SpritePalette = { o: "#1e5bff", m: "#4aa8ff", i: "#d4f0ff" };

export const COIN_ROWS: SpriteRows = [
  "..wwww..",
  ".wgsssw.",
  "wskssksw",
  "wskkkksw",
  "wsskkssw",
  "wssskssw",
  ".wssssw.",
  "..wwww..",
];
export const COIN_PALETTE: SpritePalette = { w: "#e8edf5", s: "#b8c0d0", k: "#3a3050", g: "#ffffff" };

// ---------------------------------------------------------------- enemies

export type EnemyAI = "walker" | "flyer" | "shooter" | "jumper" | "charger" | "crawler";
export type ShotKind = "none" | "bolt" | "spread3" | "spread5" | "lob" | "homing" | "zone";
export type PlanId = "walker" | "flyer" | "crawler" | "shooter" | "jumper" | "charger" | "medusa";

export interface EnemyDef {
  id: string;
  name: string;
  ai: EnemyAI;
  plan: PlanId;
  hp: number;
  dmg: number;
  xp: number;
  speed: number;
  /** Colors: a = head / accent, b = body, k = feet / outline. */
  a: string;
  b: string;
  k: string;
  shot: ShotKind;
  /** Flyers: follows the hero. */
  homing?: boolean;
  /** Flyers: dives at the hero now and then. */
  dive?: boolean;
  /** Flyers: flies straight and swings up and down in a big sine wave (Medusa Head). */
  wave?: boolean;
  /** Spawns two small copies when killed. */
  split?: boolean;
  /** Turned castle kind. */
  turned?: boolean;
}

const E = (
  id: string,
  name: string,
  ai: EnemyAI,
  plan: PlanId,
  hp: number,
  dmg: number,
  xp: number,
  speed: number,
  a: string,
  b: string,
  k: string,
  extra: Partial<EnemyDef> = {},
): EnemyDef => ({ id, name, ai, plan, hp, dmg, xp, speed, a, b, k, shot: "none", ...extra });

export const ENEMIES: Record<string, EnemyDef> = {};
const reg = (d: EnemyDef) => {
  ENEMIES[d.id] = d;
};

// Main castle (18 kinds)
reg(E("skeleton", "Skeleton Knight", "walker", "walker", 14, 10, 8, 50, "#e8e0c8", "#8a8470", "#3a3628"));
reg(E("bat", "Bat Swarm", "flyer", "flyer", 6, 8, 6, 80, "#c8a0d8", "#5a3a6a", "#2a1a3a"));
reg(E("rat", "Cellar Rat", "crawler", "crawler", 8, 8, 6, 95, "#d8b8a0", "#6a5648", "#2a2018"));
reg(E("cultist", "Ash Cultist", "shooter", "shooter", 18, 14, 16, 0, "#e8c8a8", "#7a2a1c", "#2a1008", { shot: "bolt" }));
reg(E("ghoul", "Grave Ghoul", "jumper", "jumper", 26, 16, 18, 60, "#a8c8a0", "#586848", "#242c1c"));
reg(E("boneknight", "Bone Armor", "charger", "charger", 40, 22, 28, 55, "#d8d0b0", "#7a7658", "#302c1c"));
reg(E("archer", "Skeleton Archer", "shooter", "shooter", 22, 16, 20, 0, "#e8e0c8", "#6a6048", "#2a2418", { shot: "bolt" }));
reg(E("drowned", "Drowned Soul", "walker", "walker", 46, 22, 26, 42, "#88c8c0", "#386870", "#10282c"));
reg(E("leech", "Cistern Leech", "jumper", "jumper", 32, 20, 24, 70, "#d86078", "#782038", "#300812"));
reg(E("medusa", "Medusa Head", "flyer", "medusa", 24, 18, 14, 95, "#a6e88a", "#3a8a4a", "#10301a", { wave: true }));
reg(E("wraith", "Wraith", "flyer", "flyer", 30, 26, 32, 60, "#d0e0ff", "#5870a8", "#202c50", { homing: true }));
reg(E("gearbot", "Gear Sentinel", "walker", "walker", 56, 28, 36, 45, "#e0c070", "#8a6a28", "#32240c"));
reg(E("sentry", "Brass Sentry", "shooter", "shooter", 48, 24, 40, 0, "#f0d890", "#8a7030", "#2c2008", { shot: "spread3" }));
reg(E("bookworm", "Bookworm", "crawler", "crawler", 40, 22, 30, 70, "#e8d8b0", "#7a4a8a", "#2a1430"));
reg(E("tome", "Whispering Tome", "flyer", "flyer", 34, 26, 36, 58, "#f0e0c0", "#7a3a8a", "#2a1034", { homing: true }));
reg(E("thorncrawler", "Thorn Crawler", "crawler", "crawler", 58, 32, 44, 65, "#e8508a", "#2a6a3a", "#0c2a14"));
reg(E("sprout", "Thorn Sprout", "shooter", "shooter", 52, 28, 48, 0, "#ff8ab8", "#2f6a3a", "#0c2a14", { shot: "lob" }));
reg(E("gargoyle", "Gargoyle", "charger", "charger", 70, 38, 56, 70, "#b8c0d8", "#5a6488", "#1c2238"));
reg(E("darkknight", "Keep Knight", "charger", "charger", 100, 48, 80, 80, "#c0b8e0", "#3a2a58", "#120c24"));

// Turned castle: 14 new kinds with new attack patterns
const T = { turned: true } as const;
reg(E("azuremedusa", "Azure Medusa Head", "flyer", "medusa", 90, 54, 100, 110, "#8fe0ff", "#2a6ad8", "#0a1c48", { wave: true, ...T }));
reg(E("bellwraith", "Bell Wraith", "flyer", "flyer", 80, 44, 90, 55, "#cfe0ff", "#4a5a9a", "#141c40", { shot: "zone", ...T }));
reg(E("bookswarm", "Book Swarm", "flyer", "flyer", 56, 40, 80, 95, "#f0e0c0", "#9a4aaa", "#2a1034", { homing: true, ...T }));
reg(E("rootgrabber", "Root Grabber", "shooter", "shooter", 120, 48, 110, 0, "#c8e8a0", "#3a6a2a", "#0c240c", { shot: "zone", ...T }));
reg(E("cinderskull", "Cinder Skull", "flyer", "flyer", 76, 46, 100, 62, "#ffd8a0", "#c84a1a", "#401408", { shot: "lob", ...T }));
reg(E("marrowcrawler", "Marrow Crawler", "crawler", "crawler", 90, 44, 90, 80, "#f0ead0", "#9a9070", "#302c1c", { split: true, ...T }));
reg(E("brinelurker", "Brine Lurker", "jumper", "jumper", 96, 50, 100, 80, "#a0f0e8", "#2a7a84", "#08282c", { shot: "spread3", ...T }));
reg(E("cogreaper", "Cog Reaper", "charger", "charger", 130, 62, 130, 95, "#ffe090", "#9a7228", "#30200a", T));
reg(E("inkblot", "Inkblot", "shooter", "shooter", 84, 48, 100, 0, "#d8b8f0", "#2a1a44", "#0c0618", { shot: "homing", ...T }));
reg(E("briarthrower", "Briar Thrower", "shooter", "shooter", 100, 52, 110, 0, "#ff8ab8", "#3a7a3a", "#0c2a0c", { shot: "spread5", ...T }));
reg(E("cinderpriest", "Cinder Priest", "shooter", "shooter", 110, 54, 120, 0, "#ffc890", "#8a2a1a", "#2a0c08", { shot: "spread3", ...T }));
reg(E("crimsonbat", "Crimson Bat", "flyer", "flyer", 60, 48, 85, 110, "#ff8aa0", "#8a1a34", "#2a0612", { dive: true, ...T }));
reg(E("hollowknight", "Hollow Knight", "charger", "charger", 160, 70, 150, 95, "#9aa0c8", "#262a48", "#0a0c1c", T));
reg(E("gravewarden", "Grave Warden", "walker", "walker", 150, 66, 140, 52, "#d8d0e8", "#4a3a68", "#180c2c", { shot: "bolt", ...T }));
reg(E("spirewraith", "Spire Wraith", "flyer", "flyer", 90, 54, 110, 70, "#e0f0ff", "#6a7aba", "#1c2450", { homing: true, shot: "zone", ...T }));

// Palette variants of main kinds for the Turned zones (more HP, damage and XP)
const VARIANTS: [string, string, string, string, string][] = [
  ["skeleton", "hollowskel", "Gilded Skeleton", "#ffe8a0", "#a8883a"],
  ["ghoul", "hollowghoul", "Rotted Ghoul", "#d0a8e0", "#684a78"],
  ["wraith", "hollowwraith", "Ember Wraith", "#ffb070", "#a8481a"],
  ["boneknight", "hollowbone", "Marrow Knight", "#f0f0e8", "#8a8a98"],
  ["gargoyle", "hollowgarg", "Basalt Gargoyle", "#a8e0b8", "#3a6a4a"],
  ["gearbot", "hollowgear", "Rust Sentinel", "#e8a070", "#8a4a28"],
];
for (const [src, id, name, a, b] of VARIANTS) {
  const s = ENEMIES[src];
  reg({ ...s, id, name, hp: Math.round(s.hp * 2.2), dmg: Math.round(s.dmg * 1.9), xp: Math.round(s.xp * 2.2), a, b, turned: true });
}

export const ENEMY_PLAN_SCALE = 3;

// ---------------------------------------------------------------- bosses

export type BossPlan = "humanoid" | "colossus" | "floater";
export type Weakness = "fire" | "holy" | "slash" | "whip" | "crush";
export type BossPattern =
  | "slash-walk"
  | "charge"
  | "slam"
  | "bolt-spread"
  | "hover-bolts"
  | "dive"
  | "rain"
  | "homing"
  | "summon";

export interface BossDef {
  id: string;
  name: string;
  plan: BossPlan;
  /** Index into `bosses` (main: 0..8 = zones 2..9 and Faust) or the Turned list. */
  turned: boolean;
  index: number;
  hp: number;
  dmg: number;
  weak: Weakness;
  patterns: BossPattern[];
  /** Extra patterns from half HP (phase 2). */
  patterns2?: BossPattern[];
  phases: 1 | 2 | 3;
  a: string;
  b: string;
  k: string;
  speed: number;
  score: number;
  xp: number;
}

const B = (
  id: string,
  name: string,
  plan: BossPlan,
  turned: boolean,
  index: number,
  hp: number,
  dmg: number,
  weak: Weakness,
  patterns: BossPattern[],
  colors: [string, string, string],
  speed: number,
  score: number,
  xp: number,
  extra: Partial<BossDef> = {},
): BossDef => ({
  id, name, plan, turned, index, hp, dmg, weak, patterns,
  phases: 1, a: colors[0], b: colors[1], k: colors[2], speed, score, xp, ...extra,
});

export const BOSSES: Record<string, BossDef> = {};
const bos = (d: BossDef) => {
  BOSSES[d.id] = d;
};

bos(B("ashen-bishop", "ASHEN BISHOP", "humanoid", false, 0, 360, 22, "holy", ["slash-walk", "bolt-spread", "summon"], ["#e8d8c8", "#6a3a2a", "#241008"], 90, 2000, 300));
bos(B("bone-colossus", "BONE COLOSSUS", "colossus", false, 1, 560, 30, "crush", ["slam", "charge", "rain"], ["#f0ead0", "#a89c78", "#302a18"], 70, 2400, 420));
bos(B("drowned-matron", "DROWNED MATRON", "floater", false, 2, 760, 34, "fire", ["hover-bolts", "rain", "dive"], ["#a8f0e8", "#2a6a78", "#08242c"], 80, 2800, 560));
bos(B("gear-warden", "GEAR WARDEN", "colossus", false, 3, 1000, 40, "slash", ["charge", "slam", "bolt-spread"], ["#ffe090", "#9a7228", "#30200a"], 85, 3200, 700));
bos(B("archivist", "THE ARCHIVIST", "floater", false, 4, 1240, 44, "whip", ["hover-bolts", "homing", "rain"], ["#f0d8ff", "#6a3a8a", "#240c34"], 90, 3600, 860));
bos(B("thorn-duchess", "THORN DUCHESS", "humanoid", false, 5, 1520, 50, "fire", ["slash-walk", "rain", "bolt-spread"], ["#ff8ab8", "#2f6a3a", "#0c2a14"], 100, 4000, 1000));
bos(B("stone-sentinel", "STONE SENTINEL", "colossus", false, 6, 1800, 58, "crush", ["slam", "charge", "rain"], ["#c8d0e8", "#5a6488", "#1c2238"], 80, 4500, 1200));
bos(B("crimson-herald", "CRIMSON HERALD", "floater", false, 7, 2080, 64, "holy", ["dive", "hover-bolts", "homing"], ["#ff8aa0", "#8a1a34", "#2a0612"], 105, 5000, 1400));
bos(B("count-faust", "COUNT FAUST", "humanoid", false, 8, 3200, 78, "holy", ["slash-walk", "bolt-spread", "charge"], ["#f0e0f0", "#2a1040", "#0c0418"], 115, 20000, 3000, {
  phases: 2,
  patterns2: ["dive", "homing", "rain", "summon"],
}));

bos(B("cinder-cantor", "CINDER CANTOR", "humanoid", true, 0, 576, 40, "holy", ["bolt-spread", "slash-walk", "rain"], ["#ffd8b0", "#8a2a1a", "#2a0c08"], 100, 6000, 900));
bos(B("marrow-titan", "MARROW TITAN", "colossus", true, 1, 896, 52, "fire", ["slam", "charge", "rain"], ["#f8f4e0", "#9a9070", "#2c281a"], 80, 6500, 1100));
bos(B("brine-matron", "BRINE MATRON", "floater", true, 2, 1216, 58, "holy", ["hover-bolts", "dive", "homing"], ["#c0fff4", "#2a8a94", "#082a30"], 95, 7000, 1300));
bos(B("pendulum-reaper", "PENDULUM REAPER", "colossus", true, 3, 1600, 66, "whip", ["charge", "slam", "bolt-spread"], ["#fff0b0", "#9a7a2a", "#302008"], 100, 7500, 1500));
bos(B("inkbound-scribe", "INKBOUND SCRIBE", "floater", true, 4, 1984, 72, "slash", ["homing", "hover-bolts", "summon"], ["#e8d0ff", "#4a2a6a", "#180c2a"], 105, 8000, 1700));
bos(B("briar-empress", "BRIAR EMPRESS", "humanoid", true, 5, 2432, 80, "holy", ["slash-walk", "rain", "bolt-spread", "summon"], ["#ffa0c8", "#3a7a3a", "#0c2a0c"], 115, 8500, 1900));
bos(B("gargoyle-tyrant", "GARGOYLE TYRANT", "colossus", true, 6, 2880, 90, "crush", ["slam", "charge", "rain", "bolt-spread"], ["#d0f0d8", "#4a7a5a", "#102418"], 95, 9000, 2100));
bos(B("crimson-regent", "CRIMSON REGENT", "floater", true, 7, 3328, 98, "fire", ["dive", "hover-bolts", "homing", "rain"], ["#ffb0c0", "#a01a40", "#300612"], 125, 10000, 2400));
bos(B("hollow-king", "THE HOLLOW KING", "humanoid", true, 8, 7200, 120, "holy", ["slash-walk", "bolt-spread", "summon"], ["#d8e0ff", "#1c2040", "#06081a"], 125, 50000, 6000, {
  phases: 3,
  patterns2: ["dive", "homing", "charge"],
}));

export const BOSS_PLAN_SCALE = 4;

export function planRows(plan: PlanId, frame: 0 | 1): SpriteRows {
  switch (plan) {
    case "walker": return frame ? PLAN_WALKER_B : PLAN_WALKER_A;
    case "flyer": return frame ? PLAN_FLYER_B : PLAN_FLYER_A;
    case "crawler": return frame ? PLAN_CRAWLER_B : PLAN_CRAWLER_A;
    case "shooter": return frame ? PLAN_SHOOTER_B : PLAN_SHOOTER_A;
    case "jumper": return PLAN_JUMPER;
    case "charger": return PLAN_CHARGER;
    case "medusa": return frame ? PLAN_MEDUSA_B : PLAN_MEDUSA_A;
  }
}

export function bossRows(plan: BossPlan): SpriteRows {
  return plan === "humanoid" ? PLAN_BOSS_HUMANOID : plan === "colossus" ? PLAN_BOSS_COLOSSUS : PLAN_BOSS_FLOATER;
}

/** Palette of an enemy: a = head, b = body, k = feet, e = eye glow, c = trim (bosses). */
export function enemyPalette(a: string, b: string, k: string): SpritePalette {
  return { a, b, k, e: "#ff2a4a", c: a, d: k };
}
