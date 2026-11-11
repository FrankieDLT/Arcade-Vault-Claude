// Marcy the Vampire Hunter world: room generator and the main castle (10 zones).
// Pure data, no react or next imports, no game state.
//
// Tile legend (one char per 48 px tile, 12 rows per room):
//   ' ' air   '#' stone   '=' one-way platform   '^' spikes
//   'H' hidden door (solid until the lantern)    'G' grate (passes in mist form)
//   'S' sigil wall (broken by attacks with the sigil)
//   'K' boss door (solid until the bosses it needs are defeated)
//   'X' boss gate (closed while a boss fight runs or before the boss is beaten)
import { TILE, VIEW_COLS, VIEW_ROWS, ZONE_NAMES, ZONE_PALETTES, type ZonePalette } from "./constants";
import { hashString, makeRng } from "./utils";

export type GateKind = "dash" | "leap" | "lantern" | "mist" | "glide" | "sigil" | "bosses";

export interface Spawn {
  t: "enemy" | "chest" | "crest" | "breakable" | "boss";
  col: number;
  row: number;
  /** Enemy kind or boss id. */
  id?: string;
  tier?: number;
  /** Stable key so an opened chest or a taken crest is remembered in the run. */
  key?: string;
}

export interface Door {
  col: number;
  to: string;
  toCol: number;
  /** Turned bosses (indices 0..7) that must be defeated before this door opens. */
  needsTurned?: number[];
}

export interface Room {
  id: string;
  name: string;
  castle: "main" | "turned";
  /** Zone index: main 0..9, Turned 0..8 (8 = Hollow Throne). */
  zone: number;
  cols: number;
  tiles: string[];
  left: string | null;
  right: string | null;
  doors: Door[];
  dark: boolean;
  mapX: number;
  mapY: number;
  spawns: Spawn[];
  gate: { kind: GateKind; col: number } | null;
  /** Boss arena: gates X close during the fight. */
  boss: string | null;
  altarCol: number | null;
  side: boolean;
}

export interface ZoneDef {
  index: number;
  castle: "main" | "turned";
  name: string;
  palette: ZonePalette;
  rooms: string[];
  first: string;
  altarRoom: string;
  bossRoom: string | null;
  enemies: string[];
  boss: string | null;
}

export const ROWS = VIEW_ROWS;
export const FLOOR_ROW = 11;

export function getRoom(rooms: Record<string, Room>, id: string): Room {
  return rooms[id];
}

type Grid = string[][];

function blank(cols: number): Grid {
  return Array.from({ length: ROWS }, () => new Array<string>(cols).fill(" "));
}

function put(g: Grid, r0: number, r1: number, c0: number, c1: number, ch: string): void {
  for (let r = Math.max(0, r0); r <= Math.min(ROWS - 1, r1); r++) {
    for (let c = Math.max(0, c0); c <= Math.min(g[0].length - 1, c1); c++) g[r][c] = ch;
  }
}

/** Row of the first solid or one-way tile at a column, scanning down from `from`. -1 if none. */
function surface(g: Grid, col: number, from = 1): number {
  for (let r = from; r < ROWS; r++) {
    const ch = g[r][col];
    if (ch === "#" || ch === "=") return r;
    if (ch === "^") return -1;
  }
  return -1;
}

export type RoomKind = "hall" | "pit" | "stairs" | "tower" | "corr" | "altar" | "boss" | "gate" | "side" | "gside" | "hub";

export interface RoomSpec {
  id: string;
  name: string;
  castle: "main" | "turned";
  zone: number;
  kind: RoomKind;
  screens: number;
  left: string | null;
  right: string | null;
  enemies: string[];
  /** Enemies per screen (rounded). */
  density: number;
  dark?: boolean;
  chest?: { key: string; tier: number };
  breakables?: boolean;
  gate?: GateKind;
  crest?: { key: string };
  boss?: string;
  mapX: number;
  mapY: number;
  doors?: Door[];
  altar?: boolean;
  /** Door columns on the grid (hub, side rooms). */
  doorCols?: number[];
}

