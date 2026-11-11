// Marcy the Vampire Hunter equipment tables. Pure data, no react or next imports.
import type { Hero, Slot } from "./password";

const ADJ = [
  "Frayed", "Iron", "Silver", "Rowan", "Gilded", "Blood", "Ash", "Obsidian",
  "Moon", "Thorn", "Oath", "Gravebound", "Hollow", "Starfall", "Void",
];

const NOUN: Record<Slot, string> = {
  weapon: "",
  head: "Hood",
  body: "Mail",
  cloak: "Cloak",
  ring: "Ring",
};

/** Equipment name for a slot and tier (1..15). Tier 0 is empty. */
export function itemName(slot: Slot, tier: number, hero: Hero): string {
  if (tier <= 0) return "NONE";
  const adj = ADJ[Math.min(14, tier - 1)];
  if (slot === "weapon") return `${adj} ${hero === "marcy" ? "Whip" : "Sword"}`.toUpperCase();
  return `${adj} ${NOUN[slot]}`.toUpperCase();
}

/** Stat bonus of a tier (strict upgrade: bigger tier, bigger bonus). */
export function tierBonus(tier: number): number {
  return Math.max(0, tier);
}

export type Element = "none" | "fire" | "holy";

/** Weapon element by tier: fire at 4-5, 9-10 and 14; holy at 6-7, 11-12 and 15. */
export function weaponElement(tier: number): Element {
  if (tier === 4 || tier === 5 || tier === 9 || tier === 10 || tier === 14) return "fire";
  if (tier === 6 || tier === 7 || tier === 11 || tier === 12 || tier === 15) return "holy";
  return "none";
}

export const SLOT_LABEL: Record<Slot, string> = {
  weapon: "WEAPON",
  head: "HEAD",
  body: "BODY",
  cloak: "CLOAK",
  ring: "RING",
};

/** Tier a main castle zone (1..10) gives: a roll between zone-2 and zone (capped at 10). */
export function mainTier(zone: number, roll: number): number {
  const hi = Math.min(10, zone);
  const lo = Math.max(1, hi - 2);
  return lo + Math.min(hi - lo, Math.floor(roll * (hi - lo + 1)));
}

/** Tier of a Turned zone (index 0..7) or the arena (8): tiers 11 to 15. */
export function turnedTier(index: number): number {
  return Math.min(15, 11 + Math.floor((index * 5) / 8));
}
