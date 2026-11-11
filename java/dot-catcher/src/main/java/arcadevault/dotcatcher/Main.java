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