/** Builds a room from a spec. Seeded by the room id, so the castle is the same on every run. */
export function buildRoom(spec: RoomSpec): Room {
  const cols = spec.screens * VIEW_COLS;
  const rnd = makeRng(hashString(spec.id));
  const g = blank(cols);
  const doors: Door[] = spec.doors ? spec.doors.slice() : [];
  const spawns: Spawn[] = [];
  let gate: Room["gate"] = null;
  let altarCol: number | null = null;
  const kind = spec.kind;

  // Shell: ceiling, floor, side walls with a 3-tile opening (rows 8..10) where linked.
  put(g, 0, 0, 0, cols - 1, "#");
  put(g, FLOOR_ROW, FLOOR_ROW, 0, cols - 1, "#");
  put(g, 0, 7, 0, 0, "#");
  put(g, 0, 7, cols - 1, cols - 1, "#");
  if (!spec.left) put(g, 8, 10, 0, 0, "#");
  if (!spec.right) put(g, 8, 10, cols - 1, cols - 1, "#");

  const safeFrom = 5;
  const safeTo = cols - 6;
  const mid = Math.floor(cols / 2);

  switch (kind) {
    case "hall": {
      const n = spec.screens + 1;
      for (let i = 0; i < n; i++) {
        const c = safeFrom + Math.floor(rnd() * Math.max(1, safeTo - safeFrom - 4));
        put(g, 9, 9, c, c + 2 + Math.floor(rnd() * 2), "=");
      }
      if (rnd() < 0.6) {
        const c = safeFrom + 3 + Math.floor(rnd() * Math.max(1, safeTo - safeFrom - 8));
        put(g, 10, 10, c, c + 1, "#");
      }
      break;
    }
    case "pit": {
      const n = spec.screens;
      let c = safeFrom;
      for (let i = 0; i < n; i++) {
        c += 4 + Math.floor(rnd() * 3);
        if (c > safeTo - 3) break;
        const w = 2 + Math.floor(rnd() * 2);
        put(g, FLOOR_ROW, FLOOR_ROW, c, c + w - 1, "^");
        if (rnd() < 0.5) put(g, 9, 9, c - 1, c + w, "=");
        c += w + 3;
      }
      break;
    }
    case "stairs": {
      // Steps of height 1, 2, 3, 3, 2, 1 (each 3 tiles wide): never more than one tile up at a time.
      const heights = [1, 2, 3, 3, 2, 1];
      heights.forEach((h, i) => {
        const c = safeFrom + i * 3;
        if (c + 2 < cols - 5) put(g, FLOOR_ROW - h, FLOOR_ROW - 1, c, c + 2, "#");
      });
      break;
    }
    case "tower": {
      const n = spec.screens * 2;
      for (let i = 0; i < n; i++) {
        const c = safeFrom + Math.floor((i / n) * (safeTo - safeFrom)) + Math.floor(rnd() * 3);
        const lvl = i % 3;
        const row = lvl === 0 ? 9 : lvl === 1 ? 7 : 5;
        put(g, row, row, c, Math.min(cols - 3, c + 3), "=");
      }
      break;
    }
    case "corr": {
      put(g, 1, 5, 4, cols - 5, "#");
      if (rnd() < 0.5) put(g, 9, 9, mid - 1, mid + 1, "=");
      break;
    }
    case "altar": {
      put(g, 9, 9, 3, 5, "=");
      put(g, 9, 9, cols - 6, cols - 4, "=");
      altarCol = mid;
      break;
    }
    case "boss": {
      put(g, 9, 9, 3, 5, "=");
      put(g, 9, 9, cols - 6, cols - 4, "=");
      // Gates: left (closes at the fight) and right (opens after the boss).
      put(g, 8, 10, 0, 0, spec.left ? "X" : "#");
      put(g, 8, 10, cols - 1, cols - 1, spec.right ? "X" : "#");
      break;
    }
    case "gate": {
      // Entry gate of a zone: the obstacle sits in the middle of two screens.
      const k = spec.gate ?? "dash";
      gate = { kind: k, col: mid };
      switch (k) {
        case "dash":
          put(g, 1, 9, mid - 1, mid + 1, "#");
          break;
        case "leap":
          put(g, 7, 10, mid, mid + 1, "#");
          break;
        case "lantern":
          put(g, 1, 10, mid, mid, "H");
          break;
        case "mist":
          put(g, 1, 10, mid, mid, "G");
          break;
        case "glide":
          put(g, FLOOR_ROW, FLOOR_ROW, mid - 4, mid + 4, "^");
          break;
        case "sigil":
          put(g, 1, 10, mid, mid, "S");
          break;
        case "bosses":
          put(g, 1, 10, mid, mid + 1, "K");
          break;
      }
      break;
    }
    case "gside": {
      // Dead-end side room: a door on the left, an obstacle in the middle and a prize at the right end.
      const k = spec.gate ?? "dash";
      gate = { kind: k, col: mid };
      put(g, 8, 10, 0, 0, "#");
      put(g, 8, 10, cols - 1, cols - 1, "#");
      switch (k) {
        case "dash": put(g, 1, 9, mid - 1, mid + 1, "#"); break;
        case "leap": put(g, 7, 10, mid, mid + 1, "#"); break;
        case "lantern": put(g, 1, 10, mid, mid, "H"); break;
        case "mist": put(g, 1, 10, mid, mid, "G"); break;
        case "glide": put(g, FLOOR_ROW, FLOOR_ROW, mid - 4, mid + 4, "^"); break;
        case "sigil": put(g, 1, 10, mid, mid, "S"); break;
        case "bosses": put(g, 1, 10, mid, mid + 1, "K"); break;
      }
      break;
    }
    case "side": {
      put(g, 8, 10, 0, 0, "#");
      put(g, 8, 10, cols - 1, cols - 1, "#");
      put(g, 9, 9, 6, 8, "=");
      put(g, 9, 9, cols - 9, cols - 7, "=");
      break;
    }
    case "hub": {
      put(g, 9, 9, 4, 7, "=");
      put(g, 9, 9, cols - 8, cols - 5, "=");
      put(g, 7, 7, mid - 2, mid + 1, "=");
      break;
    }
  }

  // Spawns -----------------------------------------------------------------
  // Corridor rooms have a solid ceiling block in rows 1 to 5: spawn below it.
  const scanFrom = kind === "corr" ? 6 : 1;
  const standCols: number[] = [];
  for (let c = safeFrom; c <= safeTo; c++) {
    const s = surface(g, c, scanFrom);
    if (s > 0 && g[s - 1][c] === " ") standCols.push(c);
  }
  const takeCol = (minGap = 3): number => {
    if (standCols.length === 0) return mid;
    for (let tries = 0; tries < 12; tries++) {
      const c = standCols[Math.floor(rnd() * standCols.length)];
      if (!spawns.some((s) => Math.abs(s.col - c) < minGap && s.t !== "enemy")) return c;
    }
    return standCols[Math.floor(rnd() * standCols.length)];
  };
  const placeAt = (t: Spawn["t"], c: number, extra: Partial<Spawn> = {}) => {
    const s = surface(g, c, scanFrom);
    spawns.push({ t, col: c, row: s > 0 ? s - 1 : FLOOR_ROW - 1, ...extra });
  };

  if (kind !== "altar" && kind !== "boss" && kind !== "hub" && kind !== "side" && spec.enemies.length > 0) {
    const n = Math.max(1, Math.round(spec.screens * spec.density));
    for (let i = 0; i < n; i++) {
      const id = spec.enemies[Math.floor(rnd() * spec.enemies.length)];
      const c = takeCol(2);
      spawns.push({ t: "enemy", col: c, row: surface(g, c, scanFrom) - 1, id });
    }
  }
  if (spec.breakables) {
    for (let i = 0; i < spec.screens + 1; i++) placeAt("breakable", takeCol(3), { key: `${spec.id}:b${i}` });
  }
  if (spec.chest) {
    if (kind === "gside") {
      placeAt("chest", cols - 5, { key: spec.chest.key, tier: spec.chest.tier });
    } else {
      placeAt("chest", takeCol(4), { key: spec.chest.key, tier: spec.chest.tier });
    }
  }
  if (spec.crest) placeAt("crest", cols - 4, { key: spec.crest.key });
  if (spec.boss) spawns.push({ t: "boss", col: cols - 5, row: FLOOR_ROW - 1, id: spec.boss });
  if (kind === "side" && !spec.chest && !spec.crest) placeAt("breakable", takeCol(3), { key: `${spec.id}:b9` });

  return {
    id: spec.id,
    name: spec.name,
    castle: spec.castle,
    zone: spec.zone,
    cols,
    tiles: g.map((r) => r.join("")),
    left: spec.left,
    right: spec.right,
    doors,
    dark: !!spec.dark,
    mapX: spec.mapX,
    mapY: spec.mapY,
    spawns,
    gate,
    boss: spec.boss ?? null,
    altarCol,
    side: kind === "side" || kind === "gside",
  };
}

