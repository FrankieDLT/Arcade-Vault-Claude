export type GamepadSkinId = "neon" | "retro" | "arcade-80s" | "wood";

export interface GamepadSkin {
  id: GamepadSkinId;
  label: string;
}

export const GAMEPAD_SKINS: GamepadSkin[] = [
  { id: "neon", label: "Neon" },
  { id: "retro", label: "Retro" },
  { id: "arcade-80s", label: "80s Arcade" },
  { id: "wood", label: "Wood" },
];

export const DEFAULT_GAMEPAD_SKIN: GamepadSkinId = "neon";

/** Positions every skin knows how to draw. */
export type PadSlot =
  | "up"
  | "down"
  | "left"
  | "right" // D-pad cross or joystick directions
  | "a"
  | "b" // main round buttons
  | "x"
  | "y"; // small buttons (center pills / top buttons)

/** The arcade skins draw a joystick for the four direction slots; the others draw a cross of buttons. */
export const usesJoystick = (skin: GamepadSkinId): boolean =>
  skin === "arcade-80s" || skin === "wood";
