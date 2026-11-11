import { withBasePath } from "@/lib/base-path";
import type { ComponentType } from "react";
import { SpaceVoyageCanvas } from "@/components/space-voyage-canvas";
import { WallWreckerCanvas } from "@/components/wall-wrecker-canvas";
import { StreetJumperCanvas } from "@/components/street-jumper-canvas";
import { GalacticDogfightCanvas } from "@/components/galactic-dogfight-canvas";
import { GlowmawCanvas } from "@/components/glowmaw-canvas";
import { RoboVaultCanvas } from "@/components/robo-vault-canvas";
import { WingshotCanvas } from "@/components/wingshot-canvas";
import { VampireHunterCanvas } from "@/components/vampire-hunter-canvas";
import { SuperTennisCanvas } from "@/components/super-tennis-canvas";
import { SnakeCanvas } from "@/components/snake-canvas";
import { AlienAttackCanvas } from "@/components/alien-attack-canvas";
import { BlockRainCanvas } from "@/components/block-rain-canvas";
import type { BlockRainTheme } from "@/lib/block-rain/constants";
import type { PadSlot } from "@/lib/gamepad";

/** Props every game canvas accepts; a canvas ignores the ones its engine does not have. */
export interface GameCanvasProps {
  paused: boolean;
  /** Increment to end the run immediately (0 = not requested). */
  endSignal: number;
  onScore: (score: number) => void;
  onGameOver: (finalScore: number) => void;
  onLives?: (lives: number) => void;
  onLevel?: (level: number) => void;
  onLines?: (lines: number) => void;
  /** Skin id from `appearance.skins`; each canvas narrows it with a guard and falls back to its default. */
  skin?: string;
  theme?: BlockRainTheme;
  /** Sound events from the engine; the platform plays them. */
  onSound?: (sound: string) => void;
  /** Robo Vault: a boss was defeated (`frostbyte`, `rematch:frostbyte`, `sam`, ...). Signed-in players earn 1 credit each. */
  onBossDefeated?: (boss: string) => void;
  /** Marcy the Vampire Hunter: a Credit Coin was collected. Signed-in players earn 1 credit. */
  onCreditDrop?: () => void;
  /** Marcy the Vampire Hunter: false for guests (no coin roll). Read by the engine at every roll. */
  canDropCredit?: () => boolean;
  /** Track switch for entries whose `music` has an `alt` track: "boss" = alt, "stage" = main. */
  onMusic?: (track: "stage" | "boss") => void;
  /** Haptic events from the engine ("clear", "quad", "split", "fruit", "bonus"); the platform vibrates. */
  onHaptic?: (name: string) => void;
  /** A change of `id` asks the engine to jump to `level` (level select in the PAUSED overlay). */
  levelRequest?: { level: number; id: number };
  /** Mode id from `modes`, fixed for the run. Only sent to entries that define `modes`. */
  mode?: string;
  /** Difficulty id from `difficultySelect`. Only sent to entries that define it. */
  difficulty?: string;
}

export interface TouchButton {
  /** KeyboardEvent.code the engine already reads, e.g. "ArrowLeft", "Space", "KeyS". */
  code: string;
  label: string;
  /** Key stays down while the finger is down (move, thrust, soft drop, slow fall). Taps fire down then up. */
  hold?: boolean;
  /** Where the active skin draws this control. */
  slot: PadSlot;
}