// ---------------------------------------------------------------- main castle

/** Relic that guards the entry of zones 3..10 (index = zone index). Zone 9 and 10 use boss doors. */
export const ENTRY_GATE: (GateKind | null)[] = [null, null, "dash", "leap", "lantern", "mist", "glide", "sigil", "bosses", "bosses"];

const ZONE_ENEMIES: string[][] = [
  ["skeleton", "bat", "rat"],
  ["cultist", "ghoul", "bat"],
  ["boneknight", "archer", "ghoul"],
  ["drowned", "leech", "wraith"],
  ["gearbot", "sentry", "bat"],
  ["bookworm", "tome", "wraith"],
  ["thorncrawler", "sprout", "bat"],
  ["gargoyle", "bat", "boneknight"],
  ["wraith", "leech", "cultist"],
  ["darkknight", "wraith", "gargoyle"],
];

const MAIN_BOSS: (string | null)[] = [
  null,
  "ashen-bishop",
  "bone-colossus",
  "drowned-matron",
  "gear-warden",
  "archivist",
  "thorn-duchess",
  "stone-sentinel",
  "crimson-herald",
  "count-faust",
];

/** Room plans per zone. Flags: *c chest, *b breakables, *d dark, *s side chest room, *k:<relic> gated crest room. */
const MAIN_PLANS: string[][] = [
  ["hall:2*b", "hall:2*c", "altar", "pit:2*b", "hall:3*s", "stairs:2*k:dash", "hall:2"],
  ["hall:2*b", "hall:3*c", "altar", "pit:3", "tower:2*s*k:leap", "corr:3", "boss"],
  ["gate", "hall:3", "corr:3*c", "altar", "pit:3*b", "tower:3*s", "stairs:2*k:lantern", "boss"],
  ["gate", "hall:3*d", "pit:3*d", "altar", "corr:2*c*d", "tower:2*s", "hall:2*k:mist", "boss"],
  ["gate", "hall:3", "tower:3*c", "altar", "pit:3*b", "corr:3", "stairs:2*s*k:glide", "boss"],
  ["gate", "hall:2", "tower:3*c", "altar", "pit:3", "hall:3*s", "corr:3*k:sigil", "boss"],
  ["gate", "hall:3", "pit:3", "altar", "tower:3*c", "hall:2*s*k:lantern", "stairs:3", "boss"],
  ["gate", "hall:3", "tower:3", "altar", "pit:3*c", "corr:2", "hall:3*s*k:mist", "boss"],
  ["gate", "hall:3", "pit:3", "altar", "tower:3*c", "corr:3", "hall:3*s*k:glide", "boss"],
  ["gate", "hall:3", "tower:3", "altar", "pit:3*c", "corr:3*k:sigil", "hall:2", "boss"],
];

