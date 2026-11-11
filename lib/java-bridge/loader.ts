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
