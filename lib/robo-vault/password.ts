// Robo Vault password: a 5x5 dot grid (25 bits). Pure functions, no react or next imports.
import { CHECK_COLS, MASK, PERM } from "./constants";

export const SCORE_CAP = 40_950; // 4095 units of 10
export const GRID_SIZE = 5; // 5x5 = 25 cells

export interface Progress {
  /** FROSTBYTE, EMBERCORE, GALEFORCE, TIDEBREAKER. */
  masters: [boolean, boolean, boolean, boolean];
  /** Castle rooms cleared. */
  castleRooms: 0 | 1 | 2 | 3;
  /** Sam defeated. */
  cleared: boolean;
  /** Multiple of 10, 0..SCORE_CAP. */
  score: number;
}

/** Length 25, index = row * 5 + col, A1 = 0 ... E5 = 24. */
export type PasswordGrid = boolean[];

const CELLS = GRID_SIZE * GRID_SIZE;
const PAYLOAD_BITS = 19;
const PAYLOAD_MASK = (1 << PAYLOAD_BITS) - 1;

export function emptyProgress(): Progress {
  return {
    masters: [false, false, false, false],
    castleRooms: 0,
    cleared: false,
    score: 0,
  };
}

/** Score as stored in a password: capped, rounded down to a multiple of 10. */
export function passwordScore(score: number): number {
  const s = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
  return Math.floor(Math.min(s, SCORE_CAP) / 10) * 10;
}

function checksum(payload: number): number {
  let c = 0;
  for (let i = 0; i < PAYLOAD_BITS; i++) {
    if ((payload >> i) & 1) c ^= CHECK_COLS[i];
  }
  return c;
}

export function encodePassword(p: Progress): PasswordGrid {
  let payload = 0;
  for (let i = 0; i < 4; i++) if (p.masters[i]) payload |= 1 << i;
  payload |= (p.castleRooms & 3) << 4;
  if (p.cleared) payload |= 1 << 6;
  payload |= (passwordScore(p.score) / 10) << 7;
  const word = payload | (checksum(payload) << PAYLOAD_BITS);
  const masked = word ^ MASK;
  const grid: PasswordGrid = new Array<boolean>(CELLS).fill(false);
  for (let i = 0; i < CELLS; i++) grid[PERM[i]] = ((masked >> i) & 1) === 1;
  return grid;
}

/** Returns null when the checksum fails or the combination is impossible. */
export function decodePassword(grid: PasswordGrid): Progress | null {
  if (!Array.isArray(grid) || grid.length !== CELLS) return null;
  let masked = 0;
  for (let i = 0; i < CELLS; i++) if (grid[PERM[i]]) masked |= 1 << i;
  const word = masked ^ MASK;
  const payload = word & PAYLOAD_MASK;
  if (checksum(payload) !== word >> PAYLOAD_BITS) return null;

  const masters: Progress["masters"] = [
    (payload & 1) !== 0,
    (payload & 2) !== 0,
    (payload & 4) !== 0,
    (payload & 8) !== 0,
  ];
  const castleRooms = ((payload >> 4) & 3) as Progress["castleRooms"];
  const cleared = ((payload >> 6) & 1) === 1;
  const score = (payload >> 7) * 10;

  const allMasters = masters.every(Boolean);
  if (castleRooms > 0 && !allMasters) return null;
  if (cleared && castleRooms !== 3) return null;
  return { masters, castleRooms, cleared, score };
}

/** 0 -> "A1", 24 -> "E5". */
export function cellLabel(index: number): string {
  return `${"ABCDE"[Math.floor(index / GRID_SIZE)]}${(index % GRID_SIZE) + 1}`;
}

/** Labels of the filled cells, in grid order. */
export function filledLabels(grid: PasswordGrid): string[] {
  const out: string[] = [];
  for (let i = 0; i < grid.length; i++) if (grid[i]) out.push(cellLabel(i));
  return out;
}

const TOKEN = /^([A-Ea-e])([1-5])$/;

/** Parses pasted cell labels (`A2 b5, E1`). Returns null on any unknown token or when there is none. */
export function parsePasswordText(text: string): PasswordGrid | null {
  if (typeof text !== "string" || text.length > 2000) return null;
  const tokens = text.split(/[\s,;]+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return null;
  const grid: PasswordGrid = new Array<boolean>(GRID_SIZE * GRID_SIZE).fill(false);
  for (const t of tokens) {
    const m = TOKEN.exec(t);
    if (!m) return null;
    const row = m[1].toUpperCase().charCodeAt(0) - 65;
    grid[row * GRID_SIZE + (parseInt(m[2], 10) - 1)] = true;
  }
  return grid;
}
