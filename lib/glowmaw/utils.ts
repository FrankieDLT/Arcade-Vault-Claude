import {
  CELL,
  COLS,
  DAZE_BASE,
  DAZE_MIN,
  DAZE_STEP,
  DRIFTER_BASE,
  DRIFTER_MAX,
  DRIFTER_PER_LEVEL,
  MAX_MULT,
  MAX_SCORE,
  MAZE_X,
  MAZE_Y,
  STREAK_STEP,
} from "./constants";

export type Dir = "up" | "down" | "left" | "right";

export interface Cell {
  col: number;
  row: number;
}

export type Tile = "wall" | "floor" | "door";

export interface Pellet extends Cell {
  kind: "mote" | "pearl";
}

export interface Maze {
  cols: number;
  rows: number;
  tiles: Tile[];
  pellets: Pellet[];
  /** 0 none, 1 mote, 2 pearl, indexed by row * cols + col. */
  pelletAt: Uint8Array;
  start: Cell;
  motes: number;
  pearls: number;
}

/** Tie-break order for straight-line choices: up, left, down, right. */
export const DIRS: readonly Dir[] = ["up", "left", "down", "right"];

export const DIR_VEC: Record<Dir, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function opposite(dir: Dir): Dir {
  switch (dir) {
    case "up":
      return "down";
    case "down":
      return "up";
    case "left":
      return "right";
    case "right":
      return "left";
  }
}

function turnRight(dir: Dir): Dir {
  switch (dir) {
    case "up":
      return "right";
    case "right":
      return "down";
    case "down":
      return "left";
    case "left":
      return "up";
  }
}

function turnLeft(dir: Dir): Dir {
  return opposite(turnRight(dir));
}

export function parseMaze(rows: readonly string[]): Maze {
  const nRows = rows.length;
  const nCols = rows[0]?.length ?? 0;
  const tiles: Tile[] = [];
  const pellets: Pellet[] = [];
  const pelletAt = new Uint8Array(nRows * nCols);
  let start: Cell = { col: 0, row: 0 };
  let motes = 0;
  let pearls = 0;
  for (let row = 0; row < nRows; row++) {
    const line = rows[row] ?? "";
    for (let col = 0; col < nCols; col++) {
      const ch = line[col] ?? "#";
      if (ch === "#") {
        tiles.push("wall");
      } else if (ch === "-") {
        tiles.push("door");
      } else {
        tiles.push("floor");
        if (ch === ".") {
          pellets.push({ col, row, kind: "mote" });
          pelletAt[row * nCols + col] = 1;
          motes++;
        } else if (ch === "o") {
          pellets.push({ col, row, kind: "pearl" });
          pelletAt[row * nCols + col] = 2;
          pearls++;
        } else if (ch === "P") {
          start = { col, row };
        }
      }
    }
  }
  return { cols: nCols, rows: nRows, tiles, pellets, pelletAt, start, motes, pearls };
}

function tileAt(maze: Maze, col: number, row: number): Tile {
  return maze.tiles[row * maze.cols + col] ?? "wall";
}

/** True when a mover can stand on the cell. Columns wrap only on rows open at both edges. */
export function isOpen(maze: Maze, col: number, row: number, canUseDoor: boolean): boolean {
  if (row < 0 || row >= maze.rows) return false;
  let c = col;
  if (c < 0 || c >= maze.cols) {
    if (tileAt(maze, 0, row) === "wall" || tileAt(maze, maze.cols - 1, row) === "wall") return false;
    c = (c + maze.cols) % maze.cols;
  }
  const t = tileAt(maze, c, row);
  if (t === "wall") return false;
  if (t === "door") return canUseDoor;
  return true;
}

/** The cell one step away in `dir`; the column wraps. */
export function neighbor(col: number, row: number, dir: Dir): Cell {
  const v = DIR_VEC[dir];
  return { col: (col + v.x + COLS) % COLS, row: row + v.y };
}

/** Option whose cell is closest in straight line to the target; ties go up, left, down, right. */
export function pickStraightLine(
  options: readonly { dir: Dir; col: number; row: number }[],
  target: Cell,
): Dir {
  let best: Dir | null = null;
  let bestD = Infinity;
  for (const dir of DIRS) {
    const o = options.find((x) => x.dir === dir);
    if (!o) continue;
    const d = (o.col - target.col) ** 2 + (o.row - target.row) ** 2;
    if (d < bestD) {
      bestD = d;
      best = dir;
    }
  }
  return best ?? options[0]?.dir ?? "up";
}

/** Keeps the wall on the right: tries a right turn, then straight, then left, then back. */
export function pickWallFollow(heading: Dir, openDirs: readonly Dir[]): Dir {
  const order: Dir[] = [
    turnRight(heading),
    heading,
    turnLeft(heading),
    opposite(heading),
  ];
  for (const d of order) {
    if (openDirs.includes(d)) return d;
  }
  return heading;
}

/** BFS distance to `target` for every cell (-1 = unreachable); the den door is passable. */
export function buildDistanceField(maze: Maze, target: Cell): Int32Array {
  const field = new Int32Array(maze.cols * maze.rows).fill(-1);
  const queue: Cell[] = [target];
  field[target.row * maze.cols + target.col] = 0;
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i]!;
    const base = field[cur.row * maze.cols + cur.col]!;
    for (const dir of DIRS) {
      const n = neighbor(cur.col, cur.row, dir);
      if (!isOpen(maze, n.col, n.row, true)) continue;
      const idx = n.row * maze.cols + n.col;
      if (field[idx] !== -1) continue;
      field[idx] = base + 1;
      queue.push(n);
    }
  }
  return field;
}

/** Drifter speed in tiles/s. */
export function drifterSpeed(level: number): number {
  return Math.min(DRIFTER_MAX, DRIFTER_BASE + DRIFTER_PER_LEVEL * (level - 1));
}

/** Daze duration in seconds. */
export function dazeTime(level: number): number {
  return Math.max(DAZE_MIN, DAZE_BASE - DAZE_STEP * (level - 1));
}

/** Multiplier of the n-th link of the gulp streak (1 for no streak). */
export function streakMultiplier(links: number): number {
  if (links <= 0) return 1;
  return Math.min(MAX_MULT, 1 + Math.floor((links - 1) / STREAK_STEP));
}

export function clampScore(score: number): number {
  return Math.max(0, Math.min(MAX_SCORE, Math.floor(score)));
}

export function cellCenter(col: number, row: number): { x: number; y: number } {
  return { x: MAZE_X + col * CELL + CELL / 2, y: MAZE_Y + row * CELL + CELL / 2 };
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
