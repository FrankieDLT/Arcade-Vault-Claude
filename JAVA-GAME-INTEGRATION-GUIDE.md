# Java Game Integration Guide

A step-by-step manual for plugging a game written in **Java** into Arcade Vault, by compiling it to JavaScript with **TeaVM**. It is the companion of [`GAME-INTEGRATION-GUIDE.md`](GAME-INTEGRATION-GUIDE.md), which builds the same kind of game by hand in TypeScript. Read that guide first if you have never added a game to this platform: this one does not repeat the field tables of the registry, the catalog and the database, it points at them.

The guide is written for a developer who **knows Java** and does not know TeaVM, React, Next.js or Supabase. Every step ends with a "Try it" checkpoint. Every code block of the worked example is pasted from a file of this repository that was built and played: the HTML comment above a block names the file. The worked example is a real catalog game, **Dot Catcher** (`dot-catcher`), whose rules and drawing are Java.

---

## Table of contents

0. [Introduction and prerequisites](#0-introduction-and-prerequisites)
1. [The big picture](#1-the-big-picture)
2. [Choosing a route: TeaVM, CheerpJ or a TypeScript port](#2-choosing-a-route-teavm-cheerpj-or-a-typescript-port)
3. [Before you start: things to keep in mind](#3-before-you-start-things-to-keep-in-mind)
4. [Step 1: Project setup](#4-step-1-project-setup)
5. [Step 2: The Java engine](#5-step-2-the-java-engine)
6. [Step 3: The bridge (Java side)](#6-step-3-the-bridge-java-side)
7. [Step 4: The TypeScript side](#7-step-4-the-typescript-side)
8. [Steps 5 and 6: Registry, catalog, cover and database](#8-steps-5-and-6-registry-catalog-cover-and-database)
9. [Step 7: Polish](#9-step-7-polish)
10. [Adapting an existing Java game](#10-adapting-an-existing-java-game)
11. [Debugging](#11-debugging)
12. [Documentation, test checklist, common mistakes, file checklist](#12-documentation-test-checklist-common-mistakes-file-checklist)

---

## 0. Introduction and prerequisites

### What you will have at the end

A playable game whose rules, input, timing and drawing are Java, and that behaves exactly like any other Arcade Vault game:

- a card in the Library and a detail page;
- `/games/<your-id>/play` inside the CRT screen, with HUD, pause, end, game-over modal and play again;
- a leaderboard in Supabase, credits for play time, skins, sound effects and a touch pad on phones.

The player never sees Java. Nothing in the UI says the word, and `GamePlayer`, the registry, the catalog, the scores and the credits know nothing about it.

### Prerequisites

- **A JDK, version 17 or newer** (the project was built with 24). Only the JDK is required: **Maven is not**, because the Maven Wrapper is committed under `java/<id>/`. Check with `java -version`. `JAVA_HOME` does not have to be set: the build script asks the `java` on your `PATH` where it lives.
- **Node.js** and `npm install` already run in the repository root (the same as for the TypeScript guide).
- The `.env` file in the repository root, copied from `.env.example` (see the TypeScript guide, section 0).
- Access to the Supabase project, once, in [Steps 5 and 6](#8-steps-5-and-6-registry-catalog-cover-and-database).
- **Internet access on the first build**: Maven downloads TeaVM and its dependencies (about 30 s the first time, 3 to 5 s afterwards).

The versions this guide proves (and that the pom pins): **TeaVM 0.16.0**, Maven Wrapper 3.3.4 downloading Maven 3.9.16, JUnit 5.11.4, `maven.compiler.release` 17. TeaVM's own documentation shows 0.15.0 in some places and 0.16.0 in others: always trust the pom.

### The running example

**Dot Catcher**, id `dot-catcher`: slide a paddle left and right along the bottom of an 800x600 screen and catch falling dots. Each caught dot is worth 10 points, each missed dot costs one of three lives, every 10 catches the level goes up and the dots fall faster and appear more often. It is the same game that the TypeScript guide builds, with the same numbers, so you can compare both implementations line by line. Because it is now shipped in the catalog, **`dot-catcher` is taken**: if you follow the TypeScript guide, use another id (for example `dot-catcher-lab`).

It is a teaching example. When you build your own game, replace the id, the names, the rules and the drawing, and keep the structure.

---

## 1. The big picture

The site is a static export on GitHub Pages: no server, no JVM, no applets. A Java game has to reach the browser as JavaScript (or WebAssembly). TeaVM compiles Java **bytecode** to a single JavaScript file, at build time, on your machine. That file is committed, so CI needs no JDK.

```
lib/games.ts  (the GAMES list)
    |
    +--> Library card and /games/<id> detail page
    |
    +--> app/games/[id]/play/page.tsx
            |
            +--> components/game-player.tsx   (GamePlayer: HUD, pause, modal, scores, credits)
                    |
                    +--> getGameDefinition(id)  from components/game-registry.tsx
                    |
                    +--> mounts <DotCatcherCanvas />      (components/dot-catcher-canvas.tsx, ~25 lines)
                             |
                             +--> <JavaEngineCanvas />    (components/java-engine-canvas.tsx, shared)
                                      |
                                      +--> loadJavaEngine()   (lib/java-bridge/loader.ts, shared)
                                      |       loads public/game-assets/<id>/<id>.js once
                                      |       and reads window.ArcadeVaultJava[<id>]
                                      |
                                      +--> factory(canvas, callbacks, palette, options)
                                              |
                                              +--> DotCatcherEngine   (java/<id>/..., compiled)
```

The central idea: **the engine contract is the only thing that crosses the bridge.** `GamePlayer` talks to a Java engine exactly as it talks to a TypeScript engine: `start`, `pause`, `resume`, `end`, `destroy`, `setSkin`, callbacks only on change, `onGameOver` once.

### What is different from the TypeScript guide

| Topic                | TypeScript guide                          | This guide (Java)                                                                      |
| -------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------- |
| Engine location      | `lib/<id>/engine.ts`                      | `java/<id>/src/main/java/...`, compiled to `public/game-assets/<id>/<id>.js`           |
| `lib/<id>/`          | the engine                                | only TypeScript glue: canvas size, skin palettes, skin guard                           |
| Canvas wrapper       | ~100 lines of lifecycle code per game     | ~25 lines: it renders the shared `JavaEngineCanvas`                                    |
| Engine creation      | synchronous in an effect                  | asynchronous: the script has to load first (the shared component handles every race)  |
| Skins                | a string id the engine maps to colors     | a palette object (four CSS strings) that TypeScript owns and passes to Java            |
| Build                | none (Next compiles it)                   | `npm run build:java`, and the compiled `.js` is committed                              |
| Unit tests           | none (no test runner in the project)      | JUnit tests of the pure logic, run on the plain JVM with `mvnw test`                   |
| Class library        | all of TypeScript / the browser           | only the TeaVM subset of the Java class library, plus the browser through JSO          |

---

## 2. Choosing a route: TeaVM, CheerpJ or a TypeScript port

There are three honest ways to get a Java game into this site. This guide teaches the first one.

| Route                          | What ships                                   | Startup cost                          | Frame-time risk                                  | How much Java survives                                    | Licensing                                      |
| ------------------------------ | -------------------------------------------- | ------------------------------------- | ------------------------------------------------ | --------------------------------------------------------- | ---------------------------------------------- |
| **TeaVM** (taught here)        | one small `.js` file (Dot Catcher: 18 KB)    | negligible: a normal script           | low: output is plain JavaScript, measured below  | your source, minus the parts TeaVM's class library lacks  | Apache 2.0 (check the version you pin)         |
| **CheerpJ**                    | a JVM in the browser plus your unmodified jar | large runtime download, slow start   | higher: harder to hold to the frame-time rules   | all of it, including Swing in principle                   | verify the current terms before shipping       |
| **Manual port to TypeScript**  | your game rewritten as a TS engine           | none                                  | lowest                                           | none: it stops being a Java game                          | none, but you must own the rewrite             |

Questions to ask **before** choosing:

- Does the game use **Swing widgets** (`JButton`, `JFrame`, layouts) or the AWT event queue? TeaVM cannot compile them. Only the model and the painting can move.
- Does it use **real threads**, `synchronized` waits or an executor? The browser has one thread. Re-structure to a frame loop first.
- Does it read **files, sockets or `Preferences`**? None of that exists in the browser, and the platform forbids persistence anyway.
- Does it rely on **reflection** or serialization? TeaVM supports very little of it.
- Is there a **big third-party library** in the path? It has to be compilable by TeaVM too, so check it early.
- Is the game **already half written** in Java2D or libGDX? See [section 10](#10-adapting-an-existing-java-game).

If most answers are "no", TeaVM is the cheapest route. If the game is mostly Swing widgets, port it to TypeScript with the other guide. CheerpJ is an option when you cannot change the code at all and accept a heavy download; this guide does not teach it.

---

## 3. Before you start: things to keep in mind

Everything in the section "Before you start" of the TypeScript guide applies. These are the points that matter most, plus the ones that are specific to Java.

- **The game id is permanent.** It becomes the URL, the `games` primary key, the foreign key of every score, the folder `java/<id>/`, the file `public/game-assets/<id>/<id>.js` and the key `window.ArcadeVaultJava["<id>"]`.
- **The site is a static export.** No server code, no API routes. Everything runs in the browser.
- **Raw URLs go through `withBasePath()`** (`lib/base-path.ts`). On GitHub Pages the site lives under `/Arcade-Vault-Claude`. The script URL and every audio URL need it. A wrong URL works locally and gives a 404 in production.
- **Respect the performance rules of SPEC 12.** No `mix-blend-mode`, no animated `mask-image`, no full-screen animated layers over or behind the canvas.
- **Original art and names.** Never a trademark in the UI, and never copy the sprites, sounds or levels of a commercial game.
- **The origin tag follows who made the game**, not the language: `ai`, `human` or `assisted`.
- **All user-visible text is English**, and the UI never says "Java".
- **Nothing is stored in `localStorage`, cookies, files or `Preferences`.** Skin, mute, level and difficulty live in memory.
- **The compiled `.js` is part of the repository.** Whenever you change a `.java` file, run `npm run build:java` and commit the rebuilt file in the same change. A reviewer must be able to run the site without a JDK.
- **Bundle budget: 500 KB** for the compiled script. Dot Catcher is 18 KB. It loads only on the play page, and only once.

### The TeaVM class library subset

TeaVM does not compile against the full JDK. It ships its own class library (`teavm-classlib`), which covers `java.lang`, much of `java.util`, `java.io` streams over memory, `java.text` basics, `java.time` and a few more. These are **not available** (or not usable) in the browser:

- `java.awt.*`, `javax.swing.*`, `javax.sound.*`, `javafx.*`: no desktop UI, no sound API.
- `java.io.File`, `FileInputStream`, `FileWriter` and friends, `java.nio.file.*`: there is no file system.
- `java.net.Socket` and server sockets, `HttpURLConnection`: use the browser's `fetch` through JSO if you ever need a request (not in this platform).
- Real threads: `Thread`, `ExecutorService`, `Timer`, `Object.wait`, blocking `synchronized`. The browser is single threaded.
- Most of **reflection** and dynamic class loading.
- `String.format` and `long` arithmetic **work but are slow** in the JavaScript target (see the hot-path rule in section 5).

`java.util.Random`, `Math`, `ArrayList`, `HashMap`, `StringBuilder`, enums, interfaces, lambdas and generics all work. **Check every class you did not use in the example** against the TeaVM documentation before relying on it: an unsupported class is reported at build time (see [section 11](#11-debugging)).

---

## 4. Step 1: Project setup

### 4.1 Layout

```
java/dot-catcher/
  pom.xml
  mvnw, mvnw.cmd, .mvn/wrapper/maven-wrapper.properties   Maven Wrapper (committed)
  src/main/java/arcadevault/dotcatcher/
    Main.java              entry point: registers the factory on window.ArcadeVaultJava
    DotCatcherEngine.java  rules, loop, input, drawing: the engine contract
    Constants.java         sizes, speeds, points (static final only)
    GameMath.java          pure functions of the rules (testable on the JVM)
    Dot.java               a falling dot
    Gfx.java               the drawing interface the engine uses
    CanvasGfx.java         Gfx on a Canvas 2D context through JSO
    Browser.java           small JSO helpers (requestAnimationFrame, listeners)
    Bridge.java            the JSO types that cross to TypeScript
  src/test/java/arcadevault/dotcatcher/GameMathTest.java
public/game-assets/dot-catcher/dot-catcher.js              build output, committed
scripts/build-java.mjs                                       cross-platform build launcher
```

`Gfx.java`, `CanvasGfx.java`, `Browser.java` and `Bridge.java` are the **files to copy** into a new Java game. They are small and each game carries its own copy (a shared Java artifact would need publishing for a few dozen lines). Change only the palette and handle in `Bridge.java`.

### 4.2 The pom

<!-- file: java/dot-catcher/pom.xml -->
```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>

  <groupId>arcadevault</groupId>
  <artifactId>dot-catcher</artifactId>
  <version>1.0.0</version>
  <packaging>jar</packaging>

  <properties>
    <maven.compiler.release>17</maven.compiler.release>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    <project.build.outputTimestamp>2026-01-01T00:00:00Z</project.build.outputTimestamp>
    <teavm.version>0.16.0</teavm.version>
    <junit.version>5.11.4</junit.version>
  </properties>

  <dependencies>
    <dependency>
      <groupId>org.teavm</groupId>
      <artifactId>teavm-classlib</artifactId>
      <version>${teavm.version}</version>
      <scope>provided</scope>
    </dependency>
    <dependency>
      <groupId>org.teavm</groupId>
      <artifactId>teavm-jso</artifactId>
      <version>${teavm.version}</version>
      <scope>provided</scope>
    </dependency>
    <dependency>
      <groupId>org.teavm</groupId>
      <artifactId>teavm-jso-apis</artifactId>
      <version>${teavm.version}</version>
      <scope>provided</scope>
    </dependency>
    <dependency>
      <groupId>org.teavm</groupId>
      <artifactId>teavm-jso-impl</artifactId>
      <version>${teavm.version}</version>
      <scope>provided</scope>
    </dependency>
    <dependency>
      <groupId>org.junit.jupiter</groupId>
      <artifactId>junit-jupiter</artifactId>
      <version>${junit.version}</version>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-surefire-plugin</artifactId>
        <version>3.5.2</version>
      </plugin>
      <plugin>
        <groupId>org.teavm</groupId>
        <artifactId>teavm-maven-plugin</artifactId>
        <version>${teavm.version}</version>
        <executions>
          <execution>
            <id>compile-to-javascript</id>
            <phase>process-classes</phase>
            <goals>
              <goal>compile</goal>
            </goals>
            <configuration>
              <mainClass>arcadevault.dotcatcher.Main</mainClass>
              <targetType>JAVASCRIPT</targetType>
              <targetDirectory>${project.basedir}/../../public/game-assets/dot-catcher</targetDirectory>
              <targetFileName>dot-catcher.js</targetFileName>
              <minifying>true</minifying>
              <optimizationLevel>FULL</optimizationLevel>
              <sourceMapsGenerated>false</sourceMapsGenerated>
              <debugInformationGenerated>false</debugInformationGenerated>
              <sourceFilesCopied>false</sourceFilesCopied>
            </configuration>
          </execution>
        </executions>
      </plugin>
    </plugins>
  </build>
</project>
```

What matters here:

- Every TeaVM artifact is `provided`: they are compile-time tools, not runtime libraries.
- `process-classes` is the phase that runs TeaVM, so `mvnw package` produces the JavaScript, and `mvnw test` does not.
- `targetDirectory` points straight into `public/game-assets/dot-catcher/`: there is no copy step to forget.
- `minifying` on, `sourceMapsGenerated` and `debugInformationGenerated` off: the committed build is small and has no map. For debugging, flip those switches locally (see [section 11](#11-debugging)) and do not commit the result.
- `project.build.outputTimestamp` is fixed. The build proved **deterministic on one machine**: two consecutive builds gave byte-identical files. Another JDK vendor or version may still produce a different file, so rebuild before committing and do not be alarmed by a diff after a JDK change.
- **There is no generated HTML page and no `index.html`.** The platform loads the script itself.

### 4.3 The Maven Wrapper

If you do not have Maven installed, generate the wrapper once (this repository already has it for Dot Catcher; a new game copies the files of `java/dot-catcher/`: `mvnw`, `mvnw.cmd`, `.mvn/wrapper/maven-wrapper.properties`):

```
mvn org.apache.maven.plugins:maven-wrapper-plugin:3.3.4:wrapper -Dmaven=3.9.16 -Dtype=script
```

The `script` type needs no `maven-wrapper.jar` in the repository: the scripts download Maven on first use.

### 4.4 The build launcher and the npm script

`npm run build:java` has to work on Windows and on POSIX with one command. A tiny Node script handles the differences: it runs `mvnw.cmd` on Windows and `sh mvnw` elsewhere (so the executable bit does not matter), derives `JAVA_HOME` when it is missing, and passes extra arguments through.

<!-- file: scripts/build-java.mjs -->
```js
// Runs the Maven Wrapper of a Java game (default: dot-catcher) on Windows and POSIX.
// Usage: npm run build:java            -> package (compile to JavaScript)
//        npm run build:java -- test    -> run the JUnit tests only
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const game = process.env.JAVA_GAME || "dot-catcher";
const dir = path.join(root, "java", game);
const goals = process.argv.slice(2);
if (goals.length === 0) goals.push("package");
goals.unshift("-ntp"); // no transfer progress noise

const windows = process.platform === "win32";

// The Maven Wrapper needs JAVA_HOME. If it is not set, ask the `java` on the PATH where it lives.
const env = { ...process.env };
if (!env.JAVA_HOME) {
  const probe = spawnSync("java", ["-XshowSettings:properties", "-version"], {
    encoding: "utf8",
    shell: windows,
  });
  const match = /java.home = (.+)/.exec(
    (probe.stderr || "") + (probe.stdout || ""),
  );
  if (match) env.JAVA_HOME = match[1].trim();
}
const command = windows ? ".\\mvnw.cmd" : "sh";
const args = windows ? goals : ["mvnw", ...goals];

const result = spawnSync(command, args, {
  cwd: dir,
  stdio: "inherit",
  shell: windows,
  env,
});
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
```

`package.json` has the script `"build:java": "node scripts/build-java.mjs"`. Use it like this:

```
npm run build:java            # package: compile Java and write public/game-assets/dot-catcher/dot-catcher.js
npm run build:java -- test    # run the JUnit tests only
JAVA_GAME=my-game npm run build:java   # another game folder (POSIX; on Windows: set JAVA_GAME=my-game first)
```

### 4.5 Ignore rules

- `.gitignore`: `java/**/target/` (Maven's working folder). The compiled `.js` is **not** ignored.
- `.prettierignore` and ESLint `globalIgnores`: `public/game-assets/**/*.js`, so lint and format never touch the minified file.

### 4.6 The entry point, measured

TeaVM's `JAVASCRIPT` target produces a script wrapped in a small UMD function. In a browser without AMD or CommonJS, the last line assigns the compiled `main` to `self.main`, which is **`window.main`**. It does not start by itself. The shared loader (section 7) therefore does three things after the script's `load` event: calls `window.main([])`, deletes `window.main` (so a second Java game on the same page cannot collide with it), and reads `window.ArcadeVaultJava["<id>"]`, which your Java `main` registered while it ran.

### Try it

1. Run `npm run build:java`. The first run downloads Maven and TeaVM. It must end with `BUILD SUCCESS` and create `public/game-assets/dot-catcher/dot-catcher.js`.
2. Run it again: it finishes in a few seconds and `git status` stays clean (byte-identical output).
3. `npm run lint` and `npm run build` still pass.

If the first build fails with `PKIX path building failed ... unable to find valid certification path` on Windows (a corporate or antivirus TLS proxy), tell Maven to trust the Windows certificate store for that shell: `MAVEN_OPTS="-Djavax.net.ssl.trustStoreType=WINDOWS-ROOT -Djavax.net.ssl.trustStore=NUL"` (Git Bash) or `$env:MAVEN_OPTS = "..."` (PowerShell). Do not put it in a committed file: it breaks Linux and macOS.

---

## 5. Step 2: The Java engine

### 5.1 The contract in Java

The engine is the same object the TypeScript guide describes, written in Java:

```
new DotCatcherEngine(canvas, callbacks, palette)

start()      begin the run: emit initial values, attach listeners, draw, start the loop
pause()      freeze the run
resume()     continue after pause
end()        finish the run now (the END button)
destroy()    stop everything and release listeners (idempotent)
setSkin(p)   copy the new palette and redraw at once
setLevel(n)  optional: level select, keep score and lives
```

### 5.2 Rules every engine must follow (the ten rules, in Java)

1. **No framework, no static game state.** All game variables are instance fields. PLAY AGAIN creates a new engine.
2. **Callbacks fire only when a value changes.** Keep the last emitted values (`emittedScore`, `emittedLives`, `emittedLevel`) and compare before calling.
3. **`start()` emits the initial values** (score 0, lives 3, level 1).
4. **`onGameOver` fires exactly once** per run. After it, the loop stops and the listeners are removed.
5. **The score is clamped to 0..10,000,000.** The database rejects anything else.
6. **Draw the playfield only.** Score, lives, level, "PAUSED" and "GAME OVER" belong to the platform. That includes `drawString`: no text on the canvas.
7. **Keyboard input uses `KeyboardEvent.code`** (`ArrowLeft`, `KeyA`, `Space`), never the key or a `VK_` constant. `P` and `Escape` do nothing: pause is the platform's button.
8. **`preventDefault()` only for your game keys, and only while the game runs**, so arrows and space do not scroll the page.
9. **Clear held keys on `blur` and when the tab is hidden**, or a key can stay stuck.
10. **Engines never play sound and never vibrate.** They emit `onSound("catch")` and `onHaptic("death")`; the platform decides.

### 5.3 Rules that are specific to Java

1. **No mutable `static` fields in the engine.** The compiled module loads once per page, so a static field would leak the previous run into PLAY AGAIN. Only `static final` constants.
2. **Nothing blocks.** No `Thread`, `Timer`, `ExecutorService`, `Thread.sleep`, `Object.wait`. One `requestAnimationFrame` callback is the loop.
3. **Only the TeaVM class library.** No `java.awt`, `javax.swing`, `java.io.File`, reflection or sockets in the engine.
4. **Time comes from the `requestAnimationFrame` timestamp**, never from `System.currentTimeMillis()` or `System.nanoTime()`. Compute `dt` from it and cap it.
5. **Hot-path discipline.** No `long`, no `String.format` and no per-frame allocation inside `update` and `draw`. TeaVM emulates `long` in JavaScript and garbage hurts frame time. Dot Catcher keeps a preallocated pool of 64 `Dot` objects and compacts it in place instead of building a new list every frame.
6. **Keep functors in fields.** The `KeyHandler`, `FrameHandler` and visibility handlers are created once and stored, so `removeEventListener` receives the same function it was given.
7. **`destroy()` is idempotent**, and after it no callback fires and nothing draws.

### 5.4 The game loop (for beginners)

The browser calls your function through `requestAnimationFrame` about 60 times per second and passes a timestamp in milliseconds. You compute `dt` (seconds since the previous frame), **update** the world with it (`position += speed * dt`), **draw**, and ask for the next frame. Two protections: cap `dt` (`MAX_DT = 0.05`) so a background tab cannot teleport the world forward, and detect a fast dot **crossing** the paddle line between two frames instead of testing only its current position. On `pause()` the engine forgets the previous timestamp, so the first frame after `resume()` has `dt = 0`.

### 5.5 The code

**`Constants.java`**: only final values.

<!-- file: java/dot-catcher/src/main/java/arcadevault/dotcatcher/Constants.java -->
```java
package arcadevault.dotcatcher;

/** Sizes, speeds and points. Only static final values: the engine has no mutable static state. */
final class Constants {
    private Constants() {}

    // Logical canvas size. CSS scales the canvas to fit the screen.
    static final int W = 800;
    static final int H = 600;

    static final double PADDLE_W = 110;
    static final double PADDLE_H = 16;
    static final double PADDLE_Y = H - 40; // top edge of the paddle
    static final double PADDLE_SPEED = 520; // px per second

    static final double DOT_RADIUS = 12;
    static final int DOT_POINTS = 10;
    static final int START_LIVES = 3;
    static final int DOTS_PER_LEVEL = 10; // caught dots needed to reach the next level

    static final int MIN_LEVEL = 1;
    static final int MAX_LEVEL = 99; // registry levelSelect { min: 1, max: 99 }

    static final double MAX_DT = 0.05; // seconds. Longest time step the simulation accepts.
    static final double FIRST_SPAWN = 0.5; // seconds until the first dot of a run or after setLevel

    static final int MAX_SCORE = 10_000_000; // the database rejects anything above this
    static final int MAX_DOTS = 64; // size of the preallocated dot pool
}
```

**`GameMath.java`** and **`Dot.java`**: the pure rules and the reusable dot. `GameMath` has no browser types, which is what lets JUnit test it.

<!-- file: java/dot-catcher/src/main/java/arcadevault/dotcatcher/GameMath.java -->
```java
package arcadevault.dotcatcher;

/** Pure functions of the rules. No browser types, so JUnit can test them on a plain JVM. */
final class GameMath {
    private GameMath() {}

    static double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    /** Keeps a score inside 0..MAX_SCORE. */
    static int clampScore(int score) {
        return Math.max(0, Math.min(Constants.MAX_SCORE, score));
    }

    /** Keeps a level inside the range the level selector offers (1..99). */
    static int clampLevel(int level) {
        return Math.max(Constants.MIN_LEVEL, Math.min(Constants.MAX_LEVEL, level));
    }

    /** Level 1 at the start, +1 every DOTS_PER_LEVEL caught dots. */
    static int levelFor(int caught) {
        return 1 + caught / Constants.DOTS_PER_LEVEL;
    }

    /** Caught dots that put the player exactly at the start of a level. Inverse of levelFor. */
    static int caughtForLevel(int level) {
        return (clampLevel(level) - 1) * Constants.DOTS_PER_LEVEL;
    }

    /** Pixels per second. Starts slow, capped so the game stays playable. */
    static double fallSpeed(int level) {
        return Math.min(480, 160 + 30 * (level - 1));
    }

    /** Seconds between new dots. Shrinks with the level, never below 0.35 s. */
    static double spawnInterval(int level) {
        return Math.max(0.35, 1.1 - 0.07 * (level - 1));
    }
}
```

<!-- file: java/dot-catcher/src/main/java/arcadevault/dotcatcher/Dot.java -->
```java
package arcadevault.dotcatcher;

/** A falling dot. Instances are preallocated and reused, so the frame loop never allocates. */
final class Dot {
    double x;
    double y;
    double prevY; // position in the previous frame, used to detect crossing the paddle line
}
```

**`Gfx.java`** and **`CanvasGfx.java`**: everything the engine draws goes through `Gfx`. An existing Java2D game replaces its `Graphics2D` calls with these (see section 10). `CanvasGfx` is the only class that knows Canvas 2D.

<!-- file: java/dot-catcher/src/main/java/arcadevault/dotcatcher/Gfx.java -->
```java
package arcadevault.dotcatcher;

/**
 * The only drawing API the engine uses. An existing Java2D game swaps its Graphics2D calls for
 * these. Origin top-left, logical pixels, colors as CSS strings.
 */
interface Gfx {
    void setColor(String css);

    void fillRect(double x, double y, double w, double h);

    void fillCircle(double x, double y, double r);
}
```

<!-- file: java/dot-catcher/src/main/java/arcadevault/dotcatcher/CanvasGfx.java -->
```java
package arcadevault.dotcatcher;

import org.teavm.jso.canvas.CanvasRenderingContext2D;
import org.teavm.jso.dom.html.HTMLCanvasElement;

/** Gfx on a Canvas 2D context, through TeaVM JSO. Copy this file as it is into a new Java game. */
final class CanvasGfx implements Gfx {
    private final CanvasRenderingContext2D ctx;

    CanvasGfx(HTMLCanvasElement canvas) {
        CanvasRenderingContext2D context = (CanvasRenderingContext2D) canvas.getContext("2d");
        if (context == null) {
            throw new IllegalStateException("2D canvas context is not available");
        }
        this.ctx = context;
    }

    @Override
    public void setColor(String css) {
        ctx.setFillStyle(css);
    }

    @Override
    public void fillRect(double x, double y, double w, double h) {
        ctx.fillRect(x, y, w, h);
    }

    @Override
    public void fillCircle(double x, double y, double r) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
}
```

**`DotCatcherEngine.java`**: the engine. Read the comments: they say why.

<!-- file: java/dot-catcher/src/main/java/arcadevault/dotcatcher/DotCatcherEngine.java -->
```java
package arcadevault.dotcatcher;

import static arcadevault.dotcatcher.Constants.DOT_POINTS;
import static arcadevault.dotcatcher.Constants.DOT_RADIUS;
import static arcadevault.dotcatcher.Constants.FIRST_SPAWN;
import static arcadevault.dotcatcher.Constants.H;
import static arcadevault.dotcatcher.Constants.MAX_DOTS;
import static arcadevault.dotcatcher.Constants.MAX_DT;
import static arcadevault.dotcatcher.Constants.PADDLE_H;
import static arcadevault.dotcatcher.Constants.PADDLE_SPEED;
import static arcadevault.dotcatcher.Constants.PADDLE_W;
import static arcadevault.dotcatcher.Constants.PADDLE_Y;
import static arcadevault.dotcatcher.Constants.START_LIVES;
import static arcadevault.dotcatcher.Constants.W;

import arcadevault.dotcatcher.Bridge.EngineHandle;
import arcadevault.dotcatcher.Bridge.JsCallbacks;
import arcadevault.dotcatcher.Bridge.JsPalette;
import org.teavm.jso.JSExport;
import org.teavm.jso.dom.events.KeyboardEvent;
import org.teavm.jso.dom.html.HTMLCanvasElement;

/**
 * Dot Catcher: slide the paddle, catch the falling dots. Rules, input, timing and drawing are
 * Java. The platform only sees the engine contract (start, pause, resume, end, destroy, setSkin,
 * setLevel) and the callbacks.
 */
public final class DotCatcherEngine implements EngineHandle {
    private final Gfx gfx;
    private final JsCallbacks callbacks;

    // Palette: four CSS strings copied from the JavaScript object. Java never stores a skin id.
    private String background;
    private String floor;
    private String paddleColor;
    private String dotColor;

    // Lifecycle flags. Every public method checks them first.
    private boolean started = false;
    private boolean paused = false;
    private boolean finished = false; // onGameOver already fired for this run
    private boolean destroyed = false;
    private boolean listening = false;
    private int frameId = -1;
    private boolean hasLastTime = false;
    private double lastTime = 0;

    // Game state. It lives on the instance, never in static fields.
    private double paddleX = W / 2.0; // center of the paddle
    private final Dot[] dots = new Dot[MAX_DOTS]; // preallocated pool: no allocation per frame
    private int dotCount = 0;
    private int score = 0;
    private int lives = START_LIVES;
    private int caught = 0;
    private double spawnTimer = FIRST_SPAWN; // seconds until the next dot

    // Keys currently down (by KeyboardEvent.code).
    private boolean heldLeft = false;
    private boolean heldRight = false;
    private boolean heldA = false;
    private boolean heldD = false;

    // Last values sent to the callbacks, so they only fire on change.
    private int emittedScore = -1;
    private int emittedLives = -1;
    private int emittedLevel = -1;

    // Functors live in fields: the same JavaScript function is added and removed as a listener.
    private final Browser.FrameHandler frameHandler = this::onFrame;
    private final Browser.KeyHandler keyDownHandler = this::onKeyDown;
    private final Browser.KeyHandler keyUpHandler = this::onKeyUp;
    private final Browser.PlainHandler clearInputHandler = this::clearInput;
    private final Browser.PlainHandler visibilityHandler = this::onVisibility;

    DotCatcherEngine(HTMLCanvasElement canvas, JsCallbacks callbacks, JsPalette palette) {
        this.gfx = new CanvasGfx(canvas);
        this.callbacks = callbacks;
        for (int i = 0; i < MAX_DOTS; i++) {
            dots[i] = new Dot();
        }
        copyPalette(palette);
    }

    // ── Public API (called from TypeScript) ──────────────────────────────────────

    @Override
    @JSExport
    public void setSkin(JsPalette palette) {
        copyPalette(palette);
        if (destroyed) return;
        draw(); // redraw at once, also while paused or after game over
    }

    @Override
    @JSExport
    public void start() {
        if (started || destroyed) return;
        started = true;
        emitChanges(); // the HUD shows 0 / 3 / 1 right away
        attachListeners();
        draw();
        schedule();
    }

    @Override
    @JSExport
    public void pause() {
        if (!started || paused || finished || destroyed) return;
        paused = true;
        cancelFrame();
        clearInput();
        hasLastTime = false;
    }

    @Override
    @JSExport
    public void resume() {
        if (!started || !paused || finished || destroyed) return;
        paused = false;
        hasLastTime = false; // the first frame after resume has dt = 0: no time jump
        schedule();
    }

    @Override
    @JSExport
    public void end() {
        if (!started || finished || destroyed) return;
        finishRun();
    }

    /** Idempotent: after it, no callback fires and nothing draws. */
    @Override
    @JSExport
    public void destroy() {
        destroyed = true;
        cancelFrame();
        detachListeners();
        clearInput();
    }

    /**
     * Level select: jump to a level, keep score and lives, drop the falling dots and restart the
     * spawn timer. Works while paused (the HUD and the canvas follow at once), not after game over.
     */
    @Override
    @JSExport
    public void setLevel(int level) {
        if (!started || finished || destroyed) return;
        caught = GameMath.caughtForLevel(level);
        dotCount = 0;
        spawnTimer = FIRST_SPAWN;
        emitChanges();
        draw();
    }

    // ── Loop ─────────────────────────────────────────────────────────────────────

    private void schedule() {
        cancelFrame();
        frameId = Browser.requestFrame(frameHandler);
    }

    private void cancelFrame() {
        if (frameId != -1) {
            Browser.cancelFrame(frameId);
            frameId = -1;
        }
    }

    private void onFrame(double timestamp) {
        frameId = -1;
        if (!started || paused || finished || destroyed) return;
        double dt = hasLastTime ? Math.min((timestamp - lastTime) / 1000.0, MAX_DT) : 0;
        hasLastTime = true;
        lastTime = timestamp;
        update(dt);
        emitChanges();
        if (finished) return; // finishRun already drew the last frame
        draw();
        schedule();
    }

    private void update(double dt) {
        // 1. Move the paddle from the held keys.
        int dir = (heldRight || heldD ? 1 : 0) - (heldLeft || heldA ? 1 : 0);
        paddleX = GameMath.clamp(paddleX + dir * PADDLE_SPEED * dt, PADDLE_W / 2, W - PADDLE_W / 2);

        // 2. Spawn dots.
        int level = GameMath.levelFor(caught);
        spawnTimer -= dt;
        if (spawnTimer <= 0) {
            if (dotCount < MAX_DOTS) {
                Dot dot = dots[dotCount++];
                dot.x = DOT_RADIUS + Math.random() * (W - 2 * DOT_RADIUS);
                dot.y = -DOT_RADIUS;
                dot.prevY = -DOT_RADIUS;
            }
            spawnTimer = GameMath.spawnInterval(level);
        }

        // 3. Move the dots, remembering where each one was.
        double speed = GameMath.fallSpeed(level);
        for (int i = 0; i < dotCount; i++) {
            Dot dot = dots[i];
            dot.prevY = dot.y;
            dot.y += speed * dt;
        }

        // 4. Resolve catches and misses. Dots that stay in play are compacted to the front.
        int kept = 0;
        for (int i = 0; i < dotCount; i++) {
            Dot dot = dots[i];
            // "Crossed": the dot's bottom was above the paddle line and is now at or below it.
            boolean crossed = dot.prevY + DOT_RADIUS <= PADDLE_Y && dot.y + DOT_RADIUS >= PADDLE_Y;
            boolean aligned = Math.abs(dot.x - paddleX) <= PADDLE_W / 2 + DOT_RADIUS;
            if (crossed && aligned) {
                score = GameMath.clampScore(score + DOT_POINTS);
                caught++;
                callbacks.onSound("catch");
                continue;
            }
            if (dot.y - DOT_RADIUS > H) {
                lives--;
                callbacks.onSound("miss");
                callbacks.onHaptic("death");
                if (lives <= 0) {
                    dotCount = 0;
                    finishRun();
                    return;
                }
                continue;
            }
            dots[i] = dots[kept];
            dots[kept] = dot;
            kept++;
        }
        dotCount = kept;
    }

    /** Stops the engine for good (until destroy) and reports the final score once. */
    private void finishRun() {
        if (finished) return;
        finished = true;
        cancelFrame();
        detachListeners();
        clearInput();
        emitChanges();
        draw();
        callbacks.onSound("gameover");
        callbacks.onGameOver(GameMath.clampScore(score));
    }

    /** Sends a value to the platform only when it differs from the last one sent. */
    private void emitChanges() {
        int shownScore = GameMath.clampScore(score);
        int shownLives = Math.max(0, lives);
        int shownLevel = GameMath.levelFor(caught);
        if (emittedScore != shownScore) {
            emittedScore = shownScore;
            callbacks.onScore(shownScore);
        }
        if (emittedLives != shownLives) {
            emittedLives = shownLives;
            callbacks.onLives(shownLives);
        }
        if (emittedLevel != shownLevel) {
            emittedLevel = shownLevel;
            callbacks.onLevel(shownLevel);
        }
    }

    // ── Input ────────────────────────────────────────────────────────────────────

    private void attachListeners() {
        if (listening) return;
        listening = true;
        Browser.addKeyListener("keydown", keyDownHandler);
        Browser.addKeyListener("keyup", keyUpHandler);
        Browser.addWindowListener("blur", clearInputHandler);
        Browser.addDocumentListener("visibilitychange", visibilityHandler);
    }

    private void detachListeners() {
        if (!listening) return;
        listening = false;
        Browser.removeKeyListener("keydown", keyDownHandler);
        Browser.removeKeyListener("keyup", keyUpHandler);
        Browser.removeWindowListener("blur", clearInputHandler);
        Browser.removeDocumentListener("visibilitychange", visibilityHandler);
    }

    private void onKeyDown(KeyboardEvent e) {
        if (paused || finished || !started || destroyed) return;
        String code = e.getCode();
        if (code == null) return;
        // Only the game keys are handled, and only they get preventDefault (no page scroll).
        switch (code) {
            case "ArrowLeft":
                heldLeft = true;
                break;
            case "ArrowRight":
                heldRight = true;
                break;
            case "KeyA":
                heldA = true;
                break;
            case "KeyD":
                heldD = true;
                break;
            default:
                return;
        }
        e.preventDefault();
    }

    private void onKeyUp(KeyboardEvent e) {
        String code = e.getCode();
        if (code == null) return;
        switch (code) {
            case "ArrowLeft":
                heldLeft = false;
                break;
            case "ArrowRight":
                heldRight = false;
                break;
            case "KeyA":
                heldA = false;
                break;
            case "KeyD":
                heldD = false;
                break;
            default:
                break;
        }
    }

    private void clearInput() {
        heldLeft = false;
        heldRight = false;
        heldA = false;
        heldD = false;
    }

    private void onVisibility() {
        if (Browser.isDocumentHidden()) clearInput();
    }

    // ── Drawing ──────────────────────────────────────────────────────────────────

    private void copyPalette(JsPalette palette) {
        background = palette.getBackground();
        floor = palette.getFloor();
        paddleColor = palette.getPaddle();
        dotColor = palette.getDot();
    }

    private void draw() {
        gfx.setColor(background);
        gfx.fillRect(0, 0, W, H);

        gfx.setColor(floor);
        gfx.fillRect(0, PADDLE_Y + PADDLE_H + 8, W, 4);

        gfx.setColor(paddleColor);
        gfx.fillRect(paddleX - PADDLE_W / 2, PADDLE_Y, PADDLE_W, PADDLE_H);

        gfx.setColor(dotColor);
        for (int i = 0; i < dotCount; i++) {
            gfx.fillCircle(dots[i].x, dots[i].y, DOT_RADIUS);
        }
    }
}
```

Three things worth noticing:

- `setLevel(int)` is the **level select**: it sets the caught count to `(level - 1) * 10`, clears the falling dots, restarts the spawn timer at 0.5 s, keeps score and lives, and emits the new level at once, also while paused, so the HUD and the redraw follow. It does nothing before `start()` or after game over.
- The `@JSExport` annotations on the public methods are what make them callable from JavaScript (section 6).
- `update` ends the run from inside the loop through `finishRun()`, which draws the last frame, emits the final values and fires `onSound("gameover")` and `onGameOver` once.

### 5.6 The unit tests

Pure logic can be tested without a browser. This is the one place a Java game beats the TypeScript one: the project has no test runner for TypeScript, and here `mvnw test` runs in a second on the plain JVM.

<!-- file: java/dot-catcher/src/test/java/arcadevault/dotcatcher/GameMathTest.java -->
```java
package arcadevault.dotcatcher;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class GameMathTest {
    @Test
    void clampScoreKeepsValuesInRange() {
        assertEquals(0, GameMath.clampScore(-5));
        assertEquals(0, GameMath.clampScore(0));
        assertEquals(120, GameMath.clampScore(120));
        assertEquals(10_000_000, GameMath.clampScore(10_000_000));
        assertEquals(10_000_000, GameMath.clampScore(10_000_010));
        assertEquals(10_000_000, GameMath.clampScore(Integer.MAX_VALUE));
    }

    @Test
    void clampKeepsValuesInRange() {
        assertEquals(1.0, GameMath.clamp(0.5, 1.0, 2.0), 0.0);
        assertEquals(1.5, GameMath.clamp(1.5, 1.0, 2.0), 0.0);
        assertEquals(2.0, GameMath.clamp(9.0, 1.0, 2.0), 0.0);
    }

    @Test
    void clampLevelKeepsOneToNinetyNine() {
        assertEquals(1, GameMath.clampLevel(-3));
        assertEquals(1, GameMath.clampLevel(0));
        assertEquals(1, GameMath.clampLevel(1));
        assertEquals(50, GameMath.clampLevel(50));
        assertEquals(99, GameMath.clampLevel(99));
        assertEquals(99, GameMath.clampLevel(100));
    }

    @Test
    void levelChangesAtTheTenthCatch() {
        assertEquals(1, GameMath.levelFor(0));
        assertEquals(1, GameMath.levelFor(9));
        assertEquals(2, GameMath.levelFor(10));
        assertEquals(2, GameMath.levelFor(19));
        assertEquals(3, GameMath.levelFor(20));
    }

    @Test
    void caughtForLevelIsTheInverseOfLevelFor() {
        for (int level = 1; level <= 99; level++) {
            assertEquals(level, GameMath.levelFor(GameMath.caughtForLevel(level)));
        }
        assertEquals(0, GameMath.caughtForLevel(1));
        assertEquals(10, GameMath.caughtForLevel(2));
        assertEquals(980, GameMath.caughtForLevel(99));
        // Out of range requests are clamped first.
        assertEquals(0, GameMath.caughtForLevel(-4));
        assertEquals(980, GameMath.caughtForLevel(500));
    }

    @Test
    void fallSpeedGrowsAndIsCapped() {
        assertEquals(160.0, GameMath.fallSpeed(1), 1e-9);
        assertEquals(190.0, GameMath.fallSpeed(2), 1e-9);
        assertEquals(460.0, GameMath.fallSpeed(11), 1e-9);
        assertEquals(480.0, GameMath.fallSpeed(12), 1e-9);
        assertEquals(480.0, GameMath.fallSpeed(99), 1e-9);
    }

    @Test
    void spawnIntervalShrinksAndIsCapped() {
        assertEquals(1.1, GameMath.spawnInterval(1), 1e-9);
        assertEquals(1.03, GameMath.spawnInterval(2), 1e-9);
        assertEquals(0.4, GameMath.spawnInterval(11), 1e-9);
        assertEquals(0.35, GameMath.spawnInterval(12), 1e-9);
        assertEquals(0.35, GameMath.spawnInterval(99), 1e-9);
    }
}
```

### Try it

1. `npm run build:java -- test` must report `Tests run: 7, Failures: 0`.
2. `npm run build:java` must end with `BUILD SUCCESS` and **no TeaVM warning or error** about unsupported classes. (Nothing shows on screen yet: the TypeScript side does not exist.)

---

## 6. Step 3: The bridge (Java side)

### 6.1 JSO overlay types

TeaVM's **JSO** (JavaScript Objects) lets Java call JavaScript. You declare a Java interface that extends `JSObject`, and calls on it become property accesses and method calls on the real JavaScript object, with no wrapper code. `Bridge.java` holds every type that crosses to TypeScript:

<!-- file: java/dot-catcher/src/main/java/arcadevault/dotcatcher/Bridge.java -->
```java
package arcadevault.dotcatcher;

import org.teavm.jso.JSFunctor;
import org.teavm.jso.JSObject;
import org.teavm.jso.JSProperty;
import org.teavm.jso.dom.html.HTMLCanvasElement;

/**
 * The types that cross between Java and the TypeScript bridge (lib/java-bridge/types.ts).
 * Copy this file into a new Java game and change the palette and the handle to match.
 */
public final class Bridge {
    private Bridge() {}

    /** The eight platform callbacks. TypeScript always provides all of them (no-ops when unused). */
    public interface JsCallbacks extends JSObject {
        void onScore(int score);

        void onLives(int lives);

        void onLevel(int level);

        void onLines(int lines);

        void onGameOver(int finalScore);

        void onSound(String name);

        void onHaptic(String name);

        void onMusic(String track);
    }

    /** Four CSS colors owned by TypeScript (SKINS in lib/dot-catcher/constants.ts). */
    public interface JsPalette extends JSObject {
        @JSProperty
        String getBackground();

        @JSProperty
        String getFloor();

        @JSProperty
        String getPaddle();

        @JSProperty
        String getDot();
    }

    /** Read once at creation. A key the platform did not provide is not set (null in Java). */
    public interface JsOptions extends JSObject {
        @JSProperty
        String getMode();

        @JSProperty
        String getDifficulty();
    }

    /**
     * What the platform calls. A feature is opted in by declaring its method: Dot Catcher
     * declares setLevel and has no setDifficulty, so the bridge never calls it.
     */
    public interface EngineHandle extends JSObject {
        void start();

        void pause();

        void resume();

        void end();

        void destroy();

        void setSkin(JsPalette palette);

        void setLevel(int level);
    }

    /** What TypeScript calls to create an engine. Registered on window.ArcadeVaultJava[id]. */
    @JSFunctor
    public interface EngineFactory extends JSObject {
        EngineHandle create(
                HTMLCanvasElement canvas, JsCallbacks callbacks, JsPalette palette, JsOptions options);
    }
}
```

- `JsCallbacks`: the eight platform callbacks. TypeScript always provides all of them (no-ops when the platform has none), so Java never null-checks.
- `JsPalette`: four CSS strings. **TypeScript owns the skins.** Java never stores a skin id: it copies the four strings, so adding a skin never needs a Java rebuild. If your game needs a different skin shape, change this interface and the TypeScript type parameter together.
- `JsOptions`: `mode` and `difficulty`, read once at creation. Dot Catcher declares the type but reads neither.
- `EngineHandle`: what the platform calls. **A feature is opted in by declaring its method.** Dot Catcher declares `setLevel` and has no `setDifficulty`; a method the handle does not declare is absent on the JavaScript object and the bridge calls it with `?.`.
- `EngineFactory`: a `@JSFunctor`. A functor is a one-method interface that TeaVM turns into a real JavaScript **function**. The factory is registered on `window.ArcadeVaultJava`.

### 6.2 Exporting a Java object: `@JSExport`

`DotCatcherEngine implements EngineHandle`, and its public methods carry `@JSExport`. That makes the Java instance a JavaScript object whose methods TypeScript can call (`handle.start()`, `handle.setSkin(palette)`). Methods without the annotation are not visible from JavaScript.

### 6.3 Registration

<!-- file: java/dot-catcher/src/main/java/arcadevault/dotcatcher/Main.java -->
```java
package arcadevault.dotcatcher;

import org.teavm.jso.JSBody;

/** Entry point. The TypeScript loader runs it once, right after the script loads. */
public final class Main {
    private Main() {}

    public static void main(String[] args) {
        Bridge.EngineFactory factory =
                (canvas, callbacks, palette, options) -> new DotCatcherEngine(canvas, callbacks, palette);
        register("dot-catcher", factory);
    }

    @JSBody(
            params = {"id", "factory"},
            script = "var games = window.ArcadeVaultJava || (window.ArcadeVaultJava = {}); games[id] = factory;")
    private static native void register(String id, Bridge.EngineFactory factory);
}
```

`Main.main` runs once, when the loader calls `window.main([])`. It only registers a factory under the game id. The factory creates one engine per call, so PLAY AGAIN gets a new engine and the old one is destroyed.

### 6.4 Browser helpers, and the functor trap

<!-- file: java/dot-catcher/src/main/java/arcadevault/dotcatcher/Browser.java -->
```java
package arcadevault.dotcatcher;

import org.teavm.jso.JSBody;
import org.teavm.jso.JSFunctor;
import org.teavm.jso.JSObject;
import org.teavm.jso.dom.events.KeyboardEvent;

/** Small JSO helpers for the browser APIs the engine needs. Copy this file into a new Java game. */
final class Browser {
    private Browser() {}

    /** A JavaScript function that receives the requestAnimationFrame timestamp (milliseconds). */
    @JSFunctor
    interface FrameHandler extends JSObject {
        void frame(double timestamp);
    }

    /** A JavaScript function that receives a keyboard event. */
    @JSFunctor
    interface KeyHandler extends JSObject {
        void key(KeyboardEvent event);
    }

    /** A JavaScript function that ignores its argument (blur, visibilitychange). */
    @JSFunctor
    interface PlainHandler extends JSObject {
        void run();
    }

    @JSBody(params = {"handler"}, script = "return window.requestAnimationFrame(handler);")
    static native int requestFrame(FrameHandler handler);

    @JSBody(params = {"id"}, script = "window.cancelAnimationFrame(id);")
    static native void cancelFrame(int id);

    // The handler parameters are typed with the functor interfaces on purpose: that is what makes
    // TeaVM turn the Java lambda into a real JavaScript function at the call.
    @JSBody(params = {"type", "handler"}, script = "window.addEventListener(type, handler);")
    static native void addKeyListener(String type, KeyHandler handler);

    @JSBody(params = {"type", "handler"}, script = "window.removeEventListener(type, handler);")
    static native void removeKeyListener(String type, KeyHandler handler);

    @JSBody(params = {"type", "handler"}, script = "window.addEventListener(type, handler);")
    static native void addWindowListener(String type, PlainHandler handler);

    @JSBody(params = {"type", "handler"}, script = "window.removeEventListener(type, handler);")
    static native void removeWindowListener(String type, PlainHandler handler);

    @JSBody(params = {"type", "handler"}, script = "document.addEventListener(type, handler);")
    static native void addDocumentListener(String type, PlainHandler handler);

    @JSBody(params = {"type", "handler"}, script = "document.removeEventListener(type, handler);")
    static native void removeDocumentListener(String type, PlainHandler handler);

    @JSBody(script = "return document.hidden === true;")
    static native boolean isDocumentHidden();
}
```

**Read the comment above the listener helpers carefully: it is the most expensive mistake in this guide.** A Java lambda becomes a JavaScript function only where TeaVM sees the **functor type** at the call: a `@JSBody` parameter typed `KeyHandler` converts it. A parameter typed `JSObject` does **not**: the Java object reaches `addEventListener` as an opaque object, the browser accepts it silently and never calls it. The symptom is a game that draws and runs but ignores the keyboard, with no error anywhere. That is why the helpers have one overload per functor type.

Keep each functor in a **field**, created once (`private final Browser.KeyHandler keyDownHandler = this::onKeyDown;`). The same JavaScript function is then passed to `addEventListener` and to `removeEventListener`. This was verified: after game over or `destroy()`, a key press is no longer handled and `preventDefault` is not called.

### Try it

`npm run build:java` still ends with `BUILD SUCCESS`. The Java side is complete: the next step adds the TypeScript that loads it.

---

## 7. Step 4: The TypeScript side

Three shared files make Java games cheap: the contract types, the loader and a generic canvas component. They know nothing about Dot Catcher (no file under `lib/java-bridge/` or `components/java-engine-canvas.tsx` contains the text `dot-catcher`). A new Java game writes a thin wrapper, a palette table and a CSS rule.

### 7.1 The contract types

<!-- file: lib/java-bridge/types.ts -->
```ts
// The contract between a Java engine (compiled to JavaScript with TeaVM) and the platform.
// Reusable: it knows nothing about any one game. P is the palette type a game passes to Java.

/** The eight platform callbacks. JavaEngineCanvas always passes all of them (no-ops when unused). */
export interface JavaCallbacks {
  onScore(score: number): void;
  onLives(lives: number): void;
  onLevel(level: number): void;
  onLines(lines: number): void;
  onGameOver(finalScore: number): void;
  onSound(name: string): void;
  onHaptic(name: string): void;
  /** Java sends any string; the bridge narrows it to "stage" | "boss" for the platform. */
  onMusic(track: string): void;
}

/** What the platform calls. A feature is opted in by declaring its method in Java. */
export interface JavaEngineHandle<P> {
  start(): void;
  pause(): void;
  resume(): void;
  end(): void;
  destroy(): void;
  setSkin(palette: P): void;
  // Optional: present only if the game's Java handle declares them.
  /** levelSelect: jump to a level, keep score and lives. */
  setLevel?(level: number): void;
  /** difficultySelect: a different difficulty restarts the match. */
  setDifficulty?(id: string): void;
}

/** Read once at creation. Always an object, with only the keys the platform provided. */
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
    /** Java games register their factory here, under their game id. */
    ArcadeVaultJava?: Record<string, JavaEngineFactory<unknown>>;
  }
}
```

`P` is the palette type the game passes to Java. Dot Catcher uses `SkinColors`; a game with a different skin shape (for example a scene id) uses its own type, and the bridge does not change.

### 7.2 The loader

<!-- file: lib/java-bridge/loader.ts -->
```ts
import type { JavaEngineFactory } from "./types";

// TeaVM's JavaScript target defines a global `main` (the Java entry point). The loader calls it
// once after the script loads and removes it, so two Java games never collide on that name.
type TeaVmWindow = Window & { main?: (args: string[]) => void };

const loaded = new Map<string, Promise<JavaEngineFactory<unknown>>>();
// Scripts run one after another, so a game's `main` is always started and removed before the
// next game's script can replace it.
let queue: Promise<unknown> = Promise.resolve();

function runScript(
  gameId: string,
  src: string,
): Promise<JavaEngineFactory<unknown>> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.javaGame = gameId;
    script.onload = () => {
      const w = window as TeaVmWindow;
      try {
        w.main?.([]);
      } catch (error) {
        script.remove();
        reject(error);
        return;
      } finally {
        delete w.main;
      }
      const factory = window.ArcadeVaultJava?.[gameId];
      if (!factory) {
        script.remove();
        reject(new Error(`Java game "${gameId}" did not register a factory`));
        return;
      }
      resolve(factory);
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(`Could not load ${src}`));
    };
    document.head.appendChild(script);
  });
}

/**
 * Loads a compiled Java game once per page and returns its engine factory.
 * `src` must already go through withBasePath(). A failed load is not cached, so a later
 * mount can retry.
 */
export function loadJavaEngine<P>(
  gameId: string,
  src: string,
): Promise<JavaEngineFactory<P>> {
  const cached = loaded.get(gameId);
  if (cached) return cached as Promise<JavaEngineFactory<P>>;
  const promise = queue
    .catch(() => undefined)
    .then(() => {
      const ready = window.ArcadeVaultJava?.[gameId];
      return ready ?? runScript(gameId, src);
    });
  queue = promise;
  loaded.set(gameId, promise);
  promise.catch(() => {
    if (loaded.get(gameId) === promise) loaded.delete(gameId);
  });
  return promise as Promise<JavaEngineFactory<P>>;
}
```

- One `<script>` per game id and page; the promise is cached.
- Loads are **queued**, so a game's `main` is always called and removed before the next game's script can replace it.
- A failed load is **evicted from the cache**, so a later mount can retry (leave the page, restore the network, open it again).
- `src` is built by the caller with `withBasePath()`.

### 7.3 `JavaEngineCanvas`

<!-- file: components/java-engine-canvas.tsx -->
```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { loadJavaEngine } from "@/lib/java-bridge/loader";
import type {
  JavaCallbacks,
  JavaEngineHandle,
  JavaEngineOptions,
} from "@/lib/java-bridge/types";

export interface JavaEngineCanvasProps<P> {
  /** Key of window.ArcadeVaultJava, the same id the Java Main registers. */
  gameId: string;
  /** URL of the compiled script, already passed through withBasePath(). */
  src: string;
  width: number;
  height: number;
  /** Per-game canvas class (absolute fill, touch-action: none). */
  className: string;
  ariaLabel: string;
  /** Passed to Java at creation and again on every change (skin). */
  palette: P;
  paused: boolean;
  /** Increment to end the run immediately (0 = not requested). */
  endSignal: number;
  onScore: (score: number) => void;
  onGameOver: (finalScore: number) => void;
  onLives?: (lives: number) => void;
  onLevel?: (level: number) => void;
  onLines?: (lines: number) => void;
  onSound?: (name: string) => void;
  onHaptic?: (name: string) => void;
  onMusic?: (track: "stage" | "boss") => void;
  /** A change of `id` calls handle.setLevel(level), if the Java handle declares it. */
  levelRequest?: { level: number; id: number };
  /** Read once, at creation, in the options object. */
  mode?: string;
  /** At creation in the options object, then handle.setDifficulty on change. */
  difficulty?: string;
}

/**
 * Generic canvas wrapper for any Java engine compiled with TeaVM. It owns the lifecycle the
 * TypeScript wrappers own (engine created once, destroyed on cleanup, latest callbacks) plus
 * what async loading adds: unmount before the script loads, the latest props applied right
 * after creation, and a load-error message.
 */
export function JavaEngineCanvas<P>(props: JavaEngineCanvasProps<P>) {
  const { gameId, src, width, height, className, ariaLabel } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<JavaEngineHandle<P> | null>(null);
  const [failed, setFailed] = useState(false);

  // Latest props, read by the creation effect (it runs once) and by the callbacks.
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });
  const appliedLevelId = useRef(0);
  const sentDifficulty = useRef<string | undefined>(undefined);

  // Create, start and destroy the engine. Strict Mode runs this twice in dev (mount, cleanup,
  // mount): `cancelled` stops the first run from creating an engine after its cleanup.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let handle: JavaEngineHandle<P> | null = null;

    const callbacks: JavaCallbacks = {
      onScore: (v) => latest.current.onScore(v),
      onLives: (v) => latest.current.onLives?.(v),
      onLevel: (v) => latest.current.onLevel?.(v),
      onLines: (v) => latest.current.onLines?.(v),
      onGameOver: (v) => latest.current.onGameOver(v),
      onSound: (n) => latest.current.onSound?.(n),
      onHaptic: (n) => latest.current.onHaptic?.(n),
      onMusic: (t) => latest.current.onMusic?.(t === "boss" ? "boss" : "stage"),
    };

    loadJavaEngine<P>(gameId, src)
      .then((factory) => {
        if (cancelled) return;
        const now = latest.current;
        const options: JavaEngineOptions = {};
        if (now.mode !== undefined) options.mode = now.mode;
        if (now.difficulty !== undefined) options.difficulty = now.difficulty;
        sentDifficulty.current = now.difficulty;
        handle = factory(canvas, callbacks, now.palette, options);
        handleRef.current = handle;
        handle.start();
        if (now.paused) handle.pause(); // pause pressed while the script was loading
        if (now.levelRequest) {
          appliedLevelId.current = now.levelRequest.id;
          handle.setLevel?.(now.levelRequest.level);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error(`Java game "${gameId}" failed to start`, error);
        setFailed(true);
      });

    return () => {
      cancelled = true;
      handle?.destroy();
      handleRef.current = null;
    };
    // The engine is created once per mount. Everything else is read through `latest`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle) return;
    if (props.paused) handle.pause();
    else handle.resume();
  }, [props.paused]);

  useEffect(() => {
    if (props.endSignal > 0) handleRef.current?.end();
  }, [props.endSignal]);

  useEffect(() => {
    handleRef.current?.setSkin(props.palette);
  }, [props.palette]);

  useEffect(() => {
    const request = props.levelRequest;
    const handle = handleRef.current;
    if (!handle || !request || request.id === appliedLevelId.current) return;
    appliedLevelId.current = request.id;
    handle.setLevel?.(request.level);
  }, [props.levelRequest]);

  useEffect(() => {
    const handle = handleRef.current;
    if (!handle || props.difficulty === undefined) return;
    if (props.difficulty === sentDifficulty.current) return;
    sentDifficulty.current = props.difficulty;
    handle.setDifficulty?.(props.difficulty);
  }, [props.difficulty]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className={className}
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
      />
      {failed && (
        <div className="java-engine-error" role="alert">
          COULD NOT LOAD THE GAME. RELOAD THE PAGE.
        </div>
      )}
    </>
  );
}
```

It owns everything a TypeScript wrapper owns, plus what asynchronous loading adds:

- The engine is created **once per mount** (effect with `[]`), destroyed on cleanup, and receives the latest callbacks through a ref.
- A `cancelled` flag set by the cleanup stops a load that finishes **after** the page was left from creating an engine. React Strict Mode runs the effect twice in development (mount, cleanup, mount): the first run is cancelled, so only one engine is alive.
- The latest `paused` is applied right after creation: pausing while the script loads starts the run paused.
- `endSignal` is ignored until the engine exists.
- A load failure shows `COULD NOT LOAD THE GAME. RELOAD THE PAGE.` inside the CRT (`.java-engine-error` in `app/globals.css`), logs a `console.error` and never shows GAME OVER.

### 7.4 The thin per-game wrapper, the palette table and the CSS

The wrapper is a normal registry `Canvas` (it receives `GameCanvasProps`). It narrows the skin string, looks the palette up and renders the shared component:

<!-- file: components/dot-catcher-canvas.tsx -->
```tsx
"use client";

import { withBasePath } from "@/lib/base-path";
import {
  H,
  SKINS,
  W,
  toSkin,
  type SkinColors,
} from "@/lib/dot-catcher/constants";
import { JavaEngineCanvas } from "@/components/java-engine-canvas";
import type { GameCanvasProps } from "@/components/game-registry";

// The engine is Java (java/dot-catcher/), compiled to this file by `npm run build:java`.
const SCRIPT = "/game-assets/dot-catcher/dot-catcher.js";

export function DotCatcherCanvas({
  paused,
  endSignal,
  onScore,
  onGameOver,
  onLives,
  onLevel,
  onSound,
  onHaptic,
  skin,
  levelRequest,
}: GameCanvasProps) {
  return (
    <JavaEngineCanvas<SkinColors>
      gameId="dot-catcher"
      src={withBasePath(SCRIPT)}
      width={W}
      height={H}
      className="dot-catcher-canvas"
      ariaLabel="Dot Catcher game field"
      palette={SKINS[toSkin(skin)]}
      paused={paused}
      endSignal={endSignal}
      onScore={onScore}
      onGameOver={onGameOver}
      onLives={onLives}
      onLevel={onLevel}
      onSound={onSound}
      onHaptic={onHaptic}
      levelRequest={levelRequest}
    />
  );
}
```

The skin table is plain TypeScript (the skins you see are the final list):

<!-- file: lib/dot-catcher/constants.ts -->
```ts
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
```

The canvas class goes in `app/globals.css`, like every canvas (`touch-action: none` so a touch never scrolls the page):

<!-- file: app/globals.css (extract) -->
```css
.dot-catcher-canvas {
  position: absolute; inset: 0;
  display: block;
  width: 100%; height: 100%;
  background: #000;
  touch-action: none; /* keys and the pad drive the paddle; a touch must not scroll the page */
}
```

### 7.5 Forwarding the optional platform features

The platform has four optional features. The bridge forwards all of them; **a Java game opts in to each by declaring a method or reading an option, and writes nothing otherwise.**

| Feature            | Registry field                | TypeScript prop            | What Java declares                                          | Semantics the engine must keep                                                                                       |
| ------------------ | ----------------------------- | -------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Level select       | `levelSelect: { min, max }`   | `levelRequest`             | `void setLevel(int level)` on the handle                    | Keep score and lives. Clamp the level. Do nothing before `start()` or after game over. Emit the level at once.       |
| Modes              | `modes: [{ id, label, hint }]` | `mode` (read once)        | `getMode()` on `JsOptions` (reads `options.mode`)           | Fixed for the whole run. PLAY AGAIN keeps it. Ignore an unknown id.                                                  |
| Difficulty         | `difficultySelect: { ... }`   | `difficulty`               | `getDifficulty()` on `JsOptions`, plus `void setDifficulty(String id)` on the handle | A **different** difficulty restarts the match. The value given at creation is not sent again. Ignore an unknown id. |
| Music (two tracks) | `music: { src, volume, alt }` | `onMusic("stage" \| "boss")` | calls `callbacks.onMusic("boss")` / `("stage")`           | Java never loads or plays audio. The tracks are platform configuration; the only link is the event.                  |

Snippets, using Dot Catcher's real `setLevel` and what a game would add:

```java
// Level select (shipped in Dot Catcher): declare it on EngineHandle and implement it with @JSExport.
public interface EngineHandle extends JSObject {
    /* ... */
    void setLevel(int level);
}

// Difficulty (not shipped): declare both pieces.
public interface JsOptions extends JSObject {
    @JSProperty String getMode();        // reads options.mode
    @JSProperty String getDifficulty();  // reads options.difficulty
}
public interface EngineHandle extends JSObject {
    /* ... */
    void setDifficulty(String id);       // called by the bridge when the player picks another one
}
@JSExport
public void setDifficulty(String id) {
    if (!Difficulty.isKnown(id) || id.equals(current)) return; // unknown ids are ignored
    current = id;
    restartMatch();                      // a different difficulty restarts the match
}

// Music (not shipped): tell the platform which track to play.
callbacks.onMusic("boss");   // boss fight starts: the platform switches to music.alt
callbacks.onMusic("stage");  // back to the main track
```

On the TypeScript side the per-game wrapper only forwards the props it uses. For `difficulty`, **narrow the string with a guard first**, as `super-tennis-canvas.tsx` does; the bridge forwards the string untouched because it cannot know a game's ids:

```tsx
<JavaEngineCanvas<MyPalette>
  /* ... */
  levelRequest={levelRequest}
  mode={mode}
  difficulty={toDifficulty(difficulty)}
  onMusic={onMusic}
/>
```

How each forward works inside `JavaEngineCanvas`:

- `levelRequest` changes: an effect calls `handle.setLevel?.(level)` once per request. A request that arrives before the script has loaded is applied right after creation.
- `mode` and `difficulty`: passed in the **`options` object** given to the factory at creation. The object only contains the keys the platform provided. If your Java reads `getMode()`, make sure the registry entry has `modes`; reading a key that was never provided is your engine's problem to default.
- `difficulty` changes later: an effect calls `handle.setDifficulty?.(id)`, and **only when the value differs from the one last sent**.
- `onMusic`: whatever Java sends other than `"boss"` becomes `"stage"`.

### 7.6 Test a forward without a Java build

The four forwards that Dot Catcher does not ship (modes, difficulty, music, and a handle with no optional methods) were verified with a **plain JavaScript stub engine** instead of inventing game features to exercise them. Repeat this after you change the bridge. The stub is never committed.

1. Create `public/game-assets/bridge-stub/stub.js`:

```js
window.ArcadeVaultJava = window.ArcadeVaultJava || {};
window.ArcadeVaultJava["bridge-stub"] = function (canvas, callbacks, palette, options) {
  const calls = (window.__stub = { callbacks, calls: [] }).calls;
  const log = (name, arg) => { calls.push(arg === undefined ? name : name + ":" + arg); console.log("[bridge-stub]", name, arg ?? ""); };
  const paint = (p) => { const c = canvas.getContext("2d"); c.fillStyle = p.background; c.fillRect(0, 0, canvas.width, canvas.height); };
  log("create", JSON.stringify(options)); paint(palette);
  const handle = {
    start() { log("start"); callbacks.onScore(0); callbacks.onLives(3); callbacks.onLevel(1); },
    pause() { log("pause"); }, resume() { log("resume"); }, destroy() { log("destroy"); },
    end() { log("end"); callbacks.onGameOver(0); },
    setSkin(p) { log("setSkin", p.background); paint(p); },
    setLevel(level) { log("setLevel", level); callbacks.onLevel(level); },
    setDifficulty(id) { log("setDifficulty", id); },
  };
  if (window.__stubMinimal) { delete handle.setLevel; delete handle.setDifficulty; }
  return handle;
};
```

2. Add a **temporary** `GAMES` entry (`id: "bridge-stub"`), a temporary wrapper that renders `JavaEngineCanvas` with any palette type (for example `{ background: string; scene: number }`, which also proves the generic parameter), and a temporary registry entry with `levelSelect`, `modes` (two modes), `difficultySelect` and `music` with an `alt` track that reuses an audio file already under `public/game-assets/`.
3. Open `/games/bridge-stub/play/`, then check in the browser console with `window.__stub.calls`:
   - picking a mode shows `create:{"mode":"alpha","difficulty":"easy"}`, and PLAY AGAIN keeps both;
   - a `+` in the PAUSED overlay shows exactly one `setLevel:N` per press;
   - picking the other difficulty shows one `setDifficulty:hard`, and the value given at creation never shows;
   - `window.__stub.callbacks.onMusic("boss")` switches the platform to the alternate track, `("stage")` and any other string switch back;
   - delaying `stub.js` in the Network panel and pressing PAUSE and `+` before it loads gives `create, start, pause, setLevel:N`;
   - setting `window.__stubMinimal = true` before load (a Playwright init script) and repeating the requests produces no console error or warning.
4. **Delete every throwaway file and edit** (`git status` must show no `bridge-stub`).

### Try it

Nothing is reachable from the UI yet. `npm run lint` and `npm run build` must pass; `npx tsc --noEmit` confirms the generic parameter accepts a palette type other than `SkinColors`.

---

## 8. Steps 5 and 6: Registry, catalog, cover and database

These steps are identical to the TypeScript guide ([section 5 Register the game](GAME-INTEGRATION-GUIDE.md#5-step-3-register-the-game), [section 6 catalog and cover](GAME-INTEGRATION-GUIDE.md#6-step-4-add-the-game-to-the-catalog-and-draw-its-cover), [section 7 backend](GAME-INTEGRATION-GUIDE.md#7-step-5-connect-the-game-to-the-backend-supabase)): the field tables, the cover technique and the security notes are there. Only the Dot Catcher values are shown.

### 8.1 Registry

The registry entry is the same as for any game. The canvas it names is the thin wrapper.

<!-- file: components/game-registry.tsx (extract) -->
```ts
  "dot-catcher": {
    // Java engine (java/dot-catcher/), compiled to JavaScript with TeaVM.
    Canvas: DotCatcherCanvas,
    controls: [
      { keys: ["←", "→"], label: "MOVE" },
      { keys: ["A", "D"], label: "MOVE" },
    ],
    stats: { lives: true, lines: false, level: true },
    levelSelect: { min: 1, max: 99 },
    appearance: {
      skins: [
        { id: "retro", label: "RETRO" },
        { id: "neon", label: "NEON" },
        { id: "pastel", label: "PASTEL" },
        { id: "gothic", label: "GOTHIC" },
        { id: "negative", label: "NEGATIVE" },
        { id: "amber-crt", label: "AMBER CRT" },
        { id: "blueprint", label: "BLUEPRINT" },
      ],
      themes: false,
    },
    sfx: {
      sounds: {
        catch: withBasePath("/game-assets/dot-catcher/catch.wav"),
        miss: withBasePath("/game-assets/dot-catcher/miss.wav"),
        gameover: withBasePath("/game-assets/dot-catcher/gameover.wav"),
      },
      volume: 0.2,
    },
    touch: {
      pad: [
        { code: "ArrowLeft", label: "◀", hold: true, slot: "left" },
        { code: "ArrowRight", label: "▶", hold: true, slot: "right" },
      ],
      hint: [{ keys: ["◀", "▶"], label: "MOVE" }],
    },
  },
```

Do not forget the import at the top of `components/game-registry.tsx`: `import { DotCatcherCanvas } from "@/components/dot-catcher-canvas";`. Every audio URL goes through `withBasePath()`.

### 8.2 Catalog

<!-- file: lib/games.ts (extract) -->
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
  },
```

### 8.3 Cover

A static CSS class `cover-dot-catcher` in `app/globals.css` (site palette, no animation), designed like the other covers: a background gradient and an inline SVG. See the class next to `.cover-wingshot`.

### 8.4 Database row

The `games` row is a manual copy of the catalog entry (`origin` included: the column has no default). Migrations only: apply it with the Supabase MCP `apply_migration` (or the CLI), then save the file under the **version the tool assigned**.

<!-- file: supabase/migrations/20261111171235_add_dot_catcher_game.sql -->
```sql
insert into public.games (id, title, short, long, cat, cover, color, origin) values
  ('dot-catcher', 'DOT CATCHER', 'Slide the paddle and catch every falling dot.',
   'Dots rain from the top of the screen. Slide your paddle left and right to catch them and score points. Miss three and the run is over. Every ten catches the dots fall faster and the rain gets thicker.',
   'ARCADE', 'cover-dot-catcher', 'cyan', 'ai');
```

Then check it: `select id, title, origin from public.games where id = 'dot-catcher'`. Types are not regenerated (no schema change).

### Try it

1. `/library` shows the card with its cover, the `🤖` emoji and PLAY. `/games/dot-catcher` shows an empty leaderboard.
2. `/games/dot-catcher/play` is fully playable: HUD (0 / 3 / 1), PAUSE with the `LEVEL − 01 +` selector, END, GAME OVER once, PLAY AGAIN.
3. Signed in, SAVE SCORE stores the score and it appears on the leaderboard. As a guest the modal says `SIGN IN TO SAVE YOUR SCORE`.
4. Playing for more than 30 seconds with a positive score shows `+N CREDITS`.

---

## 9. Step 7: Polish

### 9.1 Skins are palettes

Add a skin by adding an entry to `SKINS` in `lib/dot-catcher/constants.ts` and the same id to `appearance.skins` in the registry. **No Java rebuild.** Keep a 3:1 contrast between the paddle, the dots and the background. Dot Catcher ships `retro` (default), `neon`, `pastel`, `gothic`, `negative`, `amber-crt` and `blueprint`; `negative` is the computed inverse of `retro`. `skin-designer` (the project agent) works unchanged because the palettes live in TypeScript.

### 9.2 Touch pad

Add a `touch` entry to the registry. The pad sends the same `KeyboardEvent.code` the engine already reads, so a Java engine needs no touch code. Dot Catcher has two hold buttons, `ArrowLeft` and `ArrowRight` (slots `left` and `right`) and a hint.

### 9.3 Sound effects and haptics

The engine emits `onSound("catch" | "miss" | "gameover")` and `onHaptic("death")`. The registry's `sfx` block maps each name to a `.wav` under `public/game-assets/dot-catcher/` (volume 0.2, no `pauseToggle`), all through `withBasePath()`. Use only the haptic names that exist in `lib/haptics.ts`. Music works the same way as in the TypeScript guide, plus the `onMusic` event of [section 7.5](#75-forwarding-the-optional-platform-features).

### 9.4 Measure performance

Use `references/perf/measure-fps.md` as for any game: the compiled file is a normal script on the page. For Dot Catcher, in a software-rendered Chrome at 1280 px and CPU x1, over all seven skins: `taskMs` 0.44 to 0.55 ms per frame (target 1.0), `scriptMs` 0.05 to 0.07 and `longFrames` 0. The Java-to-Canvas JSO calls added no visible cost. For a bigger game, batch drawing calls, pre-render static art to offscreen canvases, and follow the hot-path rule: no `long`, no `String.format`, no per-frame allocation.

### Try it

All seven skins change the canvas at once (also while paused and after game over). Below 768 px the pad shows `◀` and `▶` and moves the paddle while held. The three sounds play and are silent while muted. Building with `NEXT_PUBLIC_BASE_PATH=/Arcade-Vault-Claude` and serving `out/` under that folder still loads `dot-catcher.js` and the sounds.

---

## 10. Adapting an existing Java game

You rarely start from nothing. These recipes turn the common desktop patterns into the platform's. Always remember: the platform HUD owns score, lives and level, and the engine contract is the only thing that crosses the bridge.

### 10.1 Graphics

| Java2D / AWT                                 | In the engine (through `Gfx` and `CanvasGfx`)                                                             |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `g.fillRect(x, y, w, h)`                     | `fillRect` on the context                                                                                 |
| `g.fillOval(x, y, w, h)`                     | `arc` + `fill` (`beginPath`, `arc(cx, cy, r, 0, 2*PI)`, `fill`)                                           |
| `g.drawLine(x1, y1, x2, y2)`                 | `moveTo` + `lineTo` + `stroke`                                                                            |
| `g.setColor(Color)`                          | `fillStyle` / `strokeStyle` set to a CSS string                                                           |
| `g.drawImage(img, x, y, null)`               | `drawImage` from an **offscreen canvas** (pre-render sprites once)                                         |
| `AffineTransform`, `g.rotate`, `g.scale`     | `setTransform`, or `save` / `translate` / `rotate` / `restore`                                            |
| `BufferedImage`                              | an offscreen `canvas` element drawn to once, then copied with `drawImage`                                 |
| `Color` objects                              | CSS strings (`"#00f5ff"`, `"rgb(0,245,255)"`); skins arrive as strings from TypeScript                    |
| `g.drawString`                               | **not allowed** for HUD text: score, lives and level belong to the platform. In-world labels need a spec |

Extend `Gfx` with the calls your game needs (`strokeLine`, `drawSprite`, ...) and implement them once in `CanvasGfx`. The engine never touches a JSO context directly, which keeps it testable and easy to port.

### 10.2 Input

| Java                                         | Browser                                                                                       |
| -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `KeyListener.keyPressed(e)` + `getKeyCode()` | a `keydown` listener reading `KeyboardEvent.code`                                             |
| `keyReleased`                                | a `keyup` listener                                                                            |
| `MouseListener` / `MouseMotionListener`      | pointer events (`pointerdown`, `pointermove`) on the canvas, mapped with `getBoundingClientRect` |

| `KeyEvent` constant            | `KeyboardEvent.code`                       |
| ------------------------------ | ------------------------------------------ |
| `VK_LEFT`, `VK_RIGHT`          | `ArrowLeft`, `ArrowRight`                  |
| `VK_UP`, `VK_DOWN`             | `ArrowUp`, `ArrowDown`                     |
| `VK_A` ... `VK_Z`              | `KeyA` ... `KeyZ`                          |
| `VK_0` ... `VK_9`              | `Digit0` ... `Digit9`                      |
| `VK_SPACE`                     | `Space`                                    |
| `VK_ENTER`                     | `Enter`                                    |
| `VK_SHIFT`                     | `ShiftLeft`, `ShiftRight`                  |
| `VK_CONTROL`                   | `ControlLeft`, `ControlRight`              |
| `VK_ESCAPE`                    | nothing: `Escape` is not handled, pause is the platform's button |

Pointer events carry a `pointerType` (mouse, touch, pen) and work for the touch pad too. Mouse coordinates need the canvas rectangle and the logical size: `x = (event.clientX - rect.left) * canvas.width / rect.width`. Declare a pointer listener the same way as the key listener (a `@JSFunctor` typed parameter, stored in a field).

### 10.3 Loop and time

| Java                                              | Platform                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `javax.swing.Timer`                               | one `requestAnimationFrame` callback with `dt`                                             |
| `while (running) { update(); repaint(); Thread.sleep(16); }` | the same body, called from the frame callback; delete the loop and the sleep       |
| `ScheduledExecutorService`                        | accumulate `dt` in a field and fire when it passes the period                              |
| `System.nanoTime()` / `currentTimeMillis()`       | the `requestAnimationFrame` timestamp (milliseconds), converted to `dt` seconds and capped |
| a fixed-step physics loop                         | keep an accumulator of `dt` and run fixed steps from it                                    |

### 10.4 Sound and music

| Java                                   | Platform                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `javax.sound.sampled.Clip.start()`     | `callbacks.onSound("name")` and a `.wav` under `public/game-assets/<id>/`, listed in the registry `sfx`                          |
| a background music track               | registry `music` (and `music.alt` for a second track chosen with `callbacks.onMusic("boss")` / `("stage")`)                     |
| `Clip.stop()` on pause                 | nothing: the platform pauses and mutes audio                                                                                    |

Convert audio to `.wav` (or another format the browser plays) and keep original assets: licenses of the source game's sounds rarely allow redistribution.

### 10.5 Level select, difficulty and modes

| Java game feature                                 | Bridge                                                                                                     |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| a "start at level N" method                       | `setLevel(int)` on the handle plus registry `levelSelect` (keep score and lives, clamp, emit the level)    |
| a `setDifficulty` / difficulty enum               | `setDifficulty(String)` on the handle plus `getDifficulty()` on `JsOptions`, registry `difficultySelect`   |
| a game-mode constructor argument                  | `getMode()` on `JsOptions`, registry `modes` (fixed for the run)                                           |

### 10.6 Persistence, randomness and resources

| Java                                                  | Platform                                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `Preferences`, files, `ObjectOutputStream`            | **not allowed**: state lives in memory, like every other game of the platform                     |
| `java.util.Random`                                    | works; keep a seeded generator if the game relies on one (levels, replays)                        |
| `getResourceAsStream("/sprite.png")`                  | files served from `public/` and loaded by TypeScript (or drawn in code, like the other games)     |

### 10.7 Toolkit notes

- **Swing / AWT.** Port the **model** and the body of `paintComponent`. The widget tree (`JFrame`, `JPanel`, layouts, listeners registered on components) is dropped: the platform provides the screen, the HUD and the buttons. Replace `Graphics2D` calls with `Gfx` calls and the event listeners with the recipes above.
- **libGDX.** Map `create` to the constructor (and `start()`), `render(delta)` to the frame callback (`update` + `draw`), `pause` / `resume` to the contract and `dispose` to `destroy()`. Keep the rules free of `Gdx.*` calls and draw through `Gfx`. Its web backends (GWT, and community TeaVM ones) have their own status and limits: **check them before relying on them**, and never assume a libGDX project compiles unchanged.
- **JavaFX.** TeaVM cannot compile JavaFX to the browser. Port the **model classes**, and rewrite the `Canvas` drawing against `Gfx`.
- **Logic-only Java.** A game whose Java is only rules (a headless engine, a library) has no drawing to adapt: write the drawing new in `CanvasGfx` and keep the logic as it is, with its own JUnit tests.

Never claim that a third-party project compiles unchanged until it has: check each class against the TeaVM documentation first, and expect to remove the desktop parts.

---

## 11. Debugging

- **Console and source maps.** The browser console shows `console.log` from `@JSBody` helpers and uncaught errors. The committed build is minified with no map, so errors name short symbols. To debug, set `minifying` to `false`, `sourceMapsGenerated` to `true` and `debugInformationGenerated` to `true` in the pom **locally**, rebuild and open the page: the Sources panel then shows your `.java` files. Revert the pom and rebuild before committing.
- **A quick log.** A temporary helper such as `@JSBody(params = {"m"}, script = "console.log(m);") static native void log(String m);` and a call in the suspect method finds most problems in a minute. Remove it afterwards.
- **A TeaVM "unsupported class" error.** The build fails with a message that names a class or method not found in the class library (for example `Method java.lang.String.format ... was not found`). Remove the use, or replace it with something the subset has. Do not suppress the error.
- **A 404 under the GitHub Pages sub-path.** The script or a sound loads locally and fails in production because the URL was a raw string. Pass it through `withBasePath()`. Test with `NEXT_PUBLIC_BASE_PATH=/Arcade-Vault-Claude npm run build` and serve `out/` under that folder.
- **The old build keeps loading.** The browser cached the previous `dot-catcher.js`. Do a hard reload (or `fetch(url, { cache: "reload" })`), then retest. This looks exactly like "my fix did nothing".
- **Stuck keys.** Check that `blur` and `visibilitychange` clear the held keys, and that `pause()` and `finishRun()` call `clearInput()`.
- **Two engines in Strict Mode.** In development React mounts, unmounts and mounts again. After that, one key press must move the paddle once. If it moves twice, the first engine was not destroyed or the `cancelled` flag is missing; `JavaEngineCanvas` already handles both.
- **The game draws but ignores the keyboard.** A listener helper parameter is typed `JSObject` instead of the functor interface (section 6.4).
- **`The system cannot find the file ...\.mvn\wrapper\maven-wrapper.properties`.** Maven was started from the wrong folder. Use `npm run build:java`, which runs it from `java/<id>/`.
- **`JAVA_HOME not found`.** Only when you run `mvnw` by hand. `npm run build:java` derives it.
- **`PKIX path building failed`.** See the "Try it" of Step 1.

---

## 12. Documentation, test checklist, common mistakes, file checklist

### 12.1 Documentation to update

- `references/GAMES.md`: a table row, a section for the game, and the catalog counts.
- `CLAUDE.md`: the catalog count, a per-game note, and the "Java games" section (the Java engine lives in `java/<id>/` and `lib/<id>/` holds only TypeScript glue and skins).
- `README.md`: the game, and a link to this guide.
- `references/skins-log.md`, `references/perf/perf-log.md` (the agents write them).

### 12.2 Test checklist

**Build and repo**

- [ ] `npm run build:java` on a clean checkout (JDK only) writes `public/game-assets/<id>/<id>.js` and leaves `git status` clean.
- [ ] `npm run build:java -- test` passes, with a test for each function of the pure logic and the score clamp at both ends.
- [ ] `npm run lint` and `npm run build` pass, and the build is still a static export.
- [ ] The compiled file is at most 500 KB. No `target/` folder, source map or `.class` file is committed.
- [ ] `deploy-pages.yml` is unchanged.

**Engine contract (in the browser)**

- [ ] The HUD shows score 0, lives 3, level 1 as soon as the run starts and updates only on change.
- [ ] Scoring, lives and levels follow the rules; a miss vibrates with `death` on a touch layout.
- [ ] PAUSE freezes everything and RESUME continues with no jump.
- [ ] END and losing the last life each show GAME OVER exactly once. After it, arrow keys do not scroll the page.
- [ ] PLAY AGAIN starts clean with no leftover objects and no leftover listeners.
- [ ] Switching tabs while holding a key leaves no stuck key.
- [ ] In development (Strict Mode) only one engine is alive.
- [ ] Leaving the page before the script loads creates no engine and prints no error.
- [ ] Blocking the script shows `COULD NOT LOAD THE GAME. RELOAD THE PAGE.`, logs a console error and shows no GAME OVER; after restoring the network, leaving and opening the page again loads the game.
- [ ] Pausing before the script has loaded starts the run paused.
- [ ] The canvas draws only the playfield.
- [ ] Level select (if declared): `+` sets the HUD level at once, keeps score and lives, clears the objects, clamps at both ends, and does nothing after game over.

**Platform**

- [ ] The card shows the cover, the origin emoji and PLAY; `/games/<id>` shows an empty leaderboard.
- [ ] The `games` row equals the catalog entry. Signed in, SAVE SCORE works. As a guest the modal shows the sign-in message. Over 30 s of play shows `+N CREDITS`.
- [ ] Every skin changes the canvas at once and keeps a 3:1 contrast. The touch pad works below 768 px. Sounds play and mute.
- [ ] `measure-fps.md` at 1280 px and CPU x1: `taskMs` at most 1.0 and `longFrames` 0.
- [ ] Under `NEXT_PUBLIC_BASE_PATH=/Arcade-Vault-Claude` the script and sounds still load.
- [ ] The word "Java" appears in no user-visible text.

### 12.3 Common mistakes

| Symptom                                                     | Cause                                                                              | Fix                                                                                       |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| The game draws but ignores the keyboard, no error           | A listener helper takes `JSObject`, so the Java lambda is never converted          | Type the parameter with the `@JSFunctor` interface (section 6.4)                          |
| My Java change does nothing in the browser                  | The `.js` was not rebuilt, or the browser cached the old one                        | `npm run build:java`, commit the `.js`, hard reload                                       |
| `PKIX path building failed` on the first build              | A TLS-inspecting proxy; Java does not trust the Windows store                        | `MAVEN_OPTS=-Djavax.net.ssl.trustStoreType=WINDOWS-ROOT ...` for that shell only         |
| Works locally, 404 in production                            | A raw URL without `withBasePath()`                                                  | Wrap the script and audio URLs                                                            |
| The next run starts with the previous run's state           | A mutable `static` field in the engine                                              | Make it an instance field                                                                 |
| `removeEventListener` does not remove                       | A new functor was created for the remove call                                       | Keep each functor in a field, created once                                                |
| Score or lives drawn on the canvas                          | `drawString` carried over from a desktop game                                       | Delete it: the platform HUD owns those                                                    |
| The game stutters                                           | `long` math, `String.format` or allocation in `update` / `draw`                     | Use `int` / `double`, no formatting, reuse objects (pools)                                |
| Build error naming a JDK class                              | The class is outside the TeaVM class library                                         | Replace it (section 3)                                                                    |
| A skin needs a Java rebuild                                 | The palette is stored in Java                                                       | Keep palettes in `SKINS` in TypeScript and pass them in                                   |
| Two games break each other                                  | The loader's `main` handling was bypassed                                           | Use `loadJavaEngine`; one `window.ArcadeVaultJava[id]` per game                           |
| Saving a score fails                                        | No `games` row for the id                                                           | Apply the migration (section 8.4)                                                         |

### 12.4 File checklist

For a new Java game `<id>` you create or edit:

- [ ] `java/<id>/pom.xml`, `mvnw`, `mvnw.cmd`, `.mvn/wrapper/maven-wrapper.properties`
- [ ] `java/<id>/src/main/java/...`: `Main`, the engine, `Constants`, `GameMath`, your entities, and the four files to copy (`Gfx`, `CanvasGfx`, `Browser`, `Bridge`)
- [ ] `java/<id>/src/test/java/...`: tests of the pure logic
- [ ] `public/game-assets/<id>/<id>.js` (committed build) and the audio files
- [ ] `lib/<id>/constants.ts`: size, palette type, `SKINS`, skin guard
- [ ] `components/<id>-canvas.tsx`: the thin wrapper
- [ ] `app/globals.css`: the canvas class and the cover class
- [ ] `components/game-registry.tsx`: the import and the entry
- [ ] `lib/games.ts`: the catalog entry
- [ ] `supabase/migrations/<version>_add_<id>_game.sql`: applied and saved
- [ ] `references/GAMES.md`, `CLAUDE.md`, `README.md`
- [ ] Shared and **not** edited per game: `lib/java-bridge/*`, `components/java-engine-canvas.tsx`, `scripts/build-java.mjs` (its game folder comes from `JAVA_GAME`)

### 12.5 Where to learn more

- `GAME-INTEGRATION-GUIDE.md`: the TypeScript guide, with the field tables of the registry, the catalog and the database.
- `references/perf/measure-fps.md` and `references/perf/perf-log.md`: how to measure frame time, and the Dot Catcher numbers.
- `references/skins-log.md`: the skins of every game.
- The TeaVM documentation (teavm.org): the class library, JSO, `@JSFunctor`, `@JSExport`, and the supported Java features. Check the version you pin.
- `specs/27-java-game-integration-guide-and-dot-catcher.md`: why this route was chosen and what is deliberately out of scope.
