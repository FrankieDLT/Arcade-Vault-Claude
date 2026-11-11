// Marcy the Vampire Hunter password: a 12x12 dot grid (144 bits). Pure functions, no react or next imports.
import {
  CRC_BITS,
  CRC_POLY,
  GRID_COLS,
  GRID_SIZE,
  MASK,
  MAX_LEVEL,
  MAX_LEVEL_MAIN,
  MAX_TIER,
  MAX_TIER_MAIN,
  PAYLOAD_BITS,
  PERM,
} from "./constants";

export { GRID_COLS, GRID_SIZE };
export const SCORE_CAP = 40_950; // 4095 units of 10

export type Hero = "marcy" | "frankford";
export type Relic = "dash" | "leap" | "lantern" | "mist" | "glide" | "sigil";
export type Slot = "weapon" | "head" | "body" | "cloak" | "ring";

export const RELICS: Relic[] = ["dash", "leap", "lantern", "mist", "glide", "sigil"];
export const SLOTS: Slot[] = ["weapon", "head", "body", "cloak", "ring"];

export interface TurnedProgress {
  /** T1..T8 bosses, then the Hollow King. */
  bosses: boolean[];
  /** Vitality Crests T1..T8. */
  crests: boolean[];
  /** Map revealed T1..T8. */
  mapped: boolean[];
}

export interface Progress {
  hero: Hero;
  relics: Record<Relic, boolean>;
  /** Length 9: zones 2..9 bosses, then Count Faust. */
  bosses: boolean[];
  /** 1..63 (above 50 only with Count Faust defeated). */
  level: number;
  /** Tier 0..15 (above 10 only with Count Faust defeated). 0 = empty. */
  equipment: Record<Slot, number>;
  /** Length 10, one Vitality Crest per zone. */
  crests: boolean[];
  /** Length 10, zone map revealed. */
  mapped: boolean[];
  /** Multiple of 10, 0..SCORE_CAP. */
  score: number;
  turned: TurnedProgress;
}

/** Length 144, index = row * 12 + col, A1 = 0 ... L12 = 143. */
export type PasswordGrid = boolean[];

/** Relic -> index in `bosses` of the boss that drops it. */
export const RELIC_BOSS: Record<Relic, number> = {
  dash: 0,
  leap: 1,
  lantern: 2,
  mist: 3,
  glide: 4,
  sigil: 5,
};

export function emptyTurned(): TurnedProgress {
  return {
    bosses: new Array<boolean>(9).fill(false),
    crests: new Array<boolean>(8).fill(false),
    mapped: new Array<boolean>(8).fill(false),
  };
}

export function emptyProgress(hero: Hero): Progress {
  return {
    hero,
    relics: { dash: false, leap: false, lantern: false, mist: false, glide: false, sigil: false },
    bosses: new Array<boolean>(9).fill(false),
    level: 1,
    equipment: { weapon: 0, head: 0, body: 0, cloak: 0, ring: 0 },
    crests: new Array<boolean>(10).fill(false),
    mapped: new Array<boolean>(10).fill(false),
    score: 0,
    turned: emptyTurned(),
  };
}

/** Score as stored in a password: capped, rounded down to a multiple of 10. */
export function passwordScore(score: number): number {
  const s = Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
  return Math.floor(Math.min(s, SCORE_CAP) / 10) * 10;
}

/** CRC-12 over a bit array, one bit at a time. */
function crc12(bits: number[]): number {
  let reg = 0;
  for (let i = 0; i < bits.length; i++) {
    const top = (reg >> (CRC_BITS - 1)) & 1;
    reg = (reg << 1) & ((1 << CRC_BITS) - 1);
    if (top ^ bits[i]) reg ^= CRC_POLY;
  }
  return reg;
}

class BitWriter {
  bits: number[] = [];
  put(value: number, width: number): void {
    for (let i = 0; i < width; i++) this.bits.push((value >> i) & 1);
  }
  flag(v: boolean): void {
    this.bits.push(v ? 1 : 0);
  }
}

class BitReader {
  private pos = 0;
  constructor(private bits: number[]) {}
  get(width: number): number {
    let v = 0;
    for (let i = 0; i < width; i++) v |= this.bits[this.pos++] << i;
    return v;
  }
  flag(): boolean {
    return this.bits[this.pos++] === 1;
  }
  flags(n: number): boolean[] {
    const out: boolean[] = [];
    for (let i = 0; i < n; i++) out.push(this.flag());
    return out;
  }
}

function pad(list: boolean[], n: number): boolean[] {
  const out = list.slice(0, n);
  while (out.length < n) out.push(false);
  return out;
}