export interface World {
  rooms: Record<string, Room>;
  zones: ZoneDef[];
}

function parseToken(t: string): { kind: string; screens: number; flags: string[] } {
  const [head, ...flags] = t.split("*");
  const [kind, n] = head.split(":");
  return { kind, screens: n ? parseInt(n, 10) : 1, flags };
}

/** Builds one zone (main or Turned) from a plan; used by both castles. */
export function buildZone(opts: {
  castle: "main" | "turned";
  zone: number;
  prefix: string;
  name: string;
  palette: ZonePalette;
  plan: string[];
  enemies: string[];
  boss: string | null;
  entryGate: GateKind | null;
  density: number;
  /** Chest tiers by roll: called with (zone, n) to pick a tier. */
  tierOf: (n: number) => number;
  crestKeyPrefix: string;
  mapY: number;
  /** Room that links to the left of the first room (previous zone's boss room) or null. */
  prevRoom: string | null;
  /** Turned zones: hub door arrangement instead of left/right chain. */
  hub?: { id: string; col: number };
  rooms: Record<string, Room>;
}): ZoneDef {
  const ids: string[] = [];
  let mapX = 0;
  let altarRoom = "";
  let bossRoom: string | null = null;
  let chestN = 0;
  const specs: RoomSpec[] = [];
  const roomIdOf = (i: number) => `${opts.prefix}-${i}`;

  opts.plan.forEach((tok, i) => {
    const p = parseToken(tok);
    const id = roomIdOf(i);
    const kind = (p.kind === "faust" ? "boss" : p.kind) as RoomKind;
    const screens = kind === "altar" || kind === "boss" ? 1 : kind === "gate" ? 2 : p.screens;
    const left = i === 0 ? opts.prevRoom : roomIdOf(i - 1);
    const right = i === opts.plan.length - 1 ? null : roomIdOf(i + 1);
    const hasChest = p.flags.includes("c");
    const spec: RoomSpec = {
      id,
      name: `${opts.name} ${i + 1}`,
      castle: opts.castle,
      zone: opts.zone,
      kind,
      screens,
      left,
      right,
      enemies: opts.enemies,
      density: opts.density,
      dark: p.flags.includes("d") || (kind === "gate" && opts.entryGate === "lantern"),
      breakables: p.flags.includes("b") || kind === "altar",
      chest: hasChest ? { key: `${id}:chest`, tier: opts.tierOf(chestN++) } : undefined,
      gate: kind === "gate" ? (opts.entryGate ?? "dash") : undefined,
      boss: kind === "boss" ? (opts.boss ?? undefined) : undefined,
      mapX,
      mapY: opts.mapY,
      doors: [],
    };
    mapX += screens;
    // Side rooms
    for (const f of p.flags) {
      if (f === "s") {
        const sid = `${id}s`;
        specs.push({
          id: sid, name: `${opts.name} Nook`, castle: opts.castle, zone: opts.zone, kind: "side", screens: 1,
          left: null, right: null, enemies: [], density: 0, breakables: true,
          chest: { key: `${sid}:chest`, tier: opts.tierOf(chestN++) }, mapX: mapX - screens, mapY: opts.mapY + 1,
          doors: [{ col: 2, to: id, toCol: 6 }],
        });
        spec.doors!.push({ col: 6, to: sid, toCol: 2 });
      } else if (f.startsWith("k:")) {
        const relic = f.slice(2) as GateKind;
        const kid = `${id}k`;
        specs.push({
          id: kid, name: `${opts.name} Vault`, castle: opts.castle, zone: opts.zone, kind: "gside", screens: 2,
          left: null, right: null, enemies: opts.enemies, density: 1, gate: relic, dark: relic === "lantern",
          crest: { key: `${opts.crestKeyPrefix}`, }, mapX: mapX - screens, mapY: opts.mapY + 1,
          doors: [{ col: 2, to: id, toCol: Math.min(screens * VIEW_COLS - 4, 10) }],
        });
        spec.doors!.push({ col: Math.min(screens * VIEW_COLS - 4, 10), to: kid, toCol: 2 });
      }
    }
    if (kind === "altar") altarRoom = id;
    if (kind === "boss") bossRoom = id;
    ids.push(id);
    specs.push(spec);
  });

  for (const s of specs) {
    opts.rooms[s.id] = buildRoom(s);
    if (s.kind === "side" || s.kind === "gside") ids.push(s.id);
  }
  // Turned zones: add a door back to the hub in the first room, altar room and boss room.
  if (opts.hub) {
    for (const rid of new Set([ids[0], altarRoom, bossRoom ?? ""])) {
      if (!rid) continue;
      const r = opts.rooms[rid];
      const dc = rid === ids[0] ? 2 : 3;
      r.doors.push({ col: dc, to: opts.hub.id, toCol: opts.hub.col });
    }
  }
  return {
    index: opts.zone,
    castle: opts.castle,
    name: opts.name,
    palette: opts.palette,
    rooms: ids,
    first: ids[0],
    altarRoom,
    bossRoom,
    enemies: opts.enemies,
    boss: opts.boss,
  };
}

