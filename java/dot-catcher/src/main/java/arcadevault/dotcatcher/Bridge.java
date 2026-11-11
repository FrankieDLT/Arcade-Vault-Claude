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
