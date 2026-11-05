"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_GAMEPAD_SKIN, type GamepadSkinId } from "@/lib/gamepad";

interface GamepadState {
  /** Wide screens only; ignored below 768px, where the pad is always on. */
  enabled: boolean;
  skin: GamepadSkinId;
  setEnabled: (v: boolean) => void;
  setSkin: (id: GamepadSkinId) => void;
}

const GamepadContext = createContext<GamepadState | null>(null);

/** On-screen gamepad options shared by Nav (menu) and GamePlayer (pad). In memory only. */
export function GamepadProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [skin, setSkin] = useState<GamepadSkinId>(DEFAULT_GAMEPAD_SKIN);
  const value = useMemo(
    () => ({ enabled, skin, setEnabled, setSkin }),
    [enabled, skin],
  );
  return (
    <GamepadContext.Provider value={value}>{children}</GamepadContext.Provider>
  );
}

export function useGamepad(): GamepadState {
  const ctx = useContext(GamepadContext);
  if (!ctx) throw new Error("useGamepad must be used inside GamepadProvider");
  return ctx;
}