export function buildMainCastle(tierOf: (zone: number, n: number) => number): World {
  const rooms: Record<string, Room> = {};
  const zones: ZoneDef[] = [];
  let prev: string | null = null;
  for (let z = 0; z < 10; z++) {
    const zd = buildZone({
      castle: "main",
      zone: z,
      prefix: `z${z + 1}`,
      name: ZONE_NAMES[z],
      palette: ZONE_PALETTES[z],
      plan: MAIN_PLANS[z],
      enemies: ZONE_ENEMIES[z],
      boss: MAIN_BOSS[z],
      entryGate: ENTRY_GATE[z],
      density: 1.6 + z * 0.12,
      tierOf: (n) => tierOf(z + 1, n),
      crestKeyPrefix: `crest:main:${z}`,
      mapY: z * 2,
      prevRoom: prev,
      rooms,
    });
    // Chain the previous zone's last main-path room (its boss room, or the last hall of zone 1) to this one.
    if (prev) {
      rooms[prev].right = zd.first;
      openRightEdge(rooms[prev]);
    }
    const mainIds = zd.rooms.filter((id) => !rooms[id].side);
    prev = mainIds[mainIds.length - 1];
    zones.push(zd);
  }
  return { rooms, zones };
}

/** Opens the right wall (rows 8..10) of a room that got a right link after it was built. */
export function openRightEdge(room: Room): void {
  const ch = room.boss ? "X" : " ";
  room.tiles = room.tiles.map((row, r) =>
    r >= 8 && r <= 10 ? row.slice(0, room.cols - 1) + ch : row,
  );
}

/** Boss door requirement: which bosses must be defeated for a `K` tile of a zone to open. */
export function bossDoorNeeds(castle: "main" | "turned", zone: number): number[] {
  if (castle === "main") {
    // Zone index 8 (zone 9) needs bosses of zones 2..8 (indices 0..6); zone index 9 needs zone 9 (index 7).
    if (zone === 8) return [0, 1, 2, 3, 4, 5, 6];
    return [7];
  }
  // Turned: T8 (zone 7) needs T1..T7; arena (zone 8) needs all eight.
  if (zone === 7) return [0, 1, 2, 3, 4, 5, 6];
  return [0, 1, 2, 3, 4, 5, 6, 7];
}

export const TILE_PX = TILE;
