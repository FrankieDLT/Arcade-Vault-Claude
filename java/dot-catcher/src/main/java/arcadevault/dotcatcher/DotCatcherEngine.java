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