export function encodePassword(p: Progress): PasswordGrid {
  const w = new BitWriter();
  w.put(p.hero === "frankford" ? 1 : 0, 1);
  for (const r of RELICS) w.flag(p.relics[r]);
  for (const b of pad(p.bosses, 9)) w.flag(b);
  w.put(Math.max(1, Math.min(MAX_LEVEL, Math.floor(p.level))), 6);
  for (const s of SLOTS) w.put(Math.max(0, Math.min(MAX_TIER, Math.floor(p.equipment[s]))), 4);
  w.put(passwordScore(p.score) / 10, 12);
  for (const c of pad(p.crests, 10)) w.flag(c);
  for (const m of pad(p.mapped, 10)) w.flag(m);
  // SPEC 22 block (32 bits): 9 + 8 + 8 + 7 reserved.
  for (const b of pad(p.turned.bosses, 9)) w.flag(b);
  for (const c of pad(p.turned.crests, 8)) w.flag(c);
  for (const m of pad(p.turned.mapped, 8)) w.flag(m);
  w.put(0, 7);
  w.put(0, 26); // spare
  const payload = w.bits;
  const crc = crc12(payload);
  const word = payload.slice();
  for (let i = 0; i < CRC_BITS; i++) word.push((crc >> i) & 1);
  const grid: PasswordGrid = new Array<boolean>(GRID_SIZE).fill(false);
  for (let i = 0; i < GRID_SIZE; i++) grid[PERM[i]] = (word[i] ^ MASK[i]) === 1;
  return grid;
}

/** Returns null when the checksum fails or the combination is impossible. */
export function decodePassword(grid: PasswordGrid): Progress | null {
  if (!Array.isArray(grid) || grid.length !== GRID_SIZE) return null;
  const word: number[] = new Array<number>(GRID_SIZE);
  for (let i = 0; i < GRID_SIZE; i++) word[i] = (grid[PERM[i]] ? 1 : 0) ^ MASK[i];
  const payload = word.slice(0, PAYLOAD_BITS);
  let stored = 0;
  for (let i = 0; i < CRC_BITS; i++) stored |= word[PAYLOAD_BITS + i] << i;
  if (crc12(payload) !== stored) return null;

  const r = new BitReader(payload);
  const hero: Hero = r.get(1) === 1 ? "frankford" : "marcy";
  const relics = {} as Record<Relic, boolean>;
  for (const rel of RELICS) relics[rel] = r.flag();
  const bosses = r.flags(9);
  const level = r.get(6);
  const equipment = {} as Record<Slot, number>;
  for (const s of SLOTS) equipment[s] = r.get(4);
  const score = r.get(12) * 10;
  const crests = r.flags(10);
  const mapped = r.flags(10);
  const tBosses = r.flags(9);
  const tCrests = r.flags(8);
  const tMapped = r.flags(8);
  const reserved = r.get(7);
  const spare = r.get(26);
  if (reserved !== 0 || spare !== 0) return null;

  const faust = bosses[8];
  if (level < 1 || level > MAX_LEVEL) return null;
  for (const s of SLOTS) if (equipment[s] > MAX_TIER) return null;
  if (!faust) {
    if (level > MAX_LEVEL_MAIN) return null;
    for (const s of SLOTS) if (equipment[s] > MAX_TIER_MAIN) return null;
    if (tBosses.some(Boolean) || tCrests.some(Boolean) || tMapped.some(Boolean)) return null;
  }
  for (const rel of RELICS) if (relics[rel] && !bosses[RELIC_BOSS[rel]]) return null;
  if (faust && !bosses.slice(0, 8).every(Boolean)) return null;
  if (bosses[7] && !bosses.slice(0, 7).every(Boolean)) return null;
  // Zone 2..9 boss i needs the map bit of zone i + 2 (index i + 1); Faust needs zone 10 (index 9).
  for (let i = 0; i < 8; i++) if (bosses[i] && !mapped[i + 1]) return null;
  if (faust && !mapped[9]) return null;
  // Turned castle.
  for (let i = 0; i < 8; i++) if (tBosses[i] && !tMapped[i]) return null;
  if (tBosses[7] && !tBosses.slice(0, 7).every(Boolean)) return null;
  if (tBosses[8] && !tBosses.slice(0, 8).every(Boolean)) return null;

  return {
    hero,
    relics,
    bosses,
    level,
    equipment,
    crests,
    mapped,
    score,
    turned: { bosses: tBosses, crests: tCrests, mapped: tMapped },
  };
}

/** 0 -> "A1", 143 -> "L12". */
export function cellLabel(index: number): string {
  return `${"ABCDEFGHIJKL"[Math.floor(index / GRID_COLS)]}${(index % GRID_COLS) + 1}`;
}

/** Labels of the filled cells, in grid order. */
export function filledLabels(grid: PasswordGrid): string[] {
  const out: string[] = [];
  for (let i = 0; i < grid.length; i++) if (grid[i]) out.push(cellLabel(i));
  return out;
}

const TOKEN = /^([A-La-l])(1[0-2]|[1-9])$/;

/** Parses pasted cell labels (`A2 b10, L12`). Returns null on any unknown token or no token. */
export function parsePasswordText(text: string): PasswordGrid | null {
  if (typeof text !== "string" || text.length > 5000) return null;
  const tokens = text.split(/[\s,;]+/).filter((t) => t.length > 0);
  if (tokens.length === 0) return null;
  const grid: PasswordGrid = new Array<boolean>(GRID_SIZE).fill(false);
  for (const t of tokens) {
    const m = TOKEN.exec(t);
    if (!m) return null;
    const row = m[1].toUpperCase().charCodeAt(0) - 65;
    grid[row * GRID_COLS + (parseInt(m[2], 10) - 1)] = true;
  }
  return grid;
}
