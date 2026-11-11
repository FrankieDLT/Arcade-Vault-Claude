# SPEC 27 — Java game integration guide, with Dot Catcher built in Java as the shipped example

> **Status:** Approved
> **Depends on:** SPEC 06, SPEC 10, SPEC 11, SPEC 12, SPEC 13, SPEC 18, SPEC 19
> **Date:** 2026-11-11
> **Objective:** Write `JAVA-GAME-INTEGRATION-GUIDE.md`, a step-by-step manual for plugging a game written in Java into the Arcade Vault library by compiling it to JavaScript with TeaVM, and prove every step by shipping Dot Catcher as a real catalog game whose rules and drawing are Java.

## Why this spec exists

`GAME-INTEGRATION-GUIDE.md` teaches how to build a game by hand in TypeScript. The user asked for the equivalent for a game written in **Java**, "as detailed as possible", using that guide as the reference. Four facts shape the work:

- **The site cannot run Java.** It is a static export on GitHub Pages: no server, no JVM, no applets. A Java game must reach the browser as JavaScript or WebAssembly, so the guide is mostly about the bridge between a compiled Java engine and the platform that already exists.
- **The platform contract does not change.** `GamePlayer`, the registry, the catalog, `scores`, credits and the touch pad know nothing about Java. A Java engine has to look exactly like a TypeScript engine from the outside: `new Engine(canvas, callbacks, options)`, `start`, `pause`, `resume`, `end`, `destroy`, `setSkin`, callbacks only on change, `onGameOver` once. The guide's central idea is that the contract is the only thing that crosses the bridge.
- **The guide must be true.** A guide full of snippets that were never compiled is worse than no guide. The user chose to ship a real example game, so every snippet in the worked example is copied from a file in the repo that was built and played, never written from memory.
- **Technical route (user decision).** TeaVM (Java bytecode to JavaScript) is the route taught in depth. CheerpJ and a manual port to TypeScript get a comparison table and a "when to use" note only. The toolkits the guide shows how to adapt are plain Java with Java2D/AWT, libGDX, JavaFX and logic-only Java.

The user already decided and this spec does not reopen: the example is **Dot Catcher** (`dot-catcher`, the running example of `GAME-INTEGRATION-GUIDE.md`, origin `ai`); Java owns rules **and** drawing (through a small `Gfx` interface backed by TeaVM JSO bindings to Canvas 2D); the example goes through the **full pipeline** (touch pad, skins, sounds, perf measurement); Java sources live in the repo and the **compiled JavaScript is committed**, so CI stays unchanged and needs no JDK; the TypeScript side is a **reusable Java bridge** (`lib/java-bridge/` plus a generic canvas wrapper `JavaEngineCanvas`) built in this spec, with Dot Catcher as its first consumer (user decision added after the first draft).

The work has two halves that can be committed and reviewed apart: **A** (steps 1 to 8, the bridge and the game) and **B** (steps 9 to 12, the guide and docs). If the spec proves too big it splits cleanly there.

## Scope

**In:**

- **Guide `JAVA-GAME-INTEGRATION-GUIDE.md`** at the repo root, same voice and structure as `GAME-INTEGRATION-GUIDE.md` (table of contents, "Try it" checkpoints, a mistakes table, a file checklist), written for a developer who knows Java and does not know TeaVM, React, Next.js or Supabase. It must contain:
  1. Introduction, prerequisites (JDK 17 or newer, no global Maven needed because the Maven Wrapper is committed, Node, `.env`, Supabase access) and the running example.
  2. The big picture: the diagram of `GAMES` > play page > `GamePlayer` > canvas wrapper, extended with the Java layer (`java/<id>/` compiled to `public/game-assets/<id>/<id>.js`, loaded by the shared `lib/java-bridge/loader.ts` and mounted by `JavaEngineCanvas`), and a table "what is different from the TypeScript guide".
  3. A route comparison table: TeaVM (taught), CheerpJ, manual port to TypeScript, with columns for output, startup cost, frame-time risk, how much Java survives, and licensing to verify. It states which questions to ask before choosing (does the game use Swing widgets, threads, files, reflection, a big third-party library?).
  4. Things to keep in mind: the static export, `withBasePath()`, the performance rules of SPEC 12, original art and names, the id is permanent, the origin tag, English UI text, nothing in `localStorage`, bundle size budget, and the **TeaVM class library subset** (no `java.awt`, no `javax.swing`, no `java.io.File`, no sockets, no real threads, little reflection; check the TeaVM docs for any class not used in the example).
  5. Step 1, project setup: layout of `java/<id>/`, `pom.xml`, Maven Wrapper, TeaVM configuration, output into `public/game-assets/<id>/`, the `build:java` npm script, ignore rules.
  6. Step 2, the Java engine: the contract in Java, the ten engine rules of the TypeScript guide re-stated for Java, the extra Java rules (below), the game loop with `requestAnimationFrame`, and the full code of Dot Catcher.
  7. Step 3, the bridge: JSO overlay types, `@JSFunctor` callbacks, how Java registers its engine factory on `window.ArcadeVaultJava`, and why callbacks and listeners must be kept in fields.
  8. Step 4, the TypeScript side: the reusable bridge (`lib/java-bridge/` types and loader, the generic `JavaEngineCanvas` with its Strict Mode unmount-before-load handling and load-error state), what a new game writes (a thin per-game wrapper of about 25 lines, a palette table, a canvas CSS rule), and **how each optional platform feature is forwarded from a Java game**: `levelRequest` (`levelSelect`, Java `setLevel`), `mode` and `difficulty` (the `options` object and Java `setDifficulty`), and music (registry `music` plus the `onMusic` event). For each: the registry field, the TypeScript prop, the Java method or callback to declare, the semantics the engine must keep (for example `setLevel` keeps score and lives, a different difficulty restarts the match), and a worked snippet. It ends with "test a forward without a Java build": a ten-line plain JavaScript stub engine registered on `window.ArcadeVaultJava` that logs each call, and how to try it through a temporary catalog and registry entry that is never committed.
  9. Steps 5 and 6, registry, catalog, cover and the `games` migration, pointing at `GAME-INTEGRATION-GUIDE.md` for the field tables instead of copying them.
  10. Step 7, polish: skins as palettes passed from TypeScript, touch pad, sound effects, haptics, and how to measure and read performance for a Java game.
  11. **Adapting an existing Java game**, with these recipes:
      - Graphics: `Graphics2D.fillRect` > `fillRect`; `fillOval` > `arc` + `fill`; `drawLine` > `moveTo`/`lineTo`/`stroke`; `setColor` > `fillStyle`/`strokeStyle`; `drawImage` > `drawImage` from an offscreen canvas; `AffineTransform` > `setTransform`; `BufferedImage` > offscreen canvas; `Color` > CSS string; `drawString` > not allowed for HUD text (platform HUD owns score, lives, level).
      - Input: `KeyListener` `getKeyCode()` > `KeyboardEvent.code` (table `VK_LEFT` > `ArrowLeft`, `VK_A` > `KeyA`, `VK_SPACE` > `Space`, and so on); `MouseListener` > pointer events with `getBoundingClientRect`.
      - Loop and time: `javax.swing.Timer`, `Thread.sleep` loops and `ScheduledExecutorService` > a `requestAnimationFrame` callback with `dt`; `System.nanoTime()` > the rAF timestamp.
      - Sound and music: `javax.sound.sampled` > `onSound(name)` plus files in `public/game-assets/<id>/`; background music tracks > registry `music` (and `music.alt` for a second track chosen with `onMusic`).
      - Level select, difficulty and modes: a `setLevel`, `setDifficulty` or mode constructor option in the Java engine > the matching optional handle method or `options` key of the bridge.
      - Persistence: `Preferences`, files and serialization > not allowed, state lives in memory (same rule as the whole platform).
      - Randomness: `java.util.Random` works; keep seeded generators if the game uses them.
      - Resources: `getResourceAsStream` > files served from `public/` and loaded by TypeScript.
      - Toolkit notes: **Swing/AWT** (port the model and `paintComponent` body; the widget tree is dropped), **libGDX** (map `create/render/pause/resume/dispose` to the contract; keep rules free of `Gdx.*` calls and draw through `Gfx`; check the status of its web backends before relying on them), **JavaFX** (not compilable to the browser by TeaVM; port the model classes and rewrite `Canvas` drawing against `Gfx`), **logic-only Java** (write the drawing new in `CanvasGfx`).
  12. Debugging (browser console and source maps for development builds, reading a TeaVM "unsupported class" error, a 404 under the GitHub Pages sub-path, stuck keys, two engines in Strict Mode).
  13. Documentation updates, the test checklist, the common mistakes table, the file checklist and "where to learn more".
