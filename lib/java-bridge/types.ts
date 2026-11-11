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
