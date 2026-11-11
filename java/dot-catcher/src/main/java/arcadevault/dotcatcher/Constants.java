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
