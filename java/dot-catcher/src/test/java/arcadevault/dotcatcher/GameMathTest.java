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
