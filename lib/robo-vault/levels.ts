// Robo Vault level maps. Built from small helpers into arrays of strings (12 rows each).
//
// Legend
//   .  air            #  solid          I  ice (solid, slippery)
//   ^  spikes (kill)  L  lava (kill)     ~  water (decoration only)
//   S  hero start     c  checkpoint      E  room exit (touch = room cleared)
//   w  walker  h  hopper  t  turret  f  flyer
//   m  moving platform (center of its swing)
//   o  small energy   u  1-up            B  boss spawn
import type { StageId } from "./constants";

export interface LevelDef {
  id: StageId;
  rows: string[];
  /** Column where the boss room starts; crossing it closes the gate. null = no gate. */
  bossCol: number | null;
  /** Boss fight starts at once (single-screen arenas). */
  arena: boolean;
  /** Touching an `E` tile clears the room. */
  hasExit: boolean;
}

const ROWS = 12;

class Grid {
  private cells: string[][];
  constructor(readonly w: number) {
    this.cells = Array.from({ length: ROWS }, () =>
      Array.from({ length: w }, () => "."),
    );
  }
  set(c: number, r: number, ch: string) {
    if (c >= 0 && c < this.w && r >= 0 && r < ROWS) this.cells[r][c] = ch;
  }
  rect(c: number, r: number, cw: number, rh: number, ch: string) {
    for (let y = r; y < r + rh; y++)
      for (let x = c; x < c + cw; x++) this.set(x, y, ch);
  }
  /** Solid floor from `top` down, columns c0..c1 inclusive. */
  ground(c0: number, c1: number, ch = "#", top = 10) {
    this.rect(c0, top, c1 - c0 + 1, ROWS - top, ch);
  }
  carve(c0: number, c1: number, fill = ".", top = 10) {
    this.rect(c0, top, c1 - c0 + 1, ROWS - top, fill);
  }
  plat(c: number, r: number, len: number, ch = "#") {
    this.rect(c, r, len, 1, ch);
  }
  at(ch: string, r: number, cols: number[]) {
    for (const c of cols) this.set(c, r, ch);
  }
  /** Boss room: ceiling, right wall, boss marker. */
  bossRoom(start: number) {
    this.rect(start, 0, this.w - start, 1, "#");
    this.rect(this.w - 1, 0, 1, ROWS, "#");
    this.set(this.w - 4, 9, "B");
  }
  rows(): string[] {
    return this.cells.map((r) => r.join(""));
  }
}

function frostbyte(): LevelDef {
  const g = new Grid(80);
  g.ground(0, 79);
  g.rect(5, 10, 8, 1, "I");
  g.carve(14, 16);
  g.rect(17, 10, 14, 1, "I");
  g.set(2, 9, "S");
  g.at("^", 9, [24, 25]);
  g.at("w", 9, [21, 34]);
  g.at("h", 9, [28, 44]);
  g.plat(26, 8, 3);
  g.set(27, 7, "o");
  g.carve(36, 38);
  g.set(40, 9, "c");
  g.set(47, 9, "t");
  g.rect(40, 10, 8, 1, "I");
  g.carve(50, 61);
  g.plat(51, 8, 2);
  g.plat(55, 8, 2);
  g.plat(59, 8, 2);
  g.at("f", 5, [53, 58]);
  g.set(55, 6, "u");
  g.set(62, 9, "w");
  g.bossRoom(64);
  return { id: "frostbyte", rows: g.rows(), bossCol: 64, arena: false, hasExit: false };
}

function embercore(): LevelDef {
  const g = new Grid(80);
  g.ground(0, 79);
  g.set(2, 9, "S");
  g.carve(14, 19, "L");
  g.set(16, 8, "m");
  g.set(24, 9, "w");
  g.set(28, 9, "t");
  g.set(32, 9, "h");
  g.carve(36, 39, "L");
  g.plat(37, 8, 2);
  g.set(42, 9, "c");
  g.at("^", 9, [46, 47]);
  g.set(49, 9, "h");
  g.set(50, 9, "o");
  g.carve(53, 60, "L");
  g.set(55, 8, "m");
  g.set(59, 8, "m");
  g.at("f", 4, [56, 60]);
  g.set(62, 9, "t");
  g.set(30, 6, "u");
  g.plat(29, 7, 3);
  g.bossRoom(64);
  return { id: "embercore", rows: g.rows(), bossCol: 64, arena: false, hasExit: false };
}

