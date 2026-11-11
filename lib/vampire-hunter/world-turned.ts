// Marcy the Vampire Hunter: the Turned Castle (SPEC 22). Eight zones and the Hollow Throne arena,
// all new rooms (not flipped copies). Decor is drawn flipped by the engine; collision is never flipped.
// Pure data, no react or next imports.
import { TURNED_NAMES, TURNED_PALETTES } from "./constants";
import { turnedTier } from "./items";
import { buildRoom, buildZone, type Door, type Room, type World, type ZoneDef } from "./world";

export const HUB_ID = "t-hub";

export interface TurnedZone extends ZoneDef {
  id: "T1" | "T2" | "T3" | "T4" | "T5" | "T6" | "T7" | "T8" | "ARENA";
  /** Main zone it mirrors (2..10). */
  mirrors: number;
}

const TURNED_ENEMIES: string[][] = [
  ["cinderpriest", "hollowskel", "bellwraith"],
  ["marrowcrawler", "hollowbone", "crimsonbat"],
  ["brinelurker", "hollowwraith", "crimsonbat"],
  ["cogreaper", "hollowgear", "cinderskull"],
  ["inkblot", "bookswarm", "spirewraith"],
  ["briarthrower", "rootgrabber", "hollowghoul"],
  ["gravewarden", "hollowgarg", "bellwraith"],
  ["hollowknight", "cinderskull", "crimsonbat"],
  ["hollowknight", "spirewraith", "crimsonbat"],
];

const TURNED_BOSS = [
  "cinder-cantor",
  "marrow-titan",
  "brine-matron",
  "pendulum-reaper",
  "inkbound-scribe",
  "briar-empress",
  "gargoyle-tyrant",
  "crimson-regent",
  "hollow-king",
];

const TURNED_PLANS: string[][] = [
  ["hall:3*b", "pit:3", "altar", "tower:2*c*k:leap", "boss"],
  ["hall:3", "corr:3*c", "altar", "pit:3*b*k:mist", "boss"],
  ["pit:3", "hall:3*c", "altar", "tower:3*s*k:glide", "boss"],
  ["hall:3*b", "tower:3", "altar", "corr:3*c*k:sigil", "boss"],
  ["corr:3", "hall:3*c", "altar", "pit:3*k:lantern", "boss"],
  ["hall:3", "tower:3*c", "altar", "stairs:2*b*k:dash", "boss"],
  ["pit:3", "tower:3", "altar", "hall:3*c*s*k:mist", "boss"],
  ["hall:3", "pit:3*c", "altar", "tower:3*k:glide", "boss"],
  ["altar", "boss"],
];

const IDS: TurnedZone["id"][] = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "ARENA"];

export function buildTurnedCastle(): World {
  const rooms: Record<string, Room> = {};
  const zones: TurnedZone[] = [];

  // Hub: the Upturned Nave, with one door per Turned zone and one to the Hollow Throne.
  const doors: Door[] = [];
  for (let i = 0; i < 9; i++) {
    const needsTurned = i === 7 ? [0, 1, 2, 3, 4, 5, 6] : i === 8 ? [0, 1, 2, 3, 4, 5, 6, 7] : undefined;
    doors.push({ col: 3 + i * 3, to: `t${i + 1}-0`, toCol: 2, needsTurned });
  }
  rooms[HUB_ID] = buildRoom({
    id: HUB_ID,
    name: "Upturned Nave",
    castle: "turned",
    zone: 0,
    kind: "hub",
    screens: 2,
    left: null,
    right: null,
    enemies: [],
    density: 0,
    breakables: true,
    mapX: 0,
    mapY: 0,
    doors,
  });

  for (let i = 0; i < 9; i++) {
    const zd = buildZone({
      castle: "turned",
      zone: i,
      prefix: `t${i + 1}`,
      name: TURNED_NAMES[i],
      palette: TURNED_PALETTES[i],
      plan: TURNED_PLANS[i],
      enemies: TURNED_ENEMIES[i],
      boss: TURNED_BOSS[i],
      entryGate: null,
      density: 2.2,
      tierOf: () => turnedTier(i),
      crestKeyPrefix: `crest:turned:${i}`,
      mapY: 2 + i * 2,
      prevRoom: null,
      hub: { id: HUB_ID, col: 3 + i * 3 },
      rooms,
    });
    zones.push({ ...zd, id: IDS[i], mirrors: i + 2 });
  }
  return { rooms, zones };
}