- **Shipped example: Dot Catcher in Java.**
  - Rules identical to the TypeScript guide's example (paddle 110x16 at 520 px/s, dot radius 12, 10 points per dot, 3 lives, level `1 + floor(caught / 10)`, `fallSpeed` `min(480, 160 + 30 * (level - 1))`, `spawnInterval` `max(0.35, 1.1 - 0.07 * (level - 1))`, `MAX_DT` 0.05 s, "crossed the paddle line" catch test). Canvas 800x600.
  - Java project `java/dot-catcher/` (below), TeaVM `JAVASCRIPT` target, output `public/game-assets/dot-catcher/dot-catcher.js`, committed.
  - TypeScript: `lib/dot-catcher/constants.ts` (skins) and `components/dot-catcher-canvas.tsx` (a thin wrapper over the shared bridge), canvas CSS and cover CSS in `app/globals.css`.
- **Reusable TypeScript Java bridge (user request).**
  - `lib/java-bridge/types.ts`: `JavaCallbacks`, `JavaEngineHandle<P>`, `JavaEngineFactory<P>` and the `window.ArcadeVaultJava` global, generic over the palette type `P`.
  - `lib/java-bridge/loader.ts`: `loadJavaEngine<P>(gameId, src)`. One `<script>` per game id and page, a cached promise, start of the TeaVM entry point as recorded in step 1, rejection if the script fails or the factory is missing (a rejected promise is evicted from the cache so a later mount can retry).
  - `components/java-engine-canvas.tsx`: `JavaEngineCanvas<P>`, a client component any Java game wraps. It owns everything the TypeScript guide's wrapper owns (engine created once in an effect, destroyed on cleanup, latest-callbacks ref, forwarding of `paused`, `endSignal` and the palette) plus what async loading adds (unmount before the script loads, the latest `paused` applied right after creation, a load-error state).
  - It forwards `paused`, `endSignal`, `palette`, `levelRequest`, `mode`, `difficulty` and the eight callbacks `onScore`, `onGameOver`, `onLives`, `onLevel`, `onLines`, `onSound`, `onHaptic`, `onMusic`. Every callback is always passed to Java (no-ops when the platform did not provide one).
  - Shared CSS for the load-error message (`.java-engine-error`) in `app/globals.css`.
  - **Forwarding of the four optional platform features (user request).** The bridge forwards them, and the guide shows how a Java game opts in to each:
    - `levelRequest` (`{ level, id }`, platform to engine): an effect calls the optional `handle.setLevel(level)` whenever `levelRequest` changes. A request that arrives before the script has loaded is applied right after the engine is created.
    - `mode` (string, read once): passed to the factory in an `options` object at creation, like the TypeScript engines that read `mode` in their constructor options.
    - `difficulty` (string): passed in the same `options` object at creation, and an effect calls the optional `handle.setDifficulty(id)` on change. The bridge forwards the string untouched; the per-game wrapper narrows it with a guard before passing it, as `super-tennis-canvas.tsx` does.
    - Music (engine to platform): the track itself is platform configuration (`music` and `music.alt` in the registry, played by `useBackgroundMusic`), so Java has nothing to load. The only link is the `onMusic("stage" | "boss")` event, a new callback of the bridge.
    - Optional means optional: a method a game's Java handle does not declare is simply absent on the JavaScript object, and the bridge calls it with `?.`. A game that does not use a feature writes nothing for it.
  - Dot Catcher is the first consumer and exercises `levelRequest` for real (below). `mode`, `difficulty` and `onMusic` are built, documented and verified with a temporary stub engine (Implementation plan, step 4), not with a shipped game.