function galeforce(): LevelDef {
  const g = new Grid(80);
  g.ground(0, 8);
  g.set(2, 9, "S");
  g.plat(11, 9, 3);
  g.plat(16, 8, 3);
  g.plat(21, 9, 2);
  g.set(26, 7, "m");
  g.plat(30, 8, 3);
  g.set(31, 7, "w");
  g.plat(35, 9, 4);
  g.set(36, 8, "c");
  g.set(38, 8, "t");
  g.plat(41, 8, 2);
  g.plat(45, 7, 2);
  g.set(46, 6, "o");
  g.plat(49, 8, 2);
  g.set(54, 8, "m");
  g.plat(58, 9, 4);
  g.set(60, 8, "h");
  g.ground(62, 79);
  g.at("f", 6, [13, 40]);
  g.at("f", 5, [19, 52]);
  g.set(24, 5, "u");
  g.bossRoom(64);
  return { id: "galeforce", rows: g.rows(), bossCol: 64, arena: false, hasExit: false };
}

function tidebreaker(): LevelDef {
  const g = new Grid(80);
  g.ground(0, 79);
  g.rect(0, 6, 80, 4, "~");
  g.set(2, 9, "S");
  g.rect(8, 1, 4, 4, "#");
  g.set(14, 9, "t");
  g.at("^", 9, [17, 18]);
  g.set(19, 9, "w");
  g.carve(22, 24);
  g.plat(23, 8, 1);
  g.set(26, 9, "h");
  g.set(28, 9, "t");
  g.plat(30, 8, 3);
  g.set(31, 7, "o");
  g.set(33, 9, "w");
  g.carve(36, 38);
  g.set(34, 9, "c");
  g.set(40, 9, "w");
  g.set(44, 9, "t");
  g.set(47, 9, "h");
  g.carve(50, 56);
  g.plat(51, 8, 2);
  g.plat(54, 8, 2);
  g.at("f", 4, [52, 60]);
  g.set(55, 6, "u");
  g.set(61, 9, "w");
  g.bossRoom(64);
  return { id: "tidebreaker", rows: g.rows(), bossCol: 64, arena: false, hasExit: false };
}

function castle1(): LevelDef {
  const g = new Grid(64);
  g.ground(0, 63);
  g.set(2, 9, "S");
  g.at("^", 9, [8, 9]);
  g.set(11, 9, "t");
  g.carve(14, 22);
  g.rect(14, 11, 9, 1, "^");
  g.set(16, 8, "m");
  g.set(20, 8, "m");
  g.set(24, 9, "c");
  g.set(26, 9, "t");
  g.set(30, 9, "h");
  g.at("^", 9, [28, 29, 34, 35]);
  g.set(32, 9, "t");
  g.set(38, 9, "t");
  g.set(40, 9, "h");
  g.carve(44, 57);
  g.plat(45, 8, 2);
  g.plat(49, 8, 2);
  g.plat(53, 8, 2);
  g.at("f", 5, [46, 51]);
  g.set(51, 6, "u");
  g.set(60, 9, "t");
  g.set(62, 9, "E");
  g.rect(63, 0, 1, ROWS, "#");
  return { id: "castle1", rows: g.rows(), bossCol: null, arena: false, hasExit: true };
}

function castle2(): LevelDef {
  const g = new Grid(16);
  g.ground(0, 15);
  g.rect(0, 0, 1, ROWS, "#");
  g.rect(15, 0, 1, ROWS, "#");
  g.rect(0, 0, 16, 1, "#");
  g.set(2, 9, "S");
  g.set(12, 9, "B");
  return { id: "castle2", rows: g.rows(), bossCol: null, arena: true, hasExit: false };
}

function castle3(): LevelDef {
  const g = new Grid(64);
  g.ground(0, 63);
  g.rect(0, 0, 64, 6, "#");
  g.set(2, 9, "S");
  g.at("t", 9, [10, 22, 34, 46, 56]);
  g.at("^", 9, [14, 15, 28, 29, 40, 41]);
  g.at("w", 9, [18, 38]);
  g.at("h", 9, [25, 50]);
  g.set(30, 9, "c");
  g.at("f", 7, [20, 44]);
  g.set(32, 9, "o");
  g.set(62, 9, "E");
  g.rect(63, 0, 1, ROWS, "#");
  return { id: "castle3", rows: g.rows(), bossCol: null, arena: false, hasExit: true };
}

function sam(): LevelDef {
  const g = new Grid(16);
  g.ground(0, 15);
  g.rect(0, 0, 1, ROWS, "#");
  g.rect(15, 0, 1, ROWS, "#");
  g.rect(0, 0, 16, 1, "#");
  g.plat(3, 7, 3);
  g.plat(10, 7, 3);
  g.set(2, 9, "S");
  g.set(12, 9, "B");
  return { id: "sam", rows: g.rows(), bossCol: null, arena: true, hasExit: false };
}

const BUILDERS: Record<StageId, () => LevelDef> = {
  frostbyte,
  embercore,
  galeforce,
  tidebreaker,
  castle1,
  castle2,
  castle3,
  sam,
};

export function buildLevel(id: StageId): LevelDef {
  return BUILDERS[id]();
}
