import { H, W } from "./constants";

/** A point [x, y] in canvas px. */
export type Pt = readonly [number, number];
/** Cubic Bezier chain: 3n + 1 points (start, then control, control, end for each segment). */
export type Path = readonly Pt[];

export const mirrorPath = (path: Path): Path => path.map(([x, y]) => [W - x, y] as Pt);

// Entry flights (own design). Each ends close to the formation; the ship then glides into its slot.
const ENTRY_TOP: Path = [
  [130, -30], [130, 150], [40, 260], [120, 330],
  [200, 400], [330, 330], [270, 240],
];
const ENTRY_SIDE_A: Path = [
  [-30, 400], [110, 400], [190, 330], [130, 260],
  [70, 190], [200, 150], [250, 220],
];
const ENTRY_SIDE_B: Path = [
  [-30, 250], [150, 250], [250, 400], [140, 430],
  [30, 460], [40, 300], [230, 240],
];

export const ENTRY_PATHS: Path[] = [
  ENTRY_TOP,
  mirrorPath(ENTRY_TOP),
  ENTRY_SIDE_A,
  mirrorPath(ENTRY_SIDE_A),
  ENTRY_SIDE_B,
];

// Challenging Stage flights: cross the field and leave through the bottom, nobody forms.
const CHALLENGE_TOP: Path = [
  [100, -30], [100, 220], [400, 200], [400, 340],
  [400, 480], [220, 500], [140, 680],
];
const CHALLENGE_SIDE: Path = [
  [-30, 150], [210, 90], [330, 280], [180, 330],
  [30, 380], [120, 520], [220, 680],
];
const CHALLENGE_CENTER: Path = [
  [240, -30], [240, 200], [60, 230], [60, 340],
  [60, 450], [420, 430], [420, 680],
];

export const CHALLENGE_PATHS: Path[] = [
  CHALLENGE_TOP,
  mirrorPath(CHALLENGE_TOP),
  CHALLENGE_SIDE,
  mirrorPath(CHALLENGE_SIDE),
  CHALLENGE_CENTER,
];

/** Dive from slot (sx, sy) at the fighter column tx. `variant` 0 loops out to the side first, 1 weaves. */
export function makeDivePath(sx: number, sy: number, tx: number, variant: 0 | 1): Path {
  const d = sx < W / 2 ? -1 : 1;
  if (variant === 0) {
    return [
      [sx, sy], [sx + d * 80, sy - 40], [sx + d * 100, sy + 120], [sx + d * 40, sy + 170],
      [sx - d * 20, sy + 220], [tx + d * 40, 420], [tx, 470],
      [tx - d * 10, 520], [tx, 580], [tx, H + 50],
    ];
  }
  return [
    [sx, sy], [sx, sy + 60], [tx + d * 120, 250], [tx + d * 60, 320],
    [tx, 390], [tx - d * 100, 420], [tx - d * 40, 480],
    [tx, 540], [tx + d * 20, 580], [tx, H + 50],
  ];
}

/** Boss approach that ends stopped at (bx, by), moving downward. */
export const makeBeamPath = (sx: number, sy: number, bx: number, by: number): Path => [
  [sx, sy], [sx, sy + 50], [bx, by - 110], [bx, by],
];

/** Leaves the beam stop point and exits through the bottom. */
export function makeEscapePath(x: number, y: number): Path {
  const d = x < W / 2 ? 1 : -1;
  return [
    [x, y], [x, y + 60], [x + d * 90, y + 140], [x + d * 90, y + 220],
    [x + d * 90, y + 300], [x + d * 40, H + 20], [x + d * 40, H + 60],
  ];
}

interface Lengths {
  segments: number[];
  total: number;
}

// Arc lengths per path, computed once per path object (a cache, not game state).
const lengthCache = new WeakMap<Path, Lengths>();

function bezier(p: Path, i: number, u: number): Pt {
  const a = p[i], b = p[i + 1], c = p[i + 2], d = p[i + 3];
  const v = 1 - u;
  const w0 = v * v * v, w1 = 3 * v * v * u, w2 = 3 * v * u * u, w3 = u * u * u;
  return [
    w0 * a[0] + w1 * b[0] + w2 * c[0] + w3 * d[0],
    w0 * a[1] + w1 * b[1] + w2 * c[1] + w3 * d[1],
  ];
}

function lengthsOf(path: Path): Lengths {
  const cached = lengthCache.get(path);
  if (cached) return cached;
  const segments: number[] = [];
  let total = 0;
  for (let i = 0; i + 3 < path.length; i += 3) {
    let len = 0;
    let prev = bezier(path, i, 0);
    for (let k = 1; k <= 16; k++) {
      const cur = bezier(path, i, k / 16);
      len += Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
      prev = cur;
    }
    segments.push(len);
    total += len;
  }
  const lengths = { segments, total };
  lengthCache.set(path, lengths);
  return lengths;
}

export const pathLength = (path: Path): number => lengthsOf(path).total;

/** Seconds to fly the whole path at `speed` px/s. */
export const pathDuration = (path: Path, speed: number): number => pathLength(path) / speed;

/** Position at fraction `u` (0..1) of the path length, so the speed stays even across segments. */
export function pathPoint(path: Path, u: number): Pt {
  const { segments, total } = lengthsOf(path);
  let dist = Math.max(0, Math.min(1, u)) * total;
  for (let s = 0; s < segments.length; s++) {
    if (dist <= segments[s] || s === segments.length - 1) {
      return bezier(path, s * 3, segments[s] > 0 ? Math.min(1, dist / segments[s]) : 1);
    }
    dist -= segments[s];
  }
  return path[path.length - 1];
}
