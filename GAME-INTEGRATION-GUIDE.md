# Game Integration Guide

A step-by-step manual for building a new game **by hand** and plugging it into Arcade Vault so that it works with the library, the player page, the leaderboards, the credits system and the Supabase backend.

This guide is written for a developer who is new to the project. You should know basic TypeScript and HTML. You do not need to know React, Next.js, canvas games or Supabase beforehand: each of those is explained at the moment you need it, together with the reason behind every rule.

---

## Table of contents

0. [Introduction and prerequisites](#0-introduction-and-prerequisites)
1. [The big picture](#1-the-big-picture-how-a-game-plugs-into-arcade-vault)
2. [Before you start: things to keep in mind](#2-before-you-start-things-to-keep-in-mind)
3. [Step 1: Build the engine](#3-step-1-build-the-engine)
4. [Step 2: Write the canvas wrapper](#4-step-2-write-the-canvas-wrapper)
5. [Step 3: Register the game](#5-step-3-register-the-game)
6. [Step 4: Add the game to the catalog and draw its cover](#6-step-4-add-the-game-to-the-catalog-and-draw-its-cover)
7. [Step 5: Connect the game to the backend (Supabase)](#7-step-5-connect-the-game-to-the-backend-supabase)
8. [Step 6: Optional polish](#8-step-6-optional-polish)
9. [Step 7: Update the documentation](#9-step-7-update-the-documentation)
10. [Step 8: Test checklist](#10-step-8-test-checklist)
11. [Common mistakes and how to fix them](#11-common-mistakes-and-how-to-fix-them)
12. [File checklist](#12-file-checklist)
13. [Where to learn more](#13-where-to-learn-more)

---

## 0. Introduction and prerequisites

### What you will have at the end

A playable game that:

- appears as a card in the Library page and has its own detail page;
- opens on `/games/<your-id>/play` inside the platform's CRT screen, with HUD, pause, end, game-over modal and play-again;
- lets signed-in players save their score to a leaderboard that is stored in Supabase;
- awards credits for play time (the currency of the Pin Collection);
- can optionally have skins, sound, music and touch controls for phones.

### Prerequisites

- **Node.js** installed (the version used by the project's `package.json`) and `npm install` already run in the repository root.
- A **`.env`** file in the repository root, copied from `.env.example`, with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` filled in. These two values are inlined at build time, so **restart `npm run dev` after editing `.env`**.
- Access to the Supabase project, either through the Supabase CLI or through the dashboard SQL editor. You need it once, in [Step 5](#7-step-5-connect-the-game-to-the-backend-supabase).
- Basic comfort with a terminal and Git.

### How to read this guide

Follow the steps **in order**. Each step builds on the previous one and ends with a **"Try it"** checkpoint, so you can confirm that everything works before moving on. If a checkpoint fails, fix it before continuing: errors compound.

### The running example: "Dot Catcher"

To keep the guide concrete, every step builds the same tiny example game:

- **Name:** Dot Catcher. **Id:** `dot-catcher`.
- The player slides a paddle left and right along the bottom of the screen and catches falling dots.
- Each caught dot is worth **10 points**. Each missed dot costs **one of three lives**. Every 10 caught dots the **level** goes up and the dots fall faster and appear more often.

It is small enough to fit in this document, but it touches every part of the integration: score, lives, level, keyboard input, skins, sound events, haptics and a touch pad. **It is a teaching example.** When you build your own game, replace the id, the names, the rules and the drawing code, and keep the structure.

---

## 1. The big picture: how a game plugs into Arcade Vault

Before writing code, it helps to know where your work fits. This is the whole path from the catalog to the database:

```
lib/games.ts  (the GAMES list)
    |
    +--> Library page card and /games/<id> detail page
    |
    +--> app/games/[id]/play/page.tsx   (one static page per game, built from GAMES)
            |
            +--> components/game-player.tsx   (GamePlayer: the platform around your game)
                    |
                    +--> getGameDefinition(id)  from components/game-registry.tsx
                    |
                    +--> mounts <YourCanvas />   (components/<id>-canvas.tsx)
                    |        |
                    |        +--> new YourEngine(canvas, callbacks)   (lib/<id>/engine.ts)
                    |
                    +--> engine callbacks (onScore, onLives, onLevel ...)  --> HUD under the screen
                    |
                    +--> onGameOver --> GAME OVER modal
                            |
                            +--> SAVE SCORE --> insertScore()  (lib/scores-db.ts)
                            |                    --> Supabase table "scores"
                            |
                            +--> awardCredit() (lib/pins-db.ts)
                                                 --> Supabase function "award_credit"
```

### The three layers

Your game is split into three layers. The split is deliberate: each layer has one job, and each one is protected from the mistakes of the others.

1. **The engine** (`lib/<id>/`). Pure TypeScript: game rules, physics, input and canvas drawing. It does **not** import React or Next.js. This makes it easy to reason about, and it cannot be broken by React re-rendering, because React never touches it.
2. **The canvas wrapper** (`components/<id>-canvas.tsx`). A small React component. It creates the engine once, forwards platform signals (pause, end, skin) to it, passes the engine's callbacks to the platform, and destroys the engine when the player leaves.
3. **The platform** (`GamePlayer`, the registry, the catalog, Supabase). Everything around the game. You do not rewrite it; you describe your game to it.

### What the platform gives you for free, and what you build

| The platform already does this for you                                          | You build this                                             |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| CRT screen frame, HUD (score, lives or lines, level)                            | The engine (`lib/<id>/`)                                   |
| PAUSE and END buttons, the paused overlay, GAME OVER modal, PLAY AGAIN          | The canvas wrapper (`components/<id>-canvas.tsx`)          |
| SAVE SCORE form, sign-in prompt for guests, ban handling                        | One entry in the registry (`components/game-registry.tsx`) |
| Per-game leaderboard, Hall of Fame, Royalty of Games, home "Latest scores"      | One entry in the catalog (`lib/games.ts`)                  |
| Credits for play time (`+N CREDITS`)                                            | One cover image, written as CSS (`app/globals.css`)        |
| Mute button, SKIN and THEME buttons, level selector, mode picker                | One database migration (`supabase/migrations/`)            |
| Touch gamepad and haptics on phones, background music and sound effect playback | Optional: skins, audio files, touch button layout          |

You never create a route file. The play page `app/games/[id]/play/page.tsx` is generated automatically for every entry of `GAMES` through `generateStaticParams`.

---

## 2. Before you start: things to keep in mind

Read this list once now, and come back to it when something behaves strangely.

- **Choose the game id carefully.** It is a lowercase kebab-case slug, for example `dot-catcher`. It becomes the URL (`/games/dot-catcher/play`), the primary key of the `games` table, and the foreign key of every saved score. Changing it later means migrating data, so treat it as permanent.
- **Make an original game.** Use your own name, art, sounds and music. Do not copy the assets, names or look of a commercial game, and never write a trademark in the UI. (The project's own Galactic DogFight is inspired by a classic arcade game, but it has its own name, art and audio, and never says the original name.)
- **The site is a static export.** `next.config.ts` uses `output: "export"` to publish on GitHub Pages. There is **no server**: no API routes, no server actions, no cookies, no `proxy.ts` or `middleware.ts`. Everything your game does runs in the browser, and everything that talks to the backend goes through the Supabase client that already exists.
- **Respect the performance rules.** Many players have no GPU acceleration, so full-screen CSS effects are the main cause of low frame rates. Do **not** add `mix-blend-mode`, animated `mask-image` or full-screen animated layers over or behind the game canvas. If you need a darkening effect, use plain transparency.
- **Choose a canvas size.** Most games use 800x600 (4:3). Others exist: Block Rain 440x600, Galactic DogFight 480x600, Wall Wrecker 640x480, Street Jumper 640x560. The canvas is scaled by CSS, so you draw in your own logical coordinates. A canvas that is not 4:3 needs `object-fit: contain` in its CSS (see Step 2).
- **Choose the origin tag.** Every game declares who made it: `"ai"`, `"human"` or `"assisted"`. A game you write by hand is `"human"`; a game you write with AI help is `"assisted"`. It appears as an emoji on the Library card and as a tag on the detail page.
- **The framework versions are new.** The project runs Next.js 16 and React 19, whose APIs differ from older tutorials. The patterns in this guide only need stable React features, but if you touch any Next-specific code, read the matching guide in `node_modules/next/dist/docs/` first.
- **Never store game settings in `localStorage`.** Skin, theme, mute and difficulty are kept in memory on purpose.
- **All user-visible text is in English** (labels, buttons, descriptions).

---

## 3. Step 1: Build the engine

The engine is where most of the learning happens, so this is the longest step.

### 3.1 Folder layout

Create a folder `lib/dot-catcher/` with four files:

| File           | Purpose                                                                               |
| -------------- | ------------------------------------------------------------------------------------- |
| `constants.ts` | Sizes (`W`, `H`), speeds, points, the `SKINS` palette table and the skin type.        |
| `utils.ts`     | Small pure functions (clamping the score, speed formulas). Easy to test in isolation. |
| `entities.ts`  | The shape of game objects (here, a falling dot).                                      |
| `engine.ts`    | The `DotCatcherEngine` class that runs the game.                                      |

Splitting files this way is a convention of the project (every real game follows it), and it keeps `engine.ts` readable.

### 3.2 The engine contract

Every engine in the project exposes the same public API. The platform and the wrapper rely on it.

```
new XEngine(canvas, callbacks, { skin?, theme? })

start()      begin the run
pause()      freeze the run
resume()     continue after pause
end()        finish the run now (the END button)
destroy()    stop everything and release listeners (component unmount)
setSkin(s)   change colors and redraw at once
```

Some engines add `setTheme()`, `setLevel()` or `setDifficulty()`. Here is why each method exists:

- **`constructor`**: gets the 2D drawing context, stores the callbacks, reads the options with defaults, and prepares the initial state. It throws a clear error if the browser cannot give a 2D context.
- **`start()`**: runs once. It resets state, **emits the initial values** (score 0, lives 3, level 1) so the HUD shows them immediately, attaches keyboard listeners, draws the first frame and starts the loop.
- **`pause()` / `resume()`**: stop and restart the loop. On resume the engine forgets the previous frame time, so the first frame after a long pause has a time step of zero. Without this, the game would "teleport" forward by however long the player stayed paused.
- **`end()`**: the player pressed END. Finish the run immediately.
- **`destroy()`**: called when the component unmounts. It cancels the animation frame and removes every listener. After `destroy()` the engine must never draw and must never call a callback.
- **`setSkin(skin)`**: changes the colors and **redraws immediately**, even when the game is paused or already over, so the player sees the new look at once.

### 3.3 Rules every engine must follow

These rules are not style preferences. Each one prevents a specific bug.

1. **No React, no Next.js, no module-level game state.** All game variables live inside the class instance. PLAY AGAIN creates a brand new engine; a module-level variable would leak the previous run into the next one.
2. **Callbacks fire only when a value changes.** The HUD is React state. If the engine called `onScore` 60 times per second with the same value, React would re-render 60 times per second for nothing. The engine keeps an `emitted` object with the last values it sent, and compares before calling.
3. **`start()` emits the initial values.** Typically `0` score, `3` lives, level `1`.
4. **`onGameOver` fires exactly once per run.** After it fires, the loop stops and every listener is removed.
5. **The score is clamped to 0..10,000,000.** The database rejects scores outside that range, so the engine must never produce one.
6. **Draw the playfield only.** Score, lives, level, the word "PAUSED" and the word "GAME OVER" belong to the platform HUD and modal, never to the canvas.
7. **Keyboard input uses `e.code`**, not `e.key`. `e.code` is the physical key (`ArrowLeft`, `KeyA`, `Space`) and works on every keyboard layout. It also matches the touch gamepad, which sends synthetic `keydown` and `keyup` events carrying a `code`. `P` and `Escape` do nothing: pausing is the platform's button.
8. **Call `preventDefault()` only for your game keys, and only while the game runs**, so arrow keys and space do not scroll the page, while the rest of the keyboard keeps working.
9. **Clear held keys on `blur` and when the tab is hidden**, otherwise a key can stay "stuck" after the player switches tabs.
10. **Engines never play sound and never vibrate.** They emit events: `onSound("catch")` and `onHaptic("death")`. The platform decides whether to play them (muted? on a phone? reduced motion?). The haptic names that already exist in `lib/haptics.ts` are `tap`, `gameover`, `brick`, `clear`, `quad`, `split`, `fruit`, `bonus`, `pearl` and `death`. A new name needs a new pattern in that file.

### 3.4 How the game loop works (for beginners)

A game loop repeats about 60 times per second:

1. The browser calls your function through `requestAnimationFrame` and gives it a timestamp.
2. You compute `dt`, the seconds since the previous frame.
3. You **update** the world using `dt` (`position += speed * dt`). Using `dt` makes the game run at the same speed on a 60 Hz and a 144 Hz screen.
4. You **draw** the world.
5. You ask for the next frame.

Two protections matter:

- **Cap `dt`** (a `MAX_DT` constant such as 0.05 s). If the tab was in the background, the next frame could report several seconds; without a cap, objects would jump far in one step.
- **Fast objects can skip through thin ones.** If a dot moves 24 px per frame and the paddle is 16 px thick, a frame can place the dot above the paddle and the next one below it, with no frame in between. There are two classic fixes: split the movement into small sub-steps (the project's engines use steps of at most 8 px), or test whether the dot **crossed** the paddle line between the previous and the current position. Dot Catcher uses the second approach because it is simpler.

### 3.5 The code

Create these four files. Read the comments: they explain the reasons.

**`lib/dot-catcher/constants.ts`**

```ts
// Logical canvas size. CSS scales the canvas to fit the screen.
export const W = 800;
export const H = 600;

export const PADDLE_W = 110;
export const PADDLE_H = 16;
export const PADDLE_Y = H - 40; // top edge of the paddle
export const PADDLE_SPEED = 520; // px per second

export const DOT_RADIUS = 12;
export const DOT_POINTS = 10;
export const START_LIVES = 3;
export const DOTS_PER_LEVEL = 10; // caught dots needed to reach the next level

export const MAX_DT = 0.05; // seconds. Longest time step the simulation accepts.

export interface SkinColors {
  background: string;
  floor: string;
  paddle: string;
  dot: string;
}

// Every skin is just a set of colors. Add more here and list them in the registry.
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
} satisfies Record<string, SkinColors>;

export type DotCatcherSkin = keyof typeof SKINS;
```

**`lib/dot-catcher/utils.ts`**

```ts
import { DOTS_PER_LEVEL } from "./constants";

export const MAX_SCORE = 10_000_000; // the database rejects anything above this

export const clampScore = (score: number): number =>
  Math.max(0, Math.min(MAX_SCORE, Math.floor(score)));

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

// Level 1 at the start, +1 every DOTS_PER_LEVEL caught dots.
export const levelFor = (caught: number): number =>
  1 + Math.floor(caught / DOTS_PER_LEVEL);

// Pixels per second. Starts slow, capped so the game stays playable.
export const fallSpeed = (level: number): number =>
  Math.min(480, 160 + 30 * (level - 1));

// Seconds between new dots. Shrinks with the level, never below 0.35 s.
export const spawnInterval = (level: number): number =>
  Math.max(0.35, 1.1 - 0.07 * (level - 1));
```

**`lib/dot-catcher/entities.ts`**

```ts
export interface Dot {
  x: number;
  y: number;
  prevY: number; // position in the previous frame, used to detect crossing the paddle line
}
```

**`lib/dot-catcher/engine.ts`**

```ts
import {
  DOT_POINTS,
  DOT_RADIUS,
  H,
  MAX_DT,
  PADDLE_H,
  PADDLE_SPEED,
  PADDLE_W,
  PADDLE_Y,
  SKINS,
  START_LIVES,
  W,
  type DotCatcherSkin,
} from "./constants";
import type { Dot } from "./entities";
import { clamp, clampScore, fallSpeed, levelFor, spawnInterval } from "./utils";

export type { DotCatcherSkin } from "./constants";

export interface DotCatcherCallbacks {
  onScore: (score: number) => void; // called when the score changes
  onLives: (lives: number) => void; // called when the lives change
  onLevel: (level: number) => void; // called when the level changes
  onGameOver: (finalScore: number) => void; // called once per run
  onSound?: (name: "catch" | "miss" | "gameover") => void;
  onHaptic?: (name: "death") => void;
}

export interface DotCatcherOptions {
  skin?: DotCatcherSkin; // default "retro"
}

// The keys this game reads. Anything else is ignored and never gets preventDefault().
const GAME_KEYS = new Set(["ArrowLeft", "ArrowRight", "KeyA", "KeyD"]);

export class DotCatcherEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly callbacks: DotCatcherCallbacks;
  private skin: DotCatcherSkin;

  // Lifecycle flags. Every public method checks them first.
  private started = false;
  private paused = false;
  private finished = false; // onGameOver already fired for this run
  private destroyed = false;
  private listening = false;
  private rafId: number | null = null;
  private lastTime: number | null = null;

  // Game state. It lives on the instance, never in module variables.
  private paddleX = W / 2; // center of the paddle
  private dots: Dot[] = [];
  private score = 0;
  private lives = START_LIVES;
  private caught = 0;
  private spawnTimer = 0.5; // seconds until the next dot
  private held = new Set<string>(); // keys currently down

  // Last values sent to the callbacks, so they only fire on change. NaN never equals anything.
  private emitted = { score: NaN, lives: NaN, level: NaN };

  constructor(
    canvas: HTMLCanvasElement,
    callbacks: DotCatcherCallbacks,
    options: DotCatcherOptions = {},
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx)
      throw new Error("DotCatcherEngine: 2D canvas context is not available");
    this.canvas = canvas;
    this.ctx = ctx;
    this.callbacks = callbacks;
    this.skin = options.skin ?? "retro";
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  setSkin(skin: DotCatcherSkin): void {
    if (!(skin in SKINS)) return;
    this.skin = skin;
    if (this.destroyed) return;
    this.draw(); // redraw at once, also while paused or after game over
  }

  start(): void {
    if (this.started || this.destroyed) return;
    this.started = true;
    this.emitChanges(); // the HUD shows 0 / 3 / 1 right away
    this.attachListeners();
    this.draw();
    this.schedule();
  }

  pause(): void {
    if (!this.started || this.paused || this.finished || this.destroyed) return;
    this.paused = true;
    this.cancelFrame();
    this.clearInput();
    this.lastTime = null;
  }

  resume(): void {
    if (!this.started || !this.paused || this.finished || this.destroyed)
      return;
    this.paused = false;
    this.lastTime = null; // the first frame after resume has dt = 0: no time jump
    this.schedule();
  }

  end(): void {
    if (!this.started || this.finished || this.destroyed) return;
    this.finishRun();
  }

  destroy(): void {
    this.destroyed = true;
    this.cancelFrame();
    this.detachListeners();
    this.clearInput();
  }

  // ── Loop ───────────────────────────────────────────────────────────────────

  private schedule(): void {
    this.cancelFrame();
    this.rafId = requestAnimationFrame(this.loop);
  }

  private cancelFrame(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private loop = (ts: number): void => {
    this.rafId = null;
    if (!this.started || this.paused || this.finished || this.destroyed) return;
    const dt =
      this.lastTime === null
        ? 0
        : Math.min((ts - this.lastTime) / 1000, MAX_DT);
    this.lastTime = ts;
    this.update(dt);
    this.emitChanges();
    if (this.finished) return; // finishRun already drew the last frame
    this.draw();
    this.schedule();
  };

  private update(dt: number): void {
    // 1. Move the paddle from the held keys.
    const dir =
      (this.held.has("ArrowRight") || this.held.has("KeyD") ? 1 : 0) -
      (this.held.has("ArrowLeft") || this.held.has("KeyA") ? 1 : 0);
    this.paddleX = clamp(
      this.paddleX + dir * PADDLE_SPEED * dt,
      PADDLE_W / 2,
      W - PADDLE_W / 2,
    );

    // 2. Spawn dots.
    const level = levelFor(this.caught);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      const x = DOT_RADIUS + Math.random() * (W - 2 * DOT_RADIUS);
      this.dots.push({ x, y: -DOT_RADIUS, prevY: -DOT_RADIUS });
      this.spawnTimer = spawnInterval(level);
    }

    // 3. Move the dots, remembering where each one was.
    const speed = fallSpeed(level);
    for (const dot of this.dots) {
      dot.prevY = dot.y;
      dot.y += speed * dt;
    }

    // 4. Resolve catches and misses. Dots that stay in play go to `remaining`.
    const remaining: Dot[] = [];
    for (const dot of this.dots) {
      // "Crossed": the dot's bottom was above the paddle line and is now at or below it.
      const crossed =
        dot.prevY + DOT_RADIUS <= PADDLE_Y && dot.y + DOT_RADIUS >= PADDLE_Y;
      const aligned =
        Math.abs(dot.x - this.paddleX) <= PADDLE_W / 2 + DOT_RADIUS;
      if (crossed && aligned) {
        this.score = clampScore(this.score + DOT_POINTS);
        this.caught++;
        this.callbacks.onSound?.("catch");
        continue;
      }
      if (dot.y - DOT_RADIUS > H) {
        this.lives--;
        this.callbacks.onSound?.("miss");
        this.callbacks.onHaptic?.("death");
        if (this.lives <= 0) {
          this.finishRun();
          return;
        }
        continue;
      }
      remaining.push(dot);
    }
    this.dots = remaining;
  }

  // Stops the engine for good (until destroy) and reports the final score once.
  private finishRun(): void {
    if (this.finished) return;
    this.finished = true;
    this.cancelFrame();
    this.detachListeners();
    this.clearInput();
    this.emitChanges();
    this.draw();
    this.callbacks.onSound?.("gameover");
    this.callbacks.onGameOver(clampScore(this.score));
  }

  // Sends a value to the platform only when it differs from the last one sent.
  private emitChanges(): void {
    const score = clampScore(this.score);
    const lives = Math.max(0, this.lives);
    const level = levelFor(this.caught);
    if (this.emitted.score !== score) {
      this.emitted.score = score;
      this.callbacks.onScore(score);
    }
    if (this.emitted.lives !== lives) {
      this.emitted.lives = lives;
      this.callbacks.onLives(lives);
    }
    if (this.emitted.level !== level) {
      this.emitted.level = level;
      this.callbacks.onLevel(level);
    }
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  private attachListeners(): void {
    if (this.listening) return;
    this.listening = true;
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.clearInput);
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  private detachListeners(): void {
    if (!this.listening) return;
    this.listening = false;
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.clearInput);
    document.removeEventListener("visibilitychange", this.onVisibility);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.paused || this.finished || !this.started) return;
    if (!GAME_KEYS.has(e.code)) return;
    e.preventDefault(); // only for game keys, so arrows do not scroll the page
    this.held.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.held.delete(e.code);
  };

  // Arrow functions, so the same reference can be added and removed as a listener.
  private clearInput = (): void => {
    this.held.clear();
  };

  private onVisibility = (): void => {
    if (document.hidden) this.clearInput();
  };

  // ── Drawing ────────────────────────────────────────────────────────────────

  private draw(): void {
    const { ctx } = this;
    const colors = SKINS[this.skin];

    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = colors.floor;
    ctx.fillRect(0, PADDLE_Y + PADDLE_H + 8, W, 4);

    ctx.fillStyle = colors.paddle;
    ctx.fillRect(this.paddleX - PADDLE_W / 2, PADDLE_Y, PADDLE_W, PADDLE_H);

    ctx.fillStyle = colors.dot;
    for (const dot of this.dots) {
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
```

Notice that `this.canvas` is stored but the engine only draws through `ctx`. Real engines use the canvas for things like pointer input and sizing; it is kept in the contract so those features can be added without changing the constructor.

### Try it

Run `npm run lint`. The engine should compile with no errors. Nothing shows on screen yet, and that is expected: the wrapper, the registry and the catalog entry still do not exist.

---

## 4. Step 2: Write the canvas wrapper

The wrapper is the bridge between React and your engine.

### 4.1 Why it looks the way it does

- **`"use client"`** at the top marks the file as a client component. Canvas and keyboard work only exist in the browser.
- **The engine is created inside `useEffect`**, because the `<canvas>` element exists only after React has rendered it to the page.
- **`callbacksRef` and `skinRef`** hold the latest callbacks and skin. They are updated on every render, but the engine is created only once and always calls `callbacksRef.current`, so it never needs to be rebuilt when a callback changes.
- **The creation effect has an empty dependency list** (`[]`). It creates the engine, calls `start()`, and returns a cleanup function that calls `destroy()`. In development, React Strict Mode runs effects twice (mount, cleanup, mount again) to expose leaks; your cleanup must destroy the first engine completely, or you would have two engines listening to the keyboard.
- **Separate small effects** forward `paused`, `endSignal` and `skin` to the engine.
- **`toSkin()`** is a guard: the platform passes the skin as any string, so the wrapper checks that it is a real skin with `Object.hasOwn(SKINS, skin)` and falls back to the default.

### 4.2 The props a wrapper can receive

They come from `GameCanvasProps` in `components/game-registry.tsx`:

| Prop                            | Meaning                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------- |
| `paused`                        | `true` while the player has paused.                                              |
| `endSignal`                     | A counter. When it increases above 0, call `engine.end()`.                       |
| `onScore`, `onGameOver`         | Always passed.                                                                   |
| `onLives`, `onLevel`, `onLines` | Passed only when the registry `stats` declares them.                             |
| `skin`, `theme`                 | The chosen skin id and theme (only for games with `appearance`).                 |
| `onSound`, `onHaptic`           | Engine events the platform plays or vibrates.                                    |
| `levelRequest`                  | `{ level, id }`. A new `id` asks the engine to jump to `level` (level selector). |
| `mode`, `difficulty`            | Only for games that define `modes` or `difficultySelect`.                        |

A wrapper only declares the props its engine uses; unused ones are simply ignored.

### 4.3 The code

**`components/dot-catcher-canvas.tsx`**

```tsx
"use client";

import { useEffect, useRef } from "react";
import {
  DotCatcherEngine,
  type DotCatcherSkin,
} from "@/lib/dot-catcher/engine";
import { H, SKINS, W } from "@/lib/dot-catcher/constants";

interface DotCatcherCanvasProps {
  paused: boolean;
  /** Increment to end the run immediately (0 = not requested). */
  endSignal: number;
  onScore: (score: number) => void;
  onLives?: (lives: number) => void;
  onLevel?: (level: number) => void;
  onGameOver: (finalScore: number) => void;
  /** Sound events from the engine ("catch", "miss", "gameover"); the platform plays them. */
  onSound?: (name: string) => void;
  /** Haptic events from the engine ("death"); the platform vibrates. */
  onHaptic?: (name: string) => void;
  /** Any string; unknown ids fall back to "retro". */
  skin?: string;
}

const toSkin = (skin: string | undefined): DotCatcherSkin =>
  skin !== undefined && Object.hasOwn(SKINS, skin)
    ? (skin as DotCatcherSkin)
    : "retro";

export function DotCatcherCanvas({
  paused,
  endSignal,
  onScore,
  onLives,
  onLevel,
  onGameOver,
  onSound,
  onHaptic,
  skin,
}: DotCatcherCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<DotCatcherEngine | null>(null);
  // Latest callbacks and skin, so the engine is created once and never rebuilt on re-render.
  const callbacksRef = useRef({
    onScore,
    onLives,
    onLevel,
    onGameOver,
    onSound,
    onHaptic,
  });
  const skinRef = useRef(toSkin(skin));

  useEffect(() => {
    callbacksRef.current = {
      onScore,
      onLives,
      onLevel,
      onGameOver,
      onSound,
      onHaptic,
    };
    skinRef.current = toSkin(skin);
  });

  // Create, start and destroy the engine. Strict Mode runs this twice in dev
  // (mount, cleanup, mount): the cleanup destroys the first engine completely.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new DotCatcherEngine(
      canvas,
      {
        onScore: (s) => callbacksRef.current.onScore(s),
        onLives: (l) => callbacksRef.current.onLives?.(l),
        onLevel: (l) => callbacksRef.current.onLevel?.(l),
        onGameOver: (s) => callbacksRef.current.onGameOver(s),
        onSound: (n) => callbacksRef.current.onSound?.(n),
        onHaptic: (n) => callbacksRef.current.onHaptic?.(n),
      },
      { skin: skinRef.current },
    );
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (paused) engine.pause();
    else engine.resume();
  }, [paused]);

  useEffect(() => {
    if (endSignal > 0) engineRef.current?.end();
  }, [endSignal]);

  useEffect(() => {
    engineRef.current?.setSkin(toSkin(skin));
  }, [skin]);

  return (
    <canvas
      ref={canvasRef}
      className="dot-catcher-canvas"
      width={W}
      height={H}
      role="img"
      aria-label="Dot Catcher game field"
    />
  );
}
```

> **TypeScript note:** the engine's `onSound` and `onHaptic` accept a narrow union of names, while the wrapper receives a plain `string` from the platform. If `tsc` complains about that mismatch, widen the engine callback types to `(name: string) => void`, or narrow inside the wrapper. The existing games choose whichever keeps their own code simplest.

### 4.4 The CSS for the canvas

Add this to `app/globals.css`, next to the `.snake-canvas` rule:

```css
.dot-catcher-canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  background: #000;
  touch-action: none; /* keys and the pad drive the paddle; a touch must not scroll the page */
}
```

If your canvas is **not 4:3** (for example 480x600), also add `object-fit: contain;` to the rule, so the picture keeps its proportions inside the 4:3 screen instead of being stretched. `touch-action: none` is required for every game: without it, a finger on the canvas would scroll the page or zoom it.

### Try it

Run `npm run lint`. It should pass. The game is still not visible, because the platform does not know about it yet.

---

## 5. Step 3: Register the game

`components/game-registry.tsx` contains `GAME_REGISTRY`, a map from the game id to a `GameDefinition`. When the player opens `/games/dot-catcher/play`, `GamePlayer` calls `getGameDefinition("dot-catcher")` to learn which canvas to mount, which controls hint to show, and which buttons to offer.

### 5.1 The fields of a `GameDefinition`

| Field              | Required | What it does on screen                                                                           |
| ------------------ | -------- | ------------------------------------------------------------------------------------------------ |
| `Canvas`           | yes      | Your wrapper component.                                                                          |
| `controls`         | yes      | The key hint under the screen, as `{ keys: string[]; label: string }[]`.                         |
| `stats`            | yes      | `{ lives, lines, level }`: which HUD stats the game reports. Lives and lines share one HUD slot. |
| `linesLabel`       | no       | Replaces the word "Lines" in the HUD (Snake uses `"Length"`).                                    |
| `appearance`       | no       | `{ skins: { id, label }[], themes }`: shows the SKIN (and THEME) buttons.                        |
| `music`            | no       | `{ src, volume }`: one looping background track. Adds a `MUSIC ON/OFF` button.                   |
| `sfx`              | no       | `{ sounds, volume, pauseToggle? }`: sound effects played on the engine's `onSound` events.       |
| `levelSelect`      | no       | `{ min, max }`: a `LEVEL − NN +` selector in the paused overlay. Needs `setLevel` in the engine. |
| `modes`            | no       | A mode picker shown before the run starts (for example Super Tennis's player versus CPU).                |
| `difficultySelect` | no       | A difficulty selector in the paused overlay for chosen modes.                                    |
| `touch`            | no       | `{ pad?, swipe?, hint }`: touch controls for phones.                                             |

### 5.2 Audio URLs and the base path

On GitHub Pages the site does not live at the domain root; it lives under `/Arcade-Vault-Claude`. Next.js adds that prefix to links automatically, but **not** to plain strings. Any URL that points to a file in `public/` (audio, images) must go through `withBasePath()` from `lib/base-path.ts`:

```ts
import { withBasePath } from "@/lib/base-path";

withBasePath("/game-assets/dot-catcher/catch.wav");
```

Game audio files live in `public/game-assets/<id>/`.

### 5.3 The Dot Catcher entry

First add the import at the top of `components/game-registry.tsx`, in alphabetical order with the others:

```ts
import { DotCatcherCanvas } from "@/components/dot-catcher-canvas";
```

Then add the entry inside `GAME_REGISTRY`:

```ts
"dot-catcher": {
  Canvas: DotCatcherCanvas,
  controls: [
    { keys: ["←", "→"], label: "MOVE" },
    { keys: ["A", "D"], label: "MOVE" },
  ],
  // Lives and level are reported; "lines" does not apply to this game.
  stats: { lives: true, lines: false, level: true },
  appearance: {
    skins: [
      { id: "retro", label: "RETRO" },
      { id: "neon", label: "NEON" },
    ],
    themes: false,
  },
  touch: {
    // Each button sends the same key code the engine already reads.
    pad: [
      { code: "ArrowLeft", label: "◀", slot: "left", hold: true },
      { code: "ArrowRight", label: "▶", slot: "right", hold: true },
    ],
    hint: [{ keys: ["◀", "▶"], label: "MOVE" }],
  },
},
```

If you also ship sound effects, add an `sfx` block like the one Alien Attack uses:

```ts
sfx: {
  sounds: {
    catch: withBasePath("/game-assets/dot-catcher/catch.wav"),
    miss: withBasePath("/game-assets/dot-catcher/miss.wav"),
    gameover: withBasePath("/game-assets/dot-catcher/gameover.wav"),
  },
  volume: 0.2,
},
```

The key names inside `sounds` must match the names your engine passes to `onSound`.

### Try it

Run `npm run lint`. The game is registered but still not reachable from the UI, because the catalog entry is the next step.

---

## 6. Step 4: Add the game to the catalog and draw its cover

`lib/games.ts` contains `GAMES`, the list the UI reads to build the Library, the detail pages, the home page and the play routes.

### 6.1 The fields of a `Game`

Defined in `lib/types.ts`:

| Field    | Type / allowed values                           | Meaning                                                                    |
| -------- | ----------------------------------------------- | -------------------------------------------------------------------------- |
| `id`     | string, kebab-case                              | URL slug, database key. Permanent.                                         |
| `title`  | string, uppercase                               | Display title, for example `"DOT CATCHER"`.                                |
| `short`  | string                                          | One sentence for the Library card.                                         |
| `long`   | string                                          | The detail page description (a few sentences).                             |
| `cat`    | `"ARCADE"`, `"PUZZLE"`, `"SHOOTER"`, `"VERSUS"` | Category, used by the Library filters.                                     |
| `cover`  | string                                          | Name of a CSS class in `app/globals.css`, for example `cover-dot-catcher`. |
| `color`  | `"cyan"`, `"magenta"`, `"yellow"`, `"green"`    | Accent color of the card's PLAY button.                                    |
| `origin` | `"ai"`, `"human"`, `"assisted"`                 | Who made the game. Hand-written games use `"human"`.                       |

### 6.2 The Dot Catcher entry

Append this to the `GAMES` array:

```ts
{
  id: "dot-catcher",
  title: "DOT CATCHER",
  short: "Slide the paddle and catch every falling dot.",
  long: "Dots rain from the top of the screen. Slide your paddle left and right to catch them and score points. Miss three and the run is over. Every ten catches the dots fall faster and the rain gets thicker.",
  cat: "ARCADE",
  cover: "cover-dot-catcher",
  color: "cyan",
  origin: "human",
},
```

**Write these texts once and keep them.** In Step 5 you will copy exactly the same values into the database.

### 6.3 The cover

The `cover` value is the name of a CSS class. Add the class to `app/globals.css`, following `.cover-snake-game`. The usual pattern is a background gradient plus an `::after` layer that holds an inline SVG as a data URI:

```css
/* The moment Dot Catcher is about: three dots falling toward the paddle */
.cover-dot-catcher {
  background:
    radial-gradient(
      ellipse at 50% 120%,
      rgba(0, 245, 255, 0.18),
      transparent 60%
    ),
    #05080f;
}
.cover-dot-catcher::after {
  content: "";
  position: absolute;
  inset: 0;
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300' preserveAspectRatio='xMidYMid slice'%3E%3Ccircle cx='120' cy='70' r='14' fill='%2300f5ff'/%3E%3Ccircle cx='220' cy='130' r='14' fill='%2300f5ff'/%3E%3Ccircle cx='300' cy='60' r='14' fill='%2300f5ff'/%3E%3Crect x='145' y='250' width='110' height='16' fill='%23f5ff00'/%3E%3C/svg%3E")
    center/cover no-repeat;
}
```

Tips:

- Keep the cover **static**. Do not animate it (see the performance rules in section 2).
- Use the site palette: cyan `#00f5ff`, magenta `#ff006e`, yellow `#f5ff00`, green `#00ff88`.
- Inside a data URI, write `#` as `%23` and `<` as `%3C`, `>` as `%3E`, otherwise the URL breaks.
- Use single quotes for SVG attributes, because the whole `url("...")` is wrapped in double quotes.

### Try it

1. Run `npm run dev` and open `http://localhost:3000/library`. You should see the Dot Catcher card with its cover, the human-made emoji and a PLAY button.
2. Open `http://localhost:3000/games/dot-catcher/play` and play. The HUD must update, PAUSE and END must work, and the GAME OVER modal must appear when you lose all three lives.
3. Try to save a score as a signed-in player. **It will fail.** That is expected: the database does not know the game yet. The next step fixes it.

---

## 7. Step 5: Connect the game to the backend (Supabase)

This is the most important and least obvious step.

### 7.1 Why the database needs a row for your game

The backend has a table `games`. Every saved score points to it:

- `scores.game_id` is a **foreign key** to `games.id`. If the game has no row in `games`, inserting a score fails.
- The `award_credit` function (which gives credits for play time) checks that the game exists. Without the row, no credits are awarded.

`GAMES` in `lib/games.ts` is what the **UI** reads. The `games` table is a **manual copy** of it for the **database**. The platform does not sync them for you, so you create the row yourself, and every field must be identical to your `GAMES` entry, including `cover` and `origin`.

### 7.2 The project rule: migrations only

Every database change in this project is a **migration file** in `supabase/migrations/`. Never change the database by clicking in the dashboard and leaving it at that. The project is planned to move to a production database, and the migration files must be able to recreate everything from scratch.

### 7.3 Write the migration

Create `supabase/migrations/<version>_add_dot_catcher_game.sql`. The `<version>` is a timestamp in the form `YYYYMMDDHHMMSS`, for example `20261112100000`. It must sort after the existing migrations. (If you apply the migration with a tool that assigns its own version, rename the file to that version afterwards: the file name must equal the version that was actually applied.)

```sql
insert into public.games (id, title, short, long, cat, cover, color, origin) values
  ('dot-catcher', 'DOT CATCHER', 'Slide the paddle and catch every falling dot.',
   'Dots rain from the top of the screen. Slide your paddle left and right to catch them and score points. Miss three and the run is over. Every ten catches the dots fall faster and the rain gets thicker.',
   'ARCADE', 'cover-dot-catcher', 'cyan', 'human');
```

Two details to double-check:

- **`origin` is mandatory in the insert.** The column is `not null` and has no default (the migration `add_games_origin` removed the default on purpose, so a new game can never be labeled by accident). Forgetting it makes the insert fail.
- **Apostrophes must be doubled in SQL.** `'Dot''s game'` is the way to write `Dot's game`. Check your texts for apostrophes.

The existing files `supabase/migrations/20261111071959_add_wingshot_game.sql` and `supabase/migrations/20261111014204_add_games_origin.sql` are good references.

### 7.4 Apply the migration

Choose one of these:

1. **Supabase CLI** (best for most developers): `supabase migration new add_dot_catcher_game` creates the file; paste the SQL; then `supabase db push` applies it to the linked project.
2. **Supabase MCP tool `apply_migration`** from a Claude Code session: it applies the SQL and assigns the version. Then make sure the file in `supabase/migrations/` carries that version.
3. **Dashboard SQL editor**, only if the other two are unavailable: run the SQL there, then save the identical SQL as a migration file with the correct version.

To confirm it worked, run this in the SQL editor and check that the row is there:

```sql
select id, title, origin from public.games where id = 'dot-catcher';
```

### 7.5 Generated types

`lib/supabase/database.types.ts` is **generated** from the database and must never be edited by hand. Inserting a row does not change the schema, so you normally do not need to regenerate it. If you ever change the schema (tables, columns, functions), regenerate it (for example with the MCP tool `generate_typescript_types` or `supabase gen types typescript`).

### 7.6 What becomes automatic after the row exists

You do not write any more backend code. Once the row exists, these work for your game on their own:

- saving a score from the GAME OVER modal;
- the leaderboard on `/games/dot-catcher`;
- the best score shown on the Library card;
- Hall of Fame and Royalty of Games (the sum of each player's best score per game);
- the home page "Latest scores" and "Top players today";
- credits: 1 credit per 30 seconds of active play, at most 5 per game, awarded at game over to signed-in players whose score is above 0, shown as `+N CREDITS`.

### 7.7 Security facts you should understand

You never need to change these, but knowing them avoids confusion:

- **Row Level Security (RLS)** is on. Reading `games` and `scores` is public. Inserting a score requires a **signed-in, not banned** user, and the row's `user_id` is filled in automatically with the caller's id. Scores can never be updated or deleted from the client.
- **Clients can only read the columns `id, game_id, name, score, created_at` of `scores`.** If you ever write a query against `scores`, always list the columns; `select *` is rejected because `user_id` is private.
- **Limits:** the score name is 1 to 10 characters, and a score is between 0 and 10,000,000. That is why the engine clamps the score.
- **Never put a service role key in the frontend.** The project only uses the public (publishable) key.
- **Guests cannot save scores.** The UI shows `SIGN IN TO SAVE YOUR SCORE` and a link to the sign-in page. A guest's finished score is lost when they sign in.

### Try it

1. Sign in (create an account on `/auth` if needed).
2. Play Dot Catcher, lose, type a name and press SAVE SCORE. It should succeed.
3. Open `/games/dot-catcher`. Your score must be in the leaderboard.
4. Play for more than 30 seconds with a score above 0. At game over you should see `+1 CREDITS` (or more).

---

## 8. Step 6: Optional polish

Everything here is optional. Add it when the core game works.

### 8.1 Skins

A skin is a palette (and sometimes a small effect) that changes only what the canvas draws. Add entries to `SKINS` in `constants.ts`, then list them in `appearance.skins` in the registry. The base set used by every game in the project is **Retro (default), Neon, Pastel, Gothic and Negative**, plus one or two original ones per game. Make sure text and important objects keep a contrast ratio of at least 3:1 against the background. The `skin-designer` agent can generate skins for you, but you can write them by hand exactly as shown above.

### 8.2 Touch controls for phones

Below 768 px wide, the platform shows a touch pad (and a touch hint under the screen). You describe it in `touch`:

- `pad`: a list of `TouchButton`: `{ code, label, hold?, slot }`.
  - `code` is a `KeyboardEvent.code` your engine already reads (`"ArrowLeft"`, `"Space"`, `"KeyS"`).
  - `slot` is where the active gamepad skin draws the control: `up`, `down`, `left`, `right`, `a`, `b`, `x` or `y` (defined in `lib/gamepad.ts`).
  - `hold: true` keeps the key down while the finger is down (movement); without it the button sends one press (action).
- `swipe: true`: for swipe games such as Snake, where a swipe sends arrow keys.
- `hint`: the text shown instead of `controls` on small screens.

The pad sends the same `keydown` and `keyup` events a real keyboard would, so **your engine needs no touch code**, as long as it reads `e.code` and handles `keyup` properly (as in the Dot Catcher engine). Players can also enable the pad on larger screens from the GamePad menu.

### 8.3 Haptics (phone vibration)

Call `onHaptic("name")` from the engine with a name that exists in `lib/haptics.ts` (`tap`, `gameover`, `brick`, `clear`, `block-rain`, `split`, `fruit`, `bonus`, `pearl`, `death`). To invent a new one, add it to the `HapticKind` type and to `HAPTIC_PATTERNS` in that file. The platform only vibrates on touch layouts, when the browser supports it, when the player has haptics on, and when reduced motion is not requested.

### 8.4 Sound effects and music

1. Put the files (`.wav` or `.mp3`) in `public/game-assets/<id>/`.
2. Add `sfx` or `music` to the registry entry, with every URL wrapped in `withBasePath()`.
3. Emit `onSound("name")` from the engine; the name must match a key of `sfx.sounds`.
4. Confirm the **license** of any third-party audio before publishing. Original or generated sounds avoid the question.

The platform adds the mute button, remembers the choice in memory only, and plays overlapping effects correctly.

### 8.5 Level select, modes and difficulty

- **`levelSelect: { min, max }`**: the paused overlay shows `LEVEL − NN +`. The engine needs a `setLevel(level: number)` method that restarts the current stage at that level while **keeping score and lives**, clamps to the range, and does nothing after game over. The wrapper calls it when `levelRequest.id` changes:
  ```ts
  useEffect(() => {
    if (levelRequest) engineRef.current?.setLevel(levelRequest.level);
  }, [levelRequest]);
  ```
- **`modes`**: the CRT shows a mode picker before the run starts, and the chosen id arrives as the `mode` prop. The engine reads it once, in its options.
- **`difficultySelect`**: the paused overlay shows difficulty options, and the wrapper calls `engine.setDifficulty(id)` in an effect. Changing difficulty restarts the match.

Study Alien Attack (`levelSelect`) and Super Tennis (`modes` and `difficultySelect`) for working examples.

### 8.6 Pins

The Pin Collection is a fixed catalog of 151 pins, stored both in a `pins` table and in `lib/pins/catalog.ts` (the two must always change together). Adding pins for a new game requires a migration and sprite art, so it is out of scope for a first game. Your game earns credits for the Pin Collection automatically.

---

## 9. Step 7: Update the documentation

Two small edits keep the project documentation true:

1. **`references/GAMES.md`**: add your game to the table at the top and add a section for it (description, details, controls, touch behavior, HUD), following the existing sections. Update the sentence that says how many rows the `games` table holds.
2. **`CLAUDE.md`**: add a short note under "Per-game notes" (engine class, callbacks, canvas size, skins, anything unusual), and update the number of catalog games where it is mentioned. This helps both people and AI assistants understand the engine later.

---

## 10. Step 8: Test checklist

Run through this list before opening a pull request.

**Build**

- [ ] `npm run lint` passes with no errors.
- [ ] `npm run build` passes (the build exports every game page statically, so mistakes in the catalog show up here).

**Catalog and navigation**

- [ ] The Library card shows the cover, the title, the origin emoji and a PLAY button.
- [ ] The detail page `/games/<id>` shows the description, the origin tag and an empty leaderboard before any score exists.

**Playing**

- [ ] The HUD shows the right initial values (score 0, lives 3, level 1) as soon as the game starts.
- [ ] The HUD updates when things change, and only then.
- [ ] PAUSE freezes the game completely; RESUME continues with no jump in time.
- [ ] END finishes the run at once, and the GAME OVER modal appears **exactly once**.
- [ ] After game over, pressing game keys does nothing and the page does not scroll.
- [ ] PLAY AGAIN starts a fresh run (score 0, full lives, no leftover objects).
- [ ] Switching tabs while holding a key does not leave the key "stuck".
- [ ] Skins change immediately, also while paused and after game over.

**Backend**

- [ ] As a guest, game over shows `SIGN IN TO SAVE YOUR SCORE`.
- [ ] As a signed-in player, SAVE SCORE works and the score appears on the leaderboard.
- [ ] Playing more than 30 seconds with a positive score shows `+N CREDITS`.
- [ ] The `games` row in Supabase is identical to the `GAMES` entry.

**Phones and publishing**

- [ ] At a width below 768 px (use the browser's device mode) the touch pad appears and controls the game.
- [ ] The browser console shows no errors or warnings from your game.
- [ ] Production-style build under the GitHub Pages sub-path works: build with `NEXT_PUBLIC_BASE_PATH=/Arcade-Vault-Claude`, serve the `out/` folder under that path, and check that images and sounds still load.
- [ ] Optional: measure frame time with the method in `references/perf/measure-fps.md`.

---

## 11. Common mistakes and how to fix them

| Symptom                                               | Likely cause                                                                        | Fix                                                                                   |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| SAVE SCORE fails with a foreign key error             | The `games` row does not exist, or its `id` differs from `GAMES`.                   | Apply the migration from Step 5 and compare the id.                                   |
| The migration fails with a `not null` error           | The insert forgot `origin`.                                                         | Add the `origin` column and value to the insert.                                      |
| The game restarts or runs twice on every render       | The engine is created outside the empty-dependency effect.                          | Create the engine in `useEffect(..., [])` and destroy it in the cleanup.              |
| Keys still move things after game over                | Listeners were not removed in `finishRun()`.                                        | Call `detachListeners()` there.                                                       |
| Two engines react to one key press (development only) | The cleanup does not call `destroy()` fully (Strict Mode double mount).             | Make `destroy()` cancel the frame and remove every listener.                          |
| Sounds or images work locally but 404 on GitHub Pages | A raw URL without `withBasePath()`.                                                 | Wrap every URL to `public/` in `withBasePath()`.                                      |
| PLAY AGAIN keeps old state                            | Game variables are module-level instead of class fields.                            | Move all state into the engine instance.                                              |
| The game jumps forward after pause                    | `lastTime` was not reset on resume.                                                 | Set `lastTime = null` in `resume()` and give the first frame `dt = 0`.                |
| Fast objects pass through walls or the paddle         | One big movement step per frame.                                                    | Use sub-steps (max about 8 px) or a "crossed the line" test, and cap `dt`.            |
| Arrows or space scroll the page                       | Missing `preventDefault()` for game keys, or missing `touch-action: none`.          | Prevent default for your keys only while running; add the CSS rule.                   |
| The game ignores some keyboards or the touch pad      | The engine reads `e.key` instead of `e.code`.                                       | Read `e.code`.                                                                        |
| The pad moves once and does not keep moving           | The engine only handles `keydown`, not `keyup`, or `hold` is not set on the button. | Track held keys with `keydown` and `keyup`, and set `hold: true` on movement buttons. |
| Score or "GAME OVER" text appears twice               | The engine draws HUD text on the canvas.                                            | Remove it; the platform HUD and modal show it.                                        |
| HUD flickers or the page is slow                      | Callbacks fire every frame.                                                         | Compare with the last emitted value and call only on change.                          |
| A new skin does not appear                            | It is in `SKINS` but not in the registry `appearance.skins` list.                   | Add the `{ id, label }` entry to the registry.                                        |
| The Library does not show the new game                | Missing entry in `GAMES`, or a typo in `cat` or `color`.                            | Check the entry against the field table in Step 4.                                    |
| `/games/<id>/play` shows a fake or empty screen       | No registry entry, or the registry key differs from the `GAMES` id.                 | The registry key must be exactly the game id (quote it if it has a hyphen).           |

---

## 12. File checklist

| File                                              | Required | What you do                                       |
| ------------------------------------------------- | -------- | ------------------------------------------------- |
| `lib/<id>/constants.ts`                           | yes      | Create: sizes, speeds, points, skins.             |
| `lib/<id>/utils.ts`                               | yes      | Create: pure helpers (`clampScore`, formulas).    |
| `lib/<id>/entities.ts`                            | yes      | Create: game object types.                        |
| `lib/<id>/engine.ts`                              | yes      | Create: the engine class.                         |
| `components/<id>-canvas.tsx`                      | yes      | Create: the wrapper.                              |
| `components/game-registry.tsx`                    | yes      | Edit: import the wrapper, add the registry entry. |
| `lib/games.ts`                                    | yes      | Edit: add the `GAMES` entry.                      |
| `app/globals.css`                                 | yes      | Edit: add the canvas class and the cover class.   |
| `supabase/migrations/<version>_add_<id>_game.sql` | yes      | Create and apply: the `games` row.                |
| `references/GAMES.md`                             | yes      | Edit: table row and game section.                 |
| `CLAUDE.md`                                       | yes      | Edit: per-game note and counts.                   |
| `public/game-assets/<id>/`                        | no       | Add audio or image files, if the game uses them.  |
| `lib/haptics.ts`                                  | no       | Edit only to add a new haptic pattern.            |

---

## 13. Where to learn more

The best teacher is the code of the existing games. Read them roughly in this order, from simplest to most complex:

1. **Snake** (`lib/snake/`, `components/snake-canvas.tsx`): a small engine with swipe controls, a sprite sheet and skins. Its structure is the base for the Dot Catcher example.
2. **Alien Attack** (`lib/alien-attack/`): lives, levels, level select, sound effects, touch pad, held-key input.
3. **Super Tennis** (`lib/super-tennis/`): modes (player versus CPU, local two-player), difficulty, sound effects.
4. **Galactic DogFight** (`lib/galactic-dogfight/`): the most complete example: several phases, music, many sounds, a custom canvas stats screen.

Other useful places:

- `specs/`: the specification of every feature, including `16-alien-attack-game.md` and `17-galactic-dogfight-game.md`. They explain why each game works the way it does.
- `references/GAMES.md`: the catalog of real games with controls and touch layouts.
- `references/StarterGames/`: the original vanilla-JavaScript sources of Space Voyage, Block Rain and Wall Wrecker, useful if you want to port a plain JavaScript game.
- `references/perf/measure-fps.md`: how to measure a game's frame time.
- `CLAUDE.md`: the most detailed technical notes about the whole project, kept up to date.

Good luck, and have fun building.
