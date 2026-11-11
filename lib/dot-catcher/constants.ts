// Dot Catcher is a Java game (java/dot-catcher/). This folder holds only the TypeScript glue:
// the canvas size and the skin palettes. Java receives a palette and copies the four strings.

// Logical canvas size. CSS scales the canvas to fit the screen. Keep in sync with Constants.java.
export const W = 800;
export const H = 600;

export interface SkinColors {
  background: string;
  floor: string;
  paddle: string;
  dot: string;
}

// Every skin is just a set of colors. Add more here and list them in the registry.
// Adding a skin never needs a Java rebuild.
export const SKINS = {
  retro: {
    background: "#0a0a12",
    floor: "#3a3a55",
    paddle: "#f5ff00",
    dot: "#00f5ff",
  },
  neon: {
    background: "#050014",
    floor: "#ff006e",
    paddle: "#00ff88",
    dot: "#ff006e",
  },
  pastel: {
    background: "#fbf4ec",
    floor: "#cfc3d6",
    paddle: "#6f86c8",
    dot: "#c4527a",
  },
  gothic: {
    background: "#0b0710",
    floor: "#8a8d94",
    paddle: "#e8e0cc",
    dot: "#d41f3f",
  },
  // Computed inverse of retro (each channel 255 - value), dot nudged to #e00a00 only for the 3:1 rule margin.
  negative: {
    background: "#f5f5ed",
    floor: "#c5c5aa",
    paddle: "#0a00ff",
    dot: "#e00a00",
  },
  "amber-crt": {
    background: "#120a00",
    floor: "#5a3a00",
    paddle: "#ffb000",
    dot: "#ff6a00",
  },
  blueprint: {
    background: "#0b2a55",
    floor: "#4f7bc0",
    paddle: "#ffffff",
    dot: "#ffd23f",
  },
} satisfies Record<string, SkinColors>;

export type DotCatcherSkin = keyof typeof SKINS;

/** Narrows any skin id from the platform to a known skin; unknown ids fall back to "retro". */
export const toSkin = (skin: string | undefined): DotCatcherSkin =>
  skin !== undefined && Object.hasOwn(SKINS, skin)
    ? (skin as DotCatcherSkin)
    : "retro";