export interface GameDefinition {
  Canvas: ComponentType<GameCanvasProps>;
  /** Controls hint under the CRT. */
  controls: { keys: string[]; label: string }[];
  /** HUD stats the engine reports. LIVES and LINES share one HUD slot. */
  stats: { lives: boolean; lines: boolean; level: boolean };
  /** Label of the lines slot when `stats.lines` is on (default "Lines"). */
  linesLabel?: string;
  /** Optional background track. Absent = no audio and no mute button. */
  music?: {
    src: string;
    volume: number;
    /** Optional second track (Robo Vault: boss fights). The engine picks it with `onMusic`. */
    alt?: { src: string; volume: number };
  };
  /** Optional SKIN / THEME buttons under the CRT. They only change what the canvas draws. */
  appearance?: { skins: { id: string; label: string }[]; themes: boolean };
  /** Optional sound effects, played by the platform on engine `onSound` events. */
  sfx?: {
    sounds: Record<string, string>;
    volume: number;
    /** Also show a SOUND ON/OFF button in the PAUSED overlay (same shared mute state). */
    pauseToggle?: boolean;
  };
  /** Optional level selector in the PAUSED overlay. */
  levelSelect?: { min: number; max: number };
  /** Optional mode picker shown on the CRT before the run starts. The mode is fixed per run. */
  modes?: { id: string; label: string; hint: string }[];
  /** Optional difficulty selector in the PAUSED overlay, shown only in the listed modes. */
  difficultySelect?: {
    options: { id: string; label: string }[];
    default: string;
    onlyModes: string[];
  };
  /** Optional touch controls (phones). The pad and the hint show below 768px only. */
  touch?: {
    pad?: TouchButton[];
    swipe?: boolean;
    /** Replaces `controls` in the hint under the CRT on viewports below 768px. */
    hint: { keys: string[]; label: string }[];
  };
}