- **Shipped example, continued.**
  - **Level select (user decision):** registry `levelSelect: { min: 1, max: 99 }`. The Java `setLevel(level)` clamps to 1..99, does nothing before `start()` or after game over, sets the caught count to `(level - 1) * 10`, clears the falling dots, restarts the spawn timer at 0.5 s, **keeps score and lives**, and emits the new level at once (also while paused) so the HUD and the redraw follow, exactly like Alien Attack.
  - Registry entry, `GAMES` entry, `games` row by migration `add_dot_catcher_game`.
  - Sound effects `catch`, `miss`, `gameover` (generated `.wav`, volume 0.2, no music), haptic `death` on a miss.
  - Pipeline: `/full-game-impl` stages after the implementation steps: `mobile-porter` (touch pad: `left` / `right` hold), `skin-designer` (five mandatory skins plus fresh ones, `themes: false`), `game-perf-booster`.
  - JUnit tests for the pure Java logic (`GameMath`) run by `mvn test` on the JVM. This is the one place a Java game can be tested without a browser and the guide uses it as a selling point.
- **Knock-on edits.** `GAME-INTEGRATION-GUIDE.md` gets a short callout: the catalog now contains a Java Dot Catcher, so `dot-catcher` is taken and a reader following the TypeScript example must pick another id (for example `dot-catcher-lab`), plus a link to the Java guide in its "Where to learn more". `references/GAMES.md`, `CLAUDE.md` (catalog counts 12 to 13, per-game note, a "Java games" section, the engine-location exception) and `README.md` link to the new guide.
- UI of the cover designed with `/frontend-design`.

**Out of scope (for future specs):**

- A shipped Java game that uses `mode`, `difficulty` or music (a mode picker, a difficulty select or a music loop for Dot Catcher). The forwards exist and are verified with a stub, but no catalog game consumes them yet.
- Forwarding anything the platform adds later (new `GameCanvasProps`). The guide explains the pattern for adding one.
- A shared **Java** library (a Maven artifact with `Gfx`, `CanvasGfx`, `Browser` and the JSO bridge types). Each Java game still carries its own copy of those small files; the guide marks them as the files to copy.
- Building Java in CI (JDK, Maven step in `deploy-pages.yml`), and keeping Java sources outside the repo.
- Teaching CheerpJ, a WebAssembly GC target or a manual TypeScript port in depth (comparison table only).
- Porting a real third-party Java game, libGDX or JavaFX project end to end. The recipes are described, not built.
- Java applets, JNLP, Java Web Start, server-side Java, multiplayer, networking.
- Mouse or touch-drag control of the Dot Catcher paddle, music, new haptic patterns, credits or pins for Dot Catcher beyond the platform's normal play-time credit.
- Changing any engine, `GamePlayer`, the other agents' files (`.claude/agents/*`) or the skills. The pipeline is steered through the spec and the prompts instead.
- Automated browser tests. (Java unit tests of pure logic are in.)
- Saving progress, passwords or anything in `localStorage`.

## Data model

Catalog entry in `GAMES` (`lib/games.ts`, last entry; 13 games after this spec):

```ts
{
  id: "dot-catcher",
  title: "DOT CATCHER",
  short: "Slide the paddle and catch every falling dot.",
  long: "Dots rain from the top of the screen. Slide your paddle left and right to catch them and score points. Miss three and the run is over. Every ten catches the dots fall faster and the rain gets thicker.",
  cat: "ARCADE",
  cover: "cover-dot-catcher",
  color: "cyan",
  origin: "ai",
}
```

The `games` row is a manual copy of this entry (migration `add_dot_catcher_game`, `origin` included, no default exists). The UI never mentions Java.

Repository layout added:

```
java/dot-catcher/
  pom.xml
  mvnw, mvnw.cmd, .mvn/wrapper/maven-wrapper.properties
  src/main/java/arcadevault/dotcatcher/
    Main.java              entry point: registers the factory on window.ArcadeVaultJava
    DotCatcherEngine.java  rules, loop, input, drawing (the engine contract)
    Constants.java         sizes, speeds, points (final constants only)
    GameMath.java          pure functions: clampScore, levelFor, caughtForLevel, fallSpeed, spawnInterval
    Dot.java               { x, y, prevY }
    Gfx.java               drawing interface the engine uses
    CanvasGfx.java         Gfx implemented on a Canvas 2D context through JSO
    Browser.java           JSO helpers: requestFrame, cancelFrame, add/removeListener
    Bridge.java            JSO types: JsCallbacks, JsPalette, EngineHandle, EngineFactory, FrameHandler, KeyHandler
  src/test/java/arcadevault/dotcatcher/GameMathTest.java
public/game-assets/dot-catcher/dot-catcher.js        committed build output
public/game-assets/dot-catcher/{catch,miss,gameover}.wav
lib/java-bridge/types.ts       reusable: contract types and the window global
lib/java-bridge/loader.ts      reusable: loadJavaEngine<P>(gameId, src)
components/java-engine-canvas.tsx  reusable: generic wrapper for any Java engine
lib/dot-catcher/constants.ts   W, H, SkinColors, SKINS, DotCatcherSkin, toSkin
components/dot-catcher-canvas.tsx  thin wrapper over JavaEngineCanvas
```

The bridge contract (the only thing that crosses between Java and TypeScript), in the reusable files:

