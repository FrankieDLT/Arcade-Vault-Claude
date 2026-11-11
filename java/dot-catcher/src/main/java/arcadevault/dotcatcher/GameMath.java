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