// Games without an entry keep the fake simulation in GamePlayer.
export const GAME_REGISTRY: Record<string, GameDefinition> = {
  "space-voyage": {
    Canvas: SpaceVoyageCanvas,
    controls: [
      { keys: ["←", "→"], label: "ROTATE" },
      { keys: ["↑"], label: "THRUST" },
      { keys: ["SPACE"], label: "FIRE" },
    ],
    stats: { lives: true, lines: false, level: true },
    appearance: {
      skins: [
        { id: "retro", label: "RETRO" },
        { id: "neon", label: "NEON" },
        { id: "pastel", label: "PASTEL" },
        { id: "gothic", label: "GOTHIC" },
        { id: "negative", label: "NEGATIVE" },
        { id: "amber-crt", label: "AMBER CRT" },
        { id: "deep-sea", label: "DEEP SEA" },
      ],
      themes: false,
    },
    touch: {
      pad: [
        { code: "ArrowLeft", label: "◀", hold: true, slot: "left" },
        { code: "ArrowRight", label: "▶", hold: true, slot: "right" },
        { code: "ArrowUp", label: "▲", hold: true, slot: "up" },
        { code: "ArrowUp", label: "THRUST", hold: true, slot: "b" },
        { code: "Space", label: "FIRE", hold: true, slot: "a" },
      ],
      hint: [
        { keys: ["◀", "▶"], label: "ROTATE" },
        { keys: ["THRUST"], label: "HOLD TO FLY" },
        { keys: ["FIRE"], label: "SHOOT" },
      ],
    },
  },
  "block-rain": {
    Canvas: BlockRainCanvas,
    controls: [
      { keys: ["←", "→"], label: "MOVE" },
      { keys: ["↑", "X"], label: "ROTATE" },
      { keys: ["↓"], label: "SOFT DROP" },
      { keys: ["SPACE"], label: "HARD DROP" },
      { keys: ["S"], label: "HOLD" },
      { keys: ["C"], label: "SLOW FALL" },
    ],
    stats: { lives: false, lines: true, level: true },
    music: {
      src: withBasePath("/game-assets/block-rain/korobeiniki.mp3"),
      volume: 0.2,
    },
    appearance: {
      skins: [
        { id: "retro", label: "RETRO" },
        { id: "neon", label: "NEON" },
        { id: "pastel", label: "PASTEL" },
        { id: "gothic", label: "GOTHIC" },
        { id: "negative", label: "NEGATIVE" },
        { id: "woodshop", label: "WOODSHOP" },
        { id: "ice-cavern", label: "ICE CAVERN" },
        { id: "pixel", label: "PIXEL ART" },
      ],
      themes: true,
    },
    touch: {
      pad: [
        { code: "ArrowLeft", label: "◀", hold: true, slot: "left" },
        { code: "ArrowRight", label: "▶", hold: true, slot: "right" },
        { code: "ArrowDown", label: "▼", hold: true, slot: "down" },
        { code: "ArrowUp", label: "⟳", slot: "up" },
        { code: "ArrowUp", label: "⟳", slot: "a" },
        { code: "Space", label: "DROP", slot: "b" },
        { code: "KeyS", label: "HOLD", slot: "x" },
        { code: "KeyC", label: "SLOW", hold: true, slot: "y" },
      ],
      hint: [
        { keys: ["◀", "▶", "▼"], label: "MOVE" },
        { keys: ["⟳"], label: "ROTATE" },
        { keys: ["DROP"], label: "HARD DROP" },
      ],
    },
  },
  "wall-wrecker": {
    Canvas: WallWreckerCanvas,
    controls: [
      { keys: ["←", "→"], label: "MOVE" },
      { keys: ["MOUSE"], label: "PADDLE" },
      { keys: ["SPACE", "CLICK"], label: "LAUNCH" },
    ],
    stats: { lives: true, lines: false, level: true },
    appearance: {
      skins: [
        { id: "retro", label: "RETRO" },
        { id: "pastel", label: "PASTEL" },
        { id: "neon", label: "NEON" },
      ],
      themes: false,
    },
    sfx: {
      sounds: {
        bounce: withBasePath("/game-assets/wall-wrecker/ball-bounce.wav"),
        brick: withBasePath("/game-assets/wall-wrecker/break-sound.wav"),
      },
      volume: 1,
    },
    levelSelect: { min: 1, max: 99 },
    touch: {
      hint: [
        { keys: ["DRAG"], label: "MOVE" },
        { keys: ["TAP"], label: "LAUNCH" },
      ],
    },
  },
  snake: {
    Canvas: SnakeCanvas,
    controls: [
      { keys: ["←", "↑", "→", "↓"], label: "STEER" },
      { keys: ["W", "A", "S", "D"], label: "STEER" },
    ],
    stats: { lives: false, lines: true, level: false },
    linesLabel: "Length",
    appearance: {
      skins: [
        { id: "retro", label: "RETRO" },
        { id: "neon", label: "NEON" },
        { id: "pastel", label: "PASTEL" },
        { id: "gothic", label: "GOTHIC" },
        { id: "negative", label: "NEGATIVE" },
        { id: "lcd-brick", label: "LCD BRICK" },
        { id: "magma", label: "MAGMA" },
      ],
      themes: false,
    },
    touch: {
      swipe: true,
      hint: [{ keys: ["SWIPE"], label: "STEER" }],
    },
  },
  glowmaw: {
    Canvas: GlowmawCanvas,
    controls: [
      { keys: ["←", "↑", "→", "↓"], label: "MOVE" },
      { keys: ["W", "A", "S", "D"], label: "MOVE" },
    ],
    stats: { lives: true, lines: false, level: true },
    appearance: {
      skins: [
        { id: "abyss", label: "ABYSS" },
        { id: "retro", label: "RETRO" },
        { id: "neon", label: "NEON" },
        { id: "pastel", label: "PASTEL" },
        { id: "gothic", label: "GOTHIC" },
        { id: "negative", label: "NEGATIVE" },
        { id: "coral", label: "CORAL" },
        { id: "sunken-ruin", label: "SUNKEN RUIN" },
        { id: "paper-lantern", label: "PAPER LANTERN" },
      ],
      themes: false,
    },
    levelSelect: { min: 1, max: 99 },
    touch: {
      pad: [
        { code: "ArrowLeft", label: "◀", slot: "left" },
        { code: "ArrowRight", label: "▶", slot: "right" },
        { code: "ArrowUp", label: "▲", slot: "up" },
        { code: "ArrowDown", label: "▼", slot: "down" },
      ],
      hint: [{ keys: ["◀", "▲", "▼", "▶"], label: "STEER" }],
    },
  },
  "street-jumper": {
    Canvas: StreetJumperCanvas,
    controls: [
      { keys: ["←", "↑", "→", "↓"], label: "HOP" },
      { keys: ["W", "A", "S", "D"], label: "HOP" },
    ],
    stats: { lives: true, lines: false, level: true },
    appearance: {
      skins: [
        { id: "retro", label: "RETRO" },
        { id: "neon", label: "NEON" },
        { id: "pastel", label: "PASTEL" },
        { id: "gothic", label: "GOTHIC" },
        { id: "negative", label: "NEGATIVE" },
        { id: "tide-poster", label: "TIDE POSTER" },
        { id: "midnight-toll", label: "MIDNIGHT TOLL" },
      ],
      themes: false,
    },
    touch: {
      pad: [
        { code: "ArrowLeft", label: "◀", slot: "left" },
        { code: "ArrowRight", label: "▶", slot: "right" },
        { code: "ArrowUp", label: "▲", slot: "up" },
        { code: "ArrowDown", label: "▼", slot: "down" },
      ],
      hint: [{ keys: ["◀", "▲", "▼", "▶"], label: "HOP" }],
    },
  },
  "super-tennis": {
    Canvas: SuperTennisCanvas,
    controls: [
      { keys: ["W", "S"], label: "PLAYER 1" },
      { keys: ["↑", "↓"], label: "PLAYER 2 / PVE" },
    ],
    stats: { lives: false, lines: false, level: false },
    sfx: {
      sounds: {
        paddle: withBasePath("/game-assets/super-tennis/paddle.wav"),
        goal: withBasePath("/game-assets/super-tennis/goal.wav"),
        gameover: withBasePath("/game-assets/super-tennis/gameover.wav"),
      },
      volume: 0.2,
      pauseToggle: true,
    },
    modes: [
      { id: "pve", label: "PVE", hint: "YOU VS THE CPU" },
      { id: "pvp", label: "PVP", hint: "2 PLAYERS, ONE SCREEN" },
    ],
    difficultySelect: {
      options: [
        { id: "easy", label: "EASY" },
        { id: "normal", label: "NORMAL" },
        { id: "hard", label: "HARD" },
      ],
      default: "normal",
      onlyModes: ["pve"],
    },
    appearance: {
      skins: [
        { id: "retro", label: "RETRO" },
        { id: "neon", label: "NEON" },
        { id: "pastel", label: "PASTEL" },
        { id: "gothic", label: "GOTHIC" },
        { id: "negative", label: "NEGATIVE" },
        { id: "phosphor", label: "PHOSPHOR" },
        { id: "clay-court", label: "CLAY COURT" },
      ],
      themes: false,
    },
    touch: {
      // d-pad / joystick = Player 1 (KeyW / KeyS); A / B = Player 2 (arrows). In PvE both move the human paddle.
      pad: [
        { code: "KeyW", label: "▲", slot: "up", hold: true },
        { code: "KeyS", label: "▼", slot: "down", hold: true },
        { code: "ArrowUp", label: "P2 ▲", slot: "a", hold: true },
        { code: "ArrowDown", label: "P2 ▼", slot: "b", hold: true },
      ],
      hint: [
        { keys: ["D-PAD"], label: "PLAYER 1" },
        { keys: ["A", "B"], label: "PLAYER 2 UP / DOWN" },
      ],
    },
  },
  "alien-attack": {
    Canvas: AlienAttackCanvas,
    controls: [
      { keys: ["←", "→"], label: "MOVE" },
      { keys: ["SPACE"], label: "FIRE" },
    ],
    stats: { lives: true, lines: false, level: true },
    levelSelect: { min: 1, max: 99 },
    sfx: {
      sounds: {
        shoot: withBasePath("/game-assets/alien-attack/shoot.wav"),
        hit: withBasePath("/game-assets/alien-attack/hit.wav"),
        boom: withBasePath("/game-assets/alien-attack/boom.wav"),
        gameover: withBasePath("/game-assets/alien-attack/gameover.wav"),
      },
      volume: 0.2,
    },
    appearance: {
      skins: [
        { id: "retro", label: "RETRO" },
        { id: "neon", label: "NEON" },
        { id: "pastel", label: "PASTEL" },
        { id: "gothic", label: "GOTHIC" },
        { id: "negative", label: "NEGATIVE" },
        { id: "blueprint", label: "BLUEPRINT" },
        { id: "newsprint", label: "NEWSPRINT" },
      ],
      themes: false,
    },
    touch: {
      // left / right move the cannon; A fires (hold = keeps firing as bullets clear).
      pad: [
        { code: "ArrowLeft", label: "◀", slot: "left", hold: true },
        { code: "ArrowRight", label: "▶", slot: "right", hold: true },
        { code: "Space", label: "FIRE", slot: "a", hold: true },
      ],
      hint: [
        { keys: ["◀", "▶"], label: "MOVE" },
        { keys: ["FIRE"], label: "SHOOT" },
      ],
    },
  },
  "galactic-dogfight": {
    Canvas: GalacticDogfightCanvas,
    controls: [
      { keys: ["←", "→"], label: "MOVE" },
      { keys: ["SPACE"], label: "FIRE" },
    ],
    stats: { lives: true, lines: false, level: true },
    music: {
      src: withBasePath("/game-assets/galactic-dogfight/music.wav"),
      volume: 0.12,
    },
    sfx: {
      sounds: {
        shoot: withBasePath("/game-assets/galactic-dogfight/shoot.wav"),
        hit: withBasePath("/game-assets/galactic-dogfight/hit.wav"),
        bossHit: withBasePath("/game-assets/galactic-dogfight/boss-hit.wav"),
        death: withBasePath("/game-assets/galactic-dogfight/death.wav"),
        gameover: withBasePath("/game-assets/galactic-dogfight/gameover.wav"),
        stageStart: withBasePath(
          "/game-assets/galactic-dogfight/stage-start.wav",
        ),
        beam: withBasePath("/game-assets/galactic-dogfight/beam.wav"),
        capture: withBasePath("/game-assets/galactic-dogfight/capture.wav"),
        rescue: withBasePath("/game-assets/galactic-dogfight/rescue.wav"),
        challenge: withBasePath("/game-assets/galactic-dogfight/challenge.wav"),
        perfect: withBasePath("/game-assets/galactic-dogfight/perfect.wav"),
        extraLife: withBasePath(
          "/game-assets/galactic-dogfight/extra-life.wav",
        ),
      },
      volume: 0.2,
    },
    appearance: {
      skins: [
        { id: "retro", label: "RETRO" },
        { id: "neon", label: "NEON" },
        { id: "pastel", label: "PASTEL" },
        { id: "gothic", label: "GOTHIC" },
        { id: "negative", label: "NEGATIVE" },
        { id: "sunset-drive", label: "SUNSET DRIVE" },
        { id: "chalkboard", label: "CHALKBOARD" },
      ],
      themes: false,
    },
    touch: {
      // left / right move the fighter; A fires (hold = keeps firing).
      pad: [
        { code: "ArrowLeft", label: "◀", slot: "left", hold: true },
        { code: "ArrowRight", label: "▶", slot: "right", hold: true },
        { code: "Space", label: "FIRE", slot: "a", hold: true },
      ],
      hint: [
        { keys: ["◀", "▶"], label: "MOVE" },
        { keys: ["FIRE"], label: "SHOOT" },
      ],
    },
  },
  "robo-vault": {
    Canvas: RoboVaultCanvas,
    controls: [
      { keys: ["←", "→"], label: "MOVE" },
      { keys: ["SPACE"], label: "JUMP" },
      { keys: ["X"], label: "SHOOT" },
      { keys: ["↑", "X"], label: "SHOOT UP" },
      { keys: ["↓", "X"], label: "CROUCH SHOOT" },
      { keys: ["Q", "E"], label: "WEAPON" },
    ],
    stats: { lives: true, lines: false, level: true },
    appearance: {
      skins: [
        { id: "retro", label: "RETRO" },
        { id: "neon", label: "NEON" },
        { id: "pastel", label: "PASTEL" },
        { id: "gothic", label: "GOTHIC" },
        { id: "negative", label: "NEGATIVE" },
        { id: "lcd-handheld", label: "LCD HANDHELD" },
        { id: "sepia-reel", label: "SEPIA REEL" },
      ],
      themes: false,
    },
    music: {
      src: withBasePath("/game-assets/robo-vault/music.wav"),
      volume: 0.12,
      // Heavy-metal inspired track for boss fights.
      alt: {
        src: withBasePath("/game-assets/robo-vault/music-boss.wav"),
        volume: 0.18,
      },
    },
    sfx: {
      sounds: {
        shoot: withBasePath("/game-assets/robo-vault/shoot.wav"),
        jump: withBasePath("/game-assets/robo-vault/jump.wav"),
        hit: withBasePath("/game-assets/robo-vault/hit.wav"),
        enemyDie: withBasePath("/game-assets/robo-vault/enemy-die.wav"),
        bossHit: withBasePath("/game-assets/robo-vault/boss-hit.wav"),
        bossDie: withBasePath("/game-assets/robo-vault/boss-die.wav"),
        pickup: withBasePath("/game-assets/robo-vault/pickup.wav"),
        weapon: withBasePath("/game-assets/robo-vault/weapon.wav"),
        death: withBasePath("/game-assets/robo-vault/death.wav"),
        gameover: withBasePath("/game-assets/robo-vault/gameover.wav"),
        select: withBasePath("/game-assets/robo-vault/select.wav"),
        victory: withBasePath("/game-assets/robo-vault/victory.wav"),
        bossTick: withBasePath("/game-assets/robo-vault/boss-tick.wav"),
      },
      volume: 0.2,
    },
    touch: {
      // left / right move; A jumps (hold = higher); B shoots (hold = auto-fire);
      // X / Y cycle weapons; up / down also move the menu cursor.
      pad: [
        { code: "ArrowLeft", label: "◀", slot: "left", hold: true },
        { code: "ArrowRight", label: "▶", slot: "right", hold: true },
        { code: "ArrowUp", label: "▲", slot: "up", hold: true },
        { code: "ArrowDown", label: "▼", slot: "down", hold: true },
        { code: "Space", label: "JUMP", slot: "a", hold: true },
        { code: "KeyX", label: "SHOOT", slot: "b", hold: true },
        { code: "KeyQ", label: "◀ W", slot: "x" },
        { code: "KeyE", label: "W ▶", slot: "y" },
      ],
      hint: [
        { keys: ["◀", "▶"], label: "MOVE" },
        { keys: ["JUMP"], label: "HOLD = HIGHER" },
        { keys: ["SHOOT"], label: "HOLD = AUTO-FIRE" },
        { keys: ["▲", "SHOOT"], label: "SHOOT UP" },
        { keys: ["▼", "SHOOT"], label: "CROUCH SHOOT" },
        { keys: ["◀ W", "W ▶"], label: "WEAPON" },
      ],
    },
  },
  "marcy-vampire-hunter": {
    Canvas: VampireHunterCanvas,
    controls: [
      { keys: ["←", "→"], label: "MOVE" },
      { keys: ["SPACE"], label: "JUMP" },
      { keys: ["X"], label: "ATTACK" },
      { keys: ["C"], label: "SPECIAL" },
      { keys: ["Z"], label: "DASH" },
      { keys: ["↑"], label: "INTERACT" },
      { keys: ["ENTER"], label: "MENU" },
    ],
    stats: { lives: true, lines: false, level: true },
    music: {
      src: withBasePath("/game-assets/marcy-vampire-hunter/music.wav"),
      volume: 0.12,
      // Faster, pounding organ track for boss fights.
      alt: {
        src: withBasePath("/game-assets/marcy-vampire-hunter/music-boss.wav"),
        volume: 0.18,
      },
    },
    sfx: {
      sounds: {
        whip: withBasePath("/game-assets/marcy-vampire-hunter/whip.wav"),
        slash: withBasePath("/game-assets/marcy-vampire-hunter/slash.wav"),
        hit: withBasePath("/game-assets/marcy-vampire-hunter/hit.wav"),
        enemyDie: withBasePath(
          "/game-assets/marcy-vampire-hunter/enemy-die.wav",
        ),
        bossHit: withBasePath("/game-assets/marcy-vampire-hunter/boss-hit.wav"),
        bossTick: withBasePath(
          "/game-assets/marcy-vampire-hunter/boss-tick.wav",
        ),
        bossDie: withBasePath("/game-assets/marcy-vampire-hunter/boss-die.wav"),
        pickup: withBasePath("/game-assets/marcy-vampire-hunter/pickup.wav"),
        relic: withBasePath("/game-assets/marcy-vampire-hunter/relic.wav"),
        levelUp: withBasePath("/game-assets/marcy-vampire-hunter/level-up.wav"),
        jump: withBasePath("/game-assets/marcy-vampire-hunter/jump.wav"),
        dash: withBasePath("/game-assets/marcy-vampire-hunter/dash.wav"),
        save: withBasePath("/game-assets/marcy-vampire-hunter/save.wav"),
        death: withBasePath("/game-assets/marcy-vampire-hunter/death.wav"),
        gameover: withBasePath(
          "/game-assets/marcy-vampire-hunter/gameover.wav",
        ),
        select: withBasePath("/game-assets/marcy-vampire-hunter/select.wav"),
        victory: withBasePath("/game-assets/marcy-vampire-hunter/victory.wav"),
        turn: withBasePath("/game-assets/marcy-vampire-hunter/turn.wav"),
        credit: withBasePath("/game-assets/marcy-vampire-hunter/credit.wav"),
      },
      volume: 0.2,
    },
    touch: {
      // left / right / up / down move (up = interact, up + attack = attack up, down = crouch);
      // A jumps (hold = higher); B attacks; X special art; Y dash. The MENU tag in the canvas opens the menu.
      pad: [
        { code: "ArrowLeft", label: "◀", slot: "left", hold: true },
        { code: "ArrowRight", label: "▶", slot: "right", hold: true },
        { code: "ArrowUp", label: "▲", slot: "up", hold: true },
        { code: "ArrowDown", label: "▼", slot: "down", hold: true },
        { code: "Space", label: "JUMP", slot: "a", hold: true },
        { code: "KeyX", label: "ATTACK", slot: "b", hold: true },
        { code: "KeyC", label: "SPECIAL", slot: "x" },
        { code: "KeyZ", label: "DASH", slot: "y" },
      ],
      hint: [
        { keys: ["◀", "▶"], label: "MOVE" },
        { keys: ["JUMP"], label: "HOLD = HIGHER" },
        { keys: ["ATTACK"], label: "HOLD = REPEAT" },
        { keys: ["▲"], label: "INTERACT" },
        { keys: ["SPECIAL", "DASH"], label: "ARTS" },
        { keys: ["MENU TAG"], label: "OPEN MENU" },
      ],
    },
  },
  wingshot: {
    Canvas: WingshotCanvas,
    controls: [
      { keys: ["CLICK", "TAP"], label: "SHOOT" },
      { keys: ["3 SHOTS"], label: "PER WAVE" },
      { keys: ["QUOTA"], label: "CLEARS THE ROUND" },
    ],
    stats: { lives: false, lines: true, level: true },
    linesLabel: "Hits",
    appearance: {
      skins: [
        { id: "retro", label: "RETRO" },
        { id: "neon", label: "NEON" },
        { id: "pastel", label: "PASTEL" },
        { id: "gothic", label: "GOTHIC" },
        { id: "negative", label: "NEGATIVE" },
        { id: "golden-hour", label: "GOLDEN HOUR" },
        { id: "ink-wash", label: "INK WASH" },
      ],
      themes: false,
    },
    sfx: {
      sounds: {
        shot: withBasePath("/game-assets/wingshot/shot.wav"),
        hit: withBasePath("/game-assets/wingshot/hit.wav"),
        rare: withBasePath("/game-assets/wingshot/rare.wav"),
        escape: withBasePath("/game-assets/wingshot/escape.wav"),
        decoy: withBasePath("/game-assets/wingshot/decoy.wav"),
        roundStart: withBasePath("/game-assets/wingshot/roundStart.wav"),
        roundClear: withBasePath("/game-assets/wingshot/roundClear.wav"),
        perfect: withBasePath("/game-assets/wingshot/perfect.wav"),
        gameover: withBasePath("/game-assets/wingshot/gameover.wav"),
        cheer: withBasePath("/game-assets/wingshot/cheer.wav"),
        blooper: withBasePath("/game-assets/wingshot/blooper.wav"),
      },
      volume: 0.2,
    },
    touch: {
      // No pad: the whole game is a tap on the canvas.
      hint: [
        { keys: ["TAP"], label: "SHOOT" },
        { keys: ["3 SHOTS"], label: "PER WAVE" },
      ],
    },
  },
};

export const getGameDefinition = (
  gameId: string,
): GameDefinition | undefined =>
  Object.hasOwn(GAME_REGISTRY, gameId) ? GAME_REGISTRY[gameId] : undefined;