```ts
// lib/java-bridge/types.ts
export interface JavaCallbacks {
  onScore(score: number): void;
  onLives(lives: number): void;
  onLevel(level: number): void;
  onLines(lines: number): void;
  onGameOver(finalScore: number): void;
  onSound(name: string): void;
  onHaptic(name: string): void;
  onMusic(track: string): void; // the bridge narrows it to "stage" | "boss" for the platform
}
// P is the palette type the game passes to Java (Dot Catcher: SkinColors).
export interface JavaEngineHandle<P> {
  start(): void;
  pause(): void;
  resume(): void;
  end(): void;
  destroy(): void;
  setSkin(palette: P): void;
  // Optional: present only if the game's Java handle declares them.
  setLevel?(level: number): void; // levelSelect: keep score and lives
  setDifficulty?(id: string): void; // a different difficulty restarts the match
}
// Read once at creation. Always an object, with the keys the platform provided.
export interface JavaEngineOptions {
  mode?: string;
  difficulty?: string;
}
export type JavaEngineFactory<P> = (
  canvas: HTMLCanvasElement,
  callbacks: JavaCallbacks,
  palette: P,
  options: JavaEngineOptions,
) => JavaEngineHandle<P>;

declare global {
  interface Window {
    ArcadeVaultJava?: Record<string, JavaEngineFactory<unknown>>;
  }
}

// lib/java-bridge/loader.ts
export function loadJavaEngine<P>(
  gameId: string,
  src: string, // already passed through withBasePath() by the caller
): Promise<JavaEngineFactory<P>>;

// components/java-engine-canvas.tsx
export interface JavaEngineCanvasProps<P> {
  gameId: string;
  src: string;
  width: number;
  height: number;
  className: string; // per-game canvas class (absolute fill, touch-action: none)
  ariaLabel: string;
  palette: P;
  paused: boolean;
  endSignal: number;
  onScore: (score: number) => void;
  onGameOver: (finalScore: number) => void;
  onLives?: (lives: number) => void;
  onLevel?: (level: number) => void;
  onLines?: (lines: number) => void;
  onSound?: (name: string) => void;
  onHaptic?: (name: string) => void;
  onMusic?: (track: "stage" | "boss") => void;
  levelRequest?: { level: number; id: number }; // calls handle.setLevel when it changes
  mode?: string; // read once, at creation
  difficulty?: string; // at creation, then handle.setDifficulty on change
}
export function JavaEngineCanvas<P>(
  props: JavaEngineCanvasProps<P>,
): JSX.Element;
```

The per-game wrapper stays a normal registry `Canvas` (it receives `GameCanvasProps`): it narrows the `skin` string with `toSkin()`, looks the palette up in `SKINS` and renders `<JavaEngineCanvas<SkinColors> gameId="dot-catcher" src={withBasePath("/game-assets/dot-catcher/dot-catcher.js")} ... />`.

Java side of the same contract (JSO overlay types, short form):

```java
@JSFunctor public interface FrameHandler extends JSObject { void frame(double timestamp); }
@JSFunctor public interface KeyHandler extends JSObject { void key(KeyboardEvent e); }
public interface JsCallbacks extends JSObject { void onScore(int s); /* onLives, onLevel, onLines, onGameOver, onSound, onHaptic, onMusic */ }
public interface JsPalette extends JSObject { @JSProperty String getBackground(); /* getFloor, getPaddle, getDot */ }
public interface JsOptions extends JSObject { @JSProperty String getMode(); @JSProperty String getDifficulty(); } // null when absent
// A feature is opted in by declaring its method. Dot Catcher declares setLevel; it has no setDifficulty.
public interface EngineHandle extends JSObject { void start(); void pause(); void resume(); void end(); void destroy(); void setSkin(JsPalette p); void setLevel(int level); }
@JSFunctor public interface EngineFactory extends JSObject { EngineHandle create(HTMLCanvasElement canvas, JsCallbacks cb, JsPalette palette, JsOptions options); }
public interface Gfx { void setColor(String css); void fillRect(double x, double y, double w, double h); void fillCircle(double x, double y, double r); }
```

Conventions:

- **Ownership.** Java owns rules, input, timing and drawing. TypeScript owns the platform-facing data: skin palettes (`SKINS` in `constants.ts`), the skin id guard `toSkin()`, the registry and every URL. Java never stores a skin id: it receives a four-color palette and copies the strings. This keeps `skin-designer` and `references/skins-log.md` working unchanged and means adding a skin never needs a Java rebuild.
- **Always-present callbacks.** `JavaEngineCanvas` passes all eight callbacks always (no-ops where the platform does not provide one), so Java does no null checks.
- **What is reusable and what is per game.** Reusable and game-agnostic: `lib/java-bridge/*`, `JavaEngineCanvas`, `.java-engine-error`. Per game: the Java project, the palette table and `toSkin`, the thin wrapper, the canvas CSS class, the registry and catalog entries. The bridge never imports anything from `lib/dot-catcher/`.
- **Registration.** `Main.main` stores the factory in `window.ArcadeVaultJava["dot-catcher"]` with a `@JSBody`. How the compiled entry point is started (calling TeaVM's generated `main`, then removing the global so two Java games cannot collide) is fixed by step 1 and written in the guide; the `window.ArcadeVaultJava` contract is independent of it.
- **Coordinates and units.** Origin top-left, logical 800x600, seconds for time, pixels per second for speed, `double` for everything in the frame loop.

Java-specific engine rules (added to the ten rules of `GAME-INTEGRATION-GUIDE.md` section 3.3, which all still apply):

1. **No mutable `static` fields in the engine.** The compiled module loads once per page, so a static field would leak the previous run into PLAY AGAIN. Only `static final` constants.
2. **Nothing blocks.** No `Thread`, `Timer`, `ExecutorService`, `Thread.sleep`, `synchronized` waits, `Object.wait`. One `requestAnimationFrame` callback is the loop.
3. **Only the TeaVM class library.** No `java.awt`, `javax.swing`, `java.io.File`, reflection or sockets in the engine.
4. **Time comes from the rAF timestamp**, never from `System.currentTimeMillis()` or `nanoTime()`; `dt` is computed and capped as in the TypeScript guide.
5. **Hot path discipline.** No `long`, no `String.format`, no per-frame allocation inside `update` and `draw` (in-place compaction of the dot list instead of a new list per frame), because the JavaScript target emulates `long` and garbage hurts frame time.
6. **Keep functors in fields.** The `KeyHandler`, `FrameHandler` and visibility handlers are created once and stored, so `removeEventListener` receives the same reference it was given.
7. **`destroy()` is idempotent** and after it no callback fires and nothing draws.

## Implementation plan

Each step leaves the repo building and the site working. Steps 1 to 8 are half A (the bridge and the game), steps 9 to 12 half B (the guide).

1. **Toolchain spike and build wiring.** Create `java/dot-catcher/` with the Maven Wrapper, `pom.xml` (TeaVM `teavm-maven-plugin`, `teavm-classlib`, `teavm-jso`, `teavm-jso-apis`, JUnit; `maven.compiler.release` 17) and a `Main` that registers a factory whose engine only fills the canvas. TeaVM's documentation shows 0.16.0 on its getting-started page and 0.15.0 in its release notes: pin the latest stable version that exists on Maven Central **that day** and record it in the pom and in the guide. Configure `targetType JAVASCRIPT`, `targetDirectory` `${project.basedir}/../../public/game-assets/dot-catcher`, `targetFileName` `dot-catcher.js`, minified, no source maps in the committed build, no generated main page. Add `"build:java": "java/dot-catcher/mvnw -f java/dot-catcher/pom.xml package"` (Windows and POSIX forms recorded) to `package.json`, `java/**/target/` to `.gitignore`, `public/game-assets/**/*.js` to the ESLint `globalIgnores` and to `.prettierignore`. Record: the file size, how the entry point must be started, and whether two builds are byte-identical. Check: `npm run build:java` writes the file, `npm run lint` and `npm run build` still pass, nothing in the UI changed.
2. **Pure Java logic.** `Constants.java`, `GameMath.java`, `Dot.java` and `GameMathTest.java` (score clamping at both ends, level boundaries at 9/10/19/20 catches, `caughtForLevel` as the inverse of `levelFor` for levels 1 to 99, speed and interval caps). Check: `mvnw test` passes on the plain JVM.
3. **Java engine and bridge.** `Gfx`, `CanvasGfx`, `Browser`, `Bridge`, `DotCatcherEngine` (full contract, emitted-values guard, held keys by `e.code`, `preventDefault` only for `ArrowLeft`, `ArrowRight`, `KeyA`, `KeyD` while running, blur and visibility clearing, crossed-line catch, lives, level, `onSound`/`onHaptic` events, `onGameOver` once, `setLevel(int)` as described in Scope) and the real `Main`, with the `Bridge` types including `JsOptions` and a `setLevel` on `EngineHandle`. Check: `npm run build:java` succeeds with no TeaVM error or warning about unsupported classes.
4. **Reusable TypeScript bridge.** `lib/java-bridge/types.ts`, `lib/java-bridge/loader.ts` (one `<script>` per game id through the `src` the caller built with `withBasePath()`, cached promise evicted on failure, the entry-point start sequence recorded in step 1) and `components/java-engine-canvas.tsx` (engine created once in an effect with `[]` dependencies, a `cancelled` flag set by the cleanup, latest-callbacks ref, the latest `paused` and `levelRequest` applied right after creation, `endSignal` ignored until the engine exists, `mode` and `difficulty` passed in the `options` object at creation, an effect for `levelRequest` calling `handle.setLevel?.()`, an effect for `difficulty` calling `handle.setDifficulty?.()` only when the value differs from the one given at creation, `onMusic` narrowed to `"stage" | "boss"` (anything else becomes `"stage"`), load-error state rendering `.java-engine-error` with the text `COULD NOT LOAD THE GAME. RELOAD THE PAGE.` and a `console.error`), plus the `.java-engine-error` rule in `app/globals.css`. The bridge imports nothing game-specific. Check: `npm run lint` and `npm run build` pass; nothing reaches the UI yet.
   - **Verify the four forwards with a temporary stub.** Write a plain JavaScript stub engine (about ten lines, not Java) in a throwaway `public/game-assets/bridge-stub/stub.js` that registers on `window.ArcadeVaultJava["bridge-stub"]`, fills the canvas and `console.log`s every method call, every `options` key it receives and every `onMusic` it triggers. Add a throwaway `bridge-stub` entry to `GAMES`, a throwaway wrapper and a registry entry with `levelSelect`, `modes` (two modes), `difficultySelect`, and `music` with an `alt` track that reuses an existing audio file under `public/game-assets/`. Exercise all four in the browser (checklist in the acceptance criteria), then **delete every throwaway file and edit**. The same stub, minus the optional methods, proves that a game that opts in to none of them gets no error. The stub code is copied into the guide as the "test a forward without a Java build" snippet (step 9), so it is written once and kept in the text only.
5. **Dot Catcher TypeScript glue.** `lib/dot-catcher/constants.ts` (`W`, `H`, `SkinColors`, `SKINS` with `retro` and `neon`, `toSkin` guard), `components/dot-catcher-canvas.tsx` (maps the `skin` string to a palette and renders `JavaEngineCanvas`), and the `.dot-catcher-canvas` rule in `app/globals.css` (`touch-action: none`). Check: `npm run lint` and `npm run build` pass; the wrapper is not reachable from the UI yet.
6. **Catalog, registry and cover.** Add the `GAMES` entry, the `cover-dot-catcher` class (static, site palette, no animation), and the registry entry (`controls` arrows and `A` `D`, `stats { lives: true, lines: false, level: true }`, `levelSelect { min: 1, max: 99 }`, `appearance` with `retro` and `neon`, `themes: false`). The Dot Catcher wrapper passes `levelRequest` through to `JavaEngineCanvas`. Check: `/library` shows the card and `/games/dot-catcher/play` is fully playable: HUD, PAUSE (with the `LEVEL − NN +` selector), END, GAME OVER, PLAY AGAIN. SAVE SCORE fails until step 7 (expected).
7. **Backend row.** Migration `add_dot_catcher_game` applied with MCP `apply_migration`, file saved as `supabase/migrations/<applied version>_add_dot_catcher_game.sql`, row identical to the `GAMES` entry. Types are not regenerated (no schema change). Check: `select id, title, origin from public.games where id = 'dot-catcher'`, then save a score signed in and see it on `/games/dot-catcher`.
8. **Sound effects.** Generate `catch.wav`, `miss.wav`, `gameover.wav` (original, generator not shipped), add the `sfx` block with `withBasePath()`. Check: sounds play on the three events, mute works, nothing plays while muted.
9. **Guide, part 1.** Write `JAVA-GAME-INTEGRATION-GUIDE.md` sections 0 to 9 of the outline above. Every worked-example snippet is pasted from the repo file it comes from and marked with an HTML comment naming that file (`<!-- file: java/dot-catcher/src/... -->`).
10. **Guide, part 2.** Sections on adapting an existing Java game (the recipe tables and toolkit notes), debugging, the test checklist, the mistakes table, the file checklist and where to learn more.
11. **Docs.** Callout and link in `GAME-INTEGRATION-GUIDE.md`; `references/GAMES.md` (table row, section, counts); `CLAUDE.md` (13 games, per-game note, "Java games" section naming `lib/java-bridge/` and `JavaEngineCanvas` as the reusable layer, the exception to "engine in `lib/<game>/`": the Java engine lives in `java/<id>/` and `lib/<id>/` holds only TypeScript glue and skins); `README.md` link.
12. **Reconcile after the pipeline.** After `/full-game-impl` has run `mobile-porter`, `skin-designer` and `game-perf-booster`, rebuild Java (`npm run build:java`) if any stage edited a `.java` file, and update the guide, `references/GAMES.md` and `CLAUDE.md` with the final skin list, touch pad mapping, the measured numbers and the final bundle size, then re-check the snippet markers against the files.

## Pipeline overrides

Run the normal stages after step 8 and **do not skip any**: `mobile-porter`, `skin-designer`, `game-perf-booster`. Three instructions apply because this game is Java:

- **Engine location.** The engine is in `java/dot-catcher/src/main/java/arcadevault/dotcatcher/`, not `lib/dot-catcher/engine.ts`. Any stage that changes engine code edits the Java files, then runs `npm run build:java` and keeps the rebuilt `public/game-assets/dot-catcher/dot-catcher.js` in the same change.
- **Skins.** Palettes are `SKINS` in `lib/dot-catcher/constants.ts` as in every other game, and are passed to Java as `{ background, floor, paddle, dot }`. Adding a skin never needs a Java rebuild. The registry `appearance.skins` list must match `SKINS`.
- **Perf.** Frame time is measured with `references/perf/measure-fps.md` as usual; the Java file is a normal script on the page. Step 12 is a manual pass done by the implementer after the stages finish, because the guide cannot be final before them.

## Acceptance criteria

**Build and repo**

- [ ] `npm run build:java` on a clean checkout (only a JDK 17 or newer installed, no Maven) writes `public/game-assets/dot-catcher/dot-catcher.js` and leaves `git status` clean.
- [ ] `java/dot-catcher/mvnw test` passes, with at least one test for each function of `GameMath` and the score clamp at both ends.
- [ ] `npm run lint` and `npm run build` pass, and the production build is still a static export with no new server file.
- [ ] `dot-catcher.js` is at most 500 KB uncompressed.
- [ ] No `java/**/target/` folder, source map or `.class` file is committed.
- [ ] `deploy-pages.yml` is unchanged.

**Catalog and backend**

- [ ] The Library shows the Dot Catcher card with its cover, the `🤖` origin emoji and PLAY, and `/games/dot-catcher` shows an empty leaderboard before any score.
- [ ] The `games` row `dot-catcher` is identical to the `GAMES` entry, including `cover` and `origin` `ai`.
- [ ] Signed in, SAVE SCORE stores the score and it appears on the leaderboard; as a guest the modal shows `SIGN IN TO SAVE YOUR SCORE`.
- [ ] Playing over 30 seconds with a positive score shows `+N CREDITS`.

**Engine contract (observable in the browser)**

- [ ] The HUD shows score 0, lives 3, level 1 as soon as the run starts, and updates only when a value changes.
- [ ] A caught dot adds exactly 10 points; a missed dot removes exactly one life and vibrates with `death` on a touch layout.
- [ ] Level goes to 2 after 10 caught dots and dots then fall faster and appear more often.
- [ ] PAUSE freezes everything and RESUME continues with no position jump.
- [ ] END and losing the third life each show the GAME OVER modal exactly once.
- [ ] After game over, arrow keys do not move anything and do not scroll the page.
- [ ] PLAY AGAIN starts at score 0, 3 lives, level 1 with no dots left over, and the previous engine's listeners are gone (one key press moves the paddle by one step, not two).
- [ ] Switching tabs while holding `→` leaves no stuck key.
- [ ] In development (React Strict Mode) only one engine is alive: after mount, unmount, mount, a key press moves the paddle once.
- [ ] Unmounting the page before the script has loaded does not create or start an engine and prints no error.
- [ ] If `dot-catcher.js` fails to load (blocked in the Network panel), the page shows `COULD NOT LOAD THE GAME. RELOAD THE PAGE.` inside the screen area, logs a console error, and no GAME OVER modal appears.
- [ ] After a failed load, leaving the page and opening it again with the network restored loads the game (the failed promise was not cached).
- [ ] Pausing before the script has finished loading starts the run paused: no dot falls until RESUME.
- [ ] No file under `lib/java-bridge/` or `components/java-engine-canvas.tsx` contains the text `dot-catcher`, and `JavaEngineCanvas` renders correctly with a palette type other than `SkinColors` (type-checked with a throwaway call that is not committed).
- [ ] The canvas draws only the playfield: no score, lives, level, PAUSED or GAME OVER text.

**Level select (Dot Catcher) and the bridge forwards**

- [ ] While paused, the overlay shows `LEVEL − 01 +`; pressing `+` once sets the HUD level to 2 at once, leaves score and lives unchanged, removes every falling dot, and after RESUME the first new dot appears after about 0.5 s and falls at the level 2 speed.
- [ ] The selector clamps at 1 and 99, and `setLevel` after game over changes nothing.
- [ ] PLAY AGAIN starts at level 1 even after a level was selected.
- [ ] With the temporary stub: each `levelRequest` calls `setLevel` exactly once with the requested level, and a request made before the script finished loading is applied right after the engine is created.
- [ ] With the stub: picking a mode shows `mode` in the `options` object the factory receives, and PLAY AGAIN keeps it; the difficulty reaches the factory in `options` at creation, `setDifficulty` is called on a change and is not called for the value given at creation.
- [ ] With the stub: `onMusic("boss")` switches the platform to the alternate track and `onMusic("stage")` switches back; any other string behaves as `"stage"`.
- [ ] With the stub minus its optional methods, level, difficulty and mode requests raise no error and no console warning.
- [ ] After the stub verification, `git status` shows no `bridge-stub` file, no extra `GAMES` entry and no extra registry entry.

**Appearance, touch, sound, perf**

- [ ] The five mandatory skins (`retro` default, `neon`, `pastel`, `gothic`, `negative`) and the fresh ones approved in `skin-designer` phase A exist in `SKINS` and in the registry, change the canvas at once (also while paused and after game over), and keep a 3:1 contrast between paddle, dots and background.
- [ ] Below 768 px the touch pad shows `◀` and `▶` and moves the paddle while held.
- [ ] `catch`, `miss` and `gameover` play at volume 0.2 and are silent while muted.
- [ ] With the `measure-fps.md` method at 1280 px and CPU x1, `taskMs` is at most 1.0 ms per frame, and `longFrames` is 0.
- [ ] Loading the site under `NEXT_PUBLIC_BASE_PATH=/Arcade-Vault-Claude` (build, serve `out/` under that folder) still loads `dot-catcher.js` and the sounds.
- [ ] The browser console shows no error or warning from the game during a full run.

**Guide and docs**

- [ ] `JAVA-GAME-INTEGRATION-GUIDE.md` exists at the repo root with every numbered section of the Scope outline, a table of contents, and a "Try it" checkpoint after every step.
- [ ] Every code block of the worked example is preceded by a `<!-- file: ... -->` marker and is identical to that file's content in the repo (checked after step 12).
- [ ] The guide contains the route comparison table, the Graphics2D, input, loop and persistence recipe tables, and one note each for Swing/AWT, libGDX, JavaFX and logic-only Java.
- [ ] The guide explains the reusable bridge (types, loader, `JavaEngineCanvas`), shows the thin per-game wrapper, and explains how `levelRequest`, `mode`, `difficulty` and music are forwarded from a Java game (registry field, prop, Java method or callback, engine semantics, snippet), including the stub technique for testing a forward without a Java build.
- [ ] The guide states the pinned TeaVM version, the JDK minimum and the TeaVM class library subset, and the version matches the pom.
- [ ] `GAME-INTEGRATION-GUIDE.md` tells readers `dot-catcher` is taken and links to the Java guide.
- [ ] `references/GAMES.md`, `CLAUDE.md` and `README.md` mention Dot Catcher, the Java route and the new guide, and `CLAUDE.md` says 13 catalog games everywhere it says 12.
- [ ] The words `Java` do not appear in any user-visible text of the app (card, detail page, play page, modal).

## Decisions

- **Yes:** TeaVM to JavaScript as the taught route. Small static output, works on GitHub Pages, keeps the engine contract and performs like a normal script. **No:** CheerpJ as the main route: it runs unmodified bytecode but ships a large runtime, starts slower, has licensing terms to verify and is harder to hold to the frame-time rules. Kept in the comparison table. **No:** manual port to TypeScript as the main route: robust, but already covered by the first guide and it is no longer a Java game.
- **Yes:** the contract is the only thing that crosses the bridge. Same method names, same "callbacks only on change" and "`onGameOver` once" rules, so `GamePlayer` stays untouched.
- **Yes:** Java owns drawing through a `Gfx` interface implemented with JSO on Canvas 2D. It is how an existing Swing or Java2D game would be adapted (swap the `Graphics2D` calls for `Gfx` calls). **No:** a Java rules-only engine with a TypeScript renderer reading snapshots: easier skins, but most of the game would not really be Java.
- **Yes:** palettes owned by TypeScript and passed to Java. Skins stay a platform concern, `skin-designer` works unchanged and a new skin needs no rebuild. **No:** palettes in Java: they would tie every skin change to a rebuild and a committed binary diff.
- **Yes:** commit the compiled JavaScript. CI needs no JDK and stays as is, and reviewers can run the site without Java. **No for now:** building in CI. Cleaner repo, but it changes the deploy pipeline; a later spec can do it once more than one Java game exists. **No:** sources kept outside the repo, because the game could not be reviewed or rebuilt here.
- **Yes:** the Maven Wrapper is committed so the only prerequisite is a JDK. **Yes:** Maven writes straight into `public/game-assets/dot-catcher/`, so there is no copy step to forget.
- **Yes:** the entry-point start sequence is a step 1 measurement, not an assumption, because TeaVM's generated `main` is a global and two Java games would collide. The stable part (`window.ArcadeVaultJava[id]`) is fixed now.
- **Yes (reversed after the first draft, user request):** a reusable TypeScript bridge, `lib/java-bridge/` and the generic `JavaEngineCanvas`, built now. The guide then teaches "write a thin wrapper" instead of "copy 100 lines of async-safe lifecycle code", and the hardest part to get right (unmount before load, Strict Mode, load error) exists once. The first draft kept the glue inside `lib/dot-catcher/` because one game gives little to generalize from; the cost of that is accepted and limited as follows.
- **Yes (reversed after the second draft, user request):** the bridge forwards `levelRequest`, `mode`, `difficulty` and `onMusic` as well, and the guide shows how a Java game opts in to each. The second draft left them out because nothing would exercise them. The user wanted them in scope; the risk of untested code is handled by the two decisions below.
- **Yes:** Dot Catcher gets a real level select (`levelSelect` 1..99, Java `setLevel` keeps score and lives, as Alien Attack does), so the most common forward is exercised by a shipped Java game. **Yes:** `mode`, `difficulty` and `onMusic` are verified with a temporary plain-JavaScript stub engine that is never committed, and the stub is kept in the guide as a technique. **No:** inventing modes, a difficulty select or a music loop for Dot Catcher just to exercise code; that would change the game's rules and assets for the sake of a test.
- **Yes:** optional features are optional methods on the Java handle (absent on the JavaScript object when not declared) and the bridge calls them with `?.`. A game opts in by declaring a method and writes nothing otherwise. **No:** a capabilities object or a registration call; the method's presence is the capability.
- **Yes:** `mode` and `difficulty` travel in one `options` object read at creation, plus `setDifficulty` for later changes, mirroring how the TypeScript engines take `mode` in their options and `super-tennis-canvas.tsx` calls `setDifficulty` in an effect. The bridge passes the strings untouched; the per-game wrapper narrows them with a guard, and the Java engine ignores an unknown id. **No:** validation inside the bridge, which cannot know a game's ids.
- **Yes:** music is only the `onMusic` event. The tracks are registry config played by `useBackgroundMusic`, so Java never loads or plays audio. **No:** a Java-side audio API; engines never play sound, which is the platform's rule.
- **Yes:** the palette is a type parameter `P`, not `SkinColors`, so a game with a different skin shape (for example a scene id as in Wingshot) can use the bridge without changing it. **No:** a skin concept inside the bridge; skins stay per game.
- **Yes:** the Java-side helper files (`Gfx`, `CanvasGfx`, `Browser`, the JSO bridge types) are copied per game and the guide marks them. **No:** a shared Java artifact now: it would need publishing or a multi-module Maven build for files of a few dozen lines.
- **Yes:** Dot Catcher keeps the exact rules of the TypeScript guide's example so both guides describe one game. **Yes:** the example is shipped, so the TypeScript guide's reader needs a different id (callout in step 11).
- **Yes:** origin `ai`. The game is written by Claude, and the origin tag follows who made it, not the language.
- **Yes:** sound effects only, no music loop, same as Wingshot. **No:** mouse or drag control. Keys and the touch pad drive the paddle, as the engine and the pad already do.
- **Yes:** JUnit tests for `GameMath` only. They are cheap and show a real advantage of Java; the platform still has no test runner and no browser tests.
- **Yes:** step 12 as an explicit manual reconcile pass. The pipeline stages change the registry, skins and sometimes Java files after the guide is first written.

## Risks

| Risk                                                                                                    | Mitigation                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TeaVM version and plugin options differ from what its docs show (docs disagree: 0.15.0 and 0.16.0)      | Step 1 is a spike that pins a version that builds and records the exact options. The guide states only what the spike proved.                                                                                     |
| The generated entry point is a global `main`; a second Java game would collide with it                  | The loader calls it right after the script loads and removes it, the game registers under `window.ArcadeVaultJava[id]`. Verified in step 1.                                                                       |
| Committed build output drifts from the sources                                                          | Acceptance criterion: `npm run build:java` leaves `git status` clean. The guide's file checklist says to rebuild and commit the `.js` with every `.java` change.                                                  |
| Build output is not byte-identical between machines or JDKs                                             | Step 1 measures it. Pin `maven.compiler.release` 17, no timestamps or debug info. If it still differs, the guide documents the minimum JDK and the criterion is rewritten in step 1.                              |
| Bundle size or startup cost too high for a tiny game                                                    | 500 KB budget in the acceptance criteria. The script loads only on the play page, and only once.                                                                                                                  |
| Async load races with React Strict Mode and fast navigation (engine created after unmount, two engines) | `JavaEngineCanvas` uses a `cancelled` flag, creates the engine only if still mounted, applies the latest `paused` after creation. Acceptance criteria cover both cases.                                           |
| A bridge shaped by one game fits the second Java game badly                                             | Palette is generic, the contract is the platform's own engine contract, and the guide lists the extension points. Changing it later is a TypeScript-only change plus a guide note.                                |
| `mode`, `difficulty` and `onMusic` forwards are not used by any shipped game and could rot unnoticed    | Verified with the stub in step 4, the stub is kept in the guide so anyone can repeat the check after changing the bridge, and the guide says to repeat it. A later Java game that uses them makes it a real test. |
| A Java handle without an optional method receives a request for it (for example `difficulty`)           | The bridge calls optional methods with `?.`; a stub variant without them is part of the acceptance criteria.                                                                                                      |
| Stale lint or format errors on the minified file                                                        | ESLint `globalIgnores` and `.prettierignore` entries added in step 1.                                                                                                                                             |
| `skin-designer` or `game-perf-booster` assume a TypeScript engine and edit the wrong place              | Pipeline overrides name the engine location and the rebuild rule; step 12 re-checks.                                                                                                                              |
| TeaVM class library lacks something a real Java game uses, so the recipes over-promise                  | The guide tells readers to check each class against the TeaVM docs, lists the known gaps, and never claims libGDX or JavaFX games compile unchanged.                                                              |
| Frame cost of many small JSO calls per frame                                                            | Dot Catcher issues a few calls per frame. The perf criterion measures it; the guide explains batching and offscreen pre-rendering for bigger games.                                                               |

## What is **not** in this spec

- A shipped game that uses `mode`, `difficulty` or a music loop, and a shared Java-side library.
- Building Java in GitHub Actions, or keeping Java sources outside this repo.
- CheerpJ, WebAssembly or a TypeScript port taught in depth.
- Porting any real libGDX, JavaFX or Swing project end to end.
- Applets, JNLP, server-side Java, networking, multiplayer.
- Music, mouse or drag control, new haptic patterns, pins or credit rules for Dot Catcher.
- Any change to `GamePlayer`, other engines, agents or skills.
- Browser automated tests, saving progress, `localStorage`.

Each of those, if it lands, goes in its own spec.
